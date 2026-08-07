/**
 * Donation routes
 *
 * GET  /api/donation/progress         — current cycle progress (public)
 * POST /api/donation/start            — create IDPay payment session
 * POST /api/donation/callback         — IDPay POST callback (verify + redirect)
 * GET  /api/donation/status/:orderId  — poll payment status
 */

import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db, payments, pricingConfig } from "@workspace/db";
import { eq, and, gte, sum } from "drizzle-orm";
import { createPayment, verifyPayment, isVerifiedStatus } from "../lib/idpay";
import { currentCycleStart } from "../lib/iranTime";
import { logger } from "../lib/logger";
import { donationStartLimiter } from "../lib/rateLimiter";
import { DEFAULT_PRICING } from "../lib/adminAuth";

const router = Router();

// ── Config ───────────────────────────────────────────────────────────────────

/** Monthly infrastructure target in Rials. Falls back to 298,000 Tomans default. */
async function getTargetRials(): Promise<number> {
  try {
    const [row] = await db
      .select({ value: pricingConfig.value })
      .from(pricingConfig)
      .where(eq(pricingConfig.key, "donation_monthly_target_tomans"))
      .limit(1);
    const tomans = row ? Number(row.value) : DEFAULT_PRICING.donation_monthly_target_tomans;
    return isFinite(tomans) && tomans > 0 ? tomans * 10 : DEFAULT_PRICING.donation_monthly_target_tomans * 10;
  } catch {
    return DEFAULT_PRICING.donation_monthly_target_tomans * 10;
  }
}

function getCycleOrigin(): Date {
  const env = process.env.DONATION_CYCLE_START;
  if (env) {
    const d = new Date(env);
    if (!isNaN(d.getTime())) return d;
  }
  // Default: first day of the current UTC month
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function getAppBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ??
    `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost:8081"}`
  );
}

function getFrontendUrl(): string {
  return (
    process.env.FRONTEND_URL ??
    `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost:8080"}`
  );
}

// ── GET /progress ─────────────────────────────────────────────────────────────

router.get("/progress", async (_req, res) => {
  try {
    const cycleStart = currentCycleStart(getCycleOrigin());

    const [row] = await db
      .select({ total: sum(payments.amountRials) })
      .from(payments)
      .where(
        and(
          eq(payments.type, "donation"),
          eq(payments.status, "verified"),
          gte(payments.createdAt, cycleStart),
        ),
      );

    const targetRials   = await getTargetRials();
    const donatedRials  = Number(row?.total ?? 0);
    const donatedTomans = Math.floor(donatedRials / 10);
    const targetTomans  = Math.floor(targetRials / 10);
    const percentage    = Math.round((donatedRials / targetRials) * 100);

    res.json({
      donatedTomans,
      targetTomans,
      percentage,
      cycleStart: cycleStart.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "donation/progress error");
    res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /start ───────────────────────────────────────────────────────────────

/**
 * Body: { amountTomans: number }
 * Returns: { paymentUrl: string, orderId: string }
 */
router.post("/start", donationStartLimiter, async (req, res) => {
  try {
    const raw = Number(req.body?.amountTomans);
    if (!raw || raw < 1000 || raw > 10_000_000 || !Number.isInteger(raw)) {
      return res.status(400).json({
        error: "invalid_amount",
        message: "مبلغ کمک مالی نامعتبر است",
      });
    }

    const amountRials = raw * 10;
    const orderId = randomUUID();
    const callback = `${getAppBaseUrl()}/api/donation/callback`;

    const idpayResult = await createPayment({
      orderId,
      amount: amountRials,
      callback,
      desc: `کمک مالی ایتاشات — ${raw.toLocaleString("fa-IR")} تومان`,
    });

    // Persist BEFORE returning the link to the client (idempotency requirement)
    await db.insert(payments).values({
      orderId,
      idpayId: idpayResult.id,
      type: "donation",
      amountRials,
      status: "pending",
    });

    return res.json({ paymentUrl: idpayResult.link, orderId });
  } catch (err) {
    logger.error({ err }, "donation/start error");
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /callback ────────────────────────────────────────────────────────────
// IDPay redirects the user's browser here via POST after payment.
// We verify server-to-server, update the record, then redirect the user.

router.post("/callback", async (req, res) => {
  const { id: idpayId, order_id: orderId } = req.body as {
    id?: string;
    order_id?: string;
  };

  const frontendBase = getFrontendUrl();

  if (!idpayId || !orderId) {
    return res.redirect(`${frontendBase}/?payment=donation_failed`);
  }

  try {
    // Load the pending payment record
    const [record] = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .limit(1);

    if (!record || record.type !== "donation") {
      return res.redirect(`${frontendBase}/?payment=donation_failed`);
    }

    // Already verified — idempotent redirect, no second IDPay call
    if (record.status === "verified") {
      return res.redirect(`${frontendBase}/?payment=donation_success`);
    }

    // Server-to-server verification with IDPay
    const verification = await verifyPayment({ id: idpayId, orderId });

    if (isVerifiedStatus(verification.status)) {
      await db
        .update(payments)
        .set({
          status: "verified",
          idpayId: String(verification.id),
          trackId: String(verification.track_id),
          verifiedAt: new Date(),
          verificationPayload: verification as unknown as Record<string, unknown>,
        })
        .where(eq(payments.orderId, orderId));

      return res.redirect(`${frontendBase}/?payment=donation_success`);
    } else {
      await db
        .update(payments)
        .set({
          status: "failed",
          verificationPayload: verification as unknown as Record<string, unknown>,
        })
        .where(eq(payments.orderId, orderId));

      return res.redirect(`${frontendBase}/?payment=donation_failed`);
    }
  } catch (err) {
    logger.error({ err }, "donation/callback error");
    return res.redirect(`${frontendBase}/?payment=donation_failed`);
  }
});

// ── GET /status/:orderId ──────────────────────────────────────────────────────

router.get("/status/:orderId", async (req, res) => {
  try {
    const [record] = await db
      .select({ status: payments.status })
      .from(payments)
      .where(
        and(eq(payments.orderId, req.params.orderId), eq(payments.type, "donation")),
      )
      .limit(1);

    if (!record) return res.status(404).json({ error: "not_found" });
    return res.json({ status: record.status });
  } catch (err) {
    logger.error({ err }, "donation/status error");
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;

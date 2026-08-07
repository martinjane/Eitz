/**
 * Payment history routes for authenticated users.
 *
 * GET /api/payments/mine     — list this user's ad payments; runs lazy cleanup
 * GET /api/payments/pending  — lightweight check: does this user have pending payments?
 */

import { Router } from "express";
import { db, payments } from "@workspace/db";
import { eq, and, or, lt } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { generalReadLimiter } from "../lib/rateLimiter";
import { logger } from "../lib/logger";

const router = Router();

/** Delete expired payment records for a user (lazy cleanup). */
async function cleanupUserPayments(userId: number): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  await db
    .delete(payments)
    .where(
      and(
        eq(payments.userId, userId),
        or(
          and(eq(payments.status, "failed"), lt(payments.createdAt, oneHourAgo)),
          and(eq(payments.status, "verified"), lt(payments.createdAt, oneWeekAgo)),
        ),
      ),
    );
}

/**
 * GET /api/payments/mine
 * Returns the authenticated user's ad payment history (pending, verified, failed).
 * Runs lazy cleanup before returning so expired records are pruned automatically.
 */
router.get("/mine", requireAuth, generalReadLimiter, async (req: AuthedRequest, res) => {
  try {
    await cleanupUserPayments(req.userId!);

    const rows = await db
      .select({
        id:                  payments.id,
        orderId:             payments.orderId,
        type:                payments.type,
        amountRials:         payments.amountRials,
        status:              payments.status,
        paymentUrl:          payments.paymentUrl,
        paymentUrlExpiresAt: payments.paymentUrlExpiresAt,
        verifiedAt:          payments.verifiedAt,
        createdAt:           payments.createdAt,
      })
      .from(payments)
      .where(
        and(
          eq(payments.userId, req.userId!),
          eq(payments.type, "ad"),
        ),
      )
      .orderBy(payments.createdAt);

    return res.json({ payments: rows.reverse() }); // newest first
  } catch (err) {
    logger.error({ err }, "payments/mine error");
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * GET /api/payments/pending
 * Lightweight: returns true if the user has any pending (unpaid) ad payments.
 * Used by the Home screen to show a notification dot.
 */
router.get("/pending", requireAuth, generalReadLimiter, async (req: AuthedRequest, res) => {
  try {
    const [row] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.userId, req.userId!),
          eq(payments.type, "ad"),
          eq(payments.status, "pending"),
        ),
      )
      .limit(1);

    return res.json({ hasPending: !!row });
  } catch (err) {
    logger.error({ err }, "payments/pending error");
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;

/**
 * Advertisement routes
 *
 * GET    /api/ads/slots               — availability for next 3 days (public)
 * GET    /api/ads/mine                — list authenticated user's saved ads
 * POST   /api/ads/create              — create a saved ad draft (auth required)
 * DELETE /api/ads/saved/:id           — cancel/delete a saved ad (auth required)
 * POST   /api/ads/submit              — schedule a content_approved saved ad + reserve slots (auth required)
 * POST   /api/ads/pay/:adId           — create IDPay payment for an ad
 * POST   /api/ads/callback            — IDPay POST callback (verify + redirect)
 * GET    /api/ads/status/:orderId     — poll payment status
 * GET    /api/ads/current             — active ad for the current window (public)
 * GET    /api/ads/ad-terms            — check if user accepted ToS
 * POST   /api/ads/ad-terms            — record ToS acceptance
 */

import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db, payments, advertisements, adWindows, savedAds, userAdTermsAcceptance, channelVerifications, pricingConfig, users } from "@workspace/db";
import { eq, and, or, lt, inArray, count, ne } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { createPayment, verifyPayment, isVerifiedStatus } from "../lib/idpay";
import {
  nextNIranDates,
  todayIranString,
  currentSlot,
} from "../lib/iranTime";
import { logger } from "../lib/logger";
import { adSubmitLimiter, adPayLimiter, generalReadLimiter } from "../lib/rateLimiter";
import { sendMessage, paymentSuccessMessage, paymentFailedMessage } from "../lib/eitaa";
import { DEFAULT_PRICING } from "../lib/adminAuth";

const router = Router();

// ── Config ───────────────────────────────────────────────────────────────────

/** Price per window slot in Rials (50,000 Tomans default). */
function windowPriceRials(): number {
  return (Number(process.env.AD_WINDOW_PRICE_TOMANS ?? 50_000)) * 10;
}

/** Minutes before a reservation expires if unpaid. */
function reservationTimeoutMinutes(): number {
  return Number(process.env.RESERVATION_TIMEOUT_MINUTES ?? 30);
}

/** How many expired unpaid reservations in a 3-day window trigger a block. */
function maxExpiredReservations(): number {
  return Number(process.env.MAX_EXPIRED_RESERVATIONS ?? 3);
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Expire overdue reservations (lazy cleanup — runs before each availability check). */
async function expireStaleReservations(): Promise<void> {
  await db
    .update(adWindows)
    .set({ status: "expired" })
    .where(
      and(
        eq(adWindows.status, "reserved"),
        lt(adWindows.reservedUntil, new Date()),
      ),
    );
}

/** Check if an IP has too many expired unpaid reservations in the rolling 3-day window. */
async function isIpBlocked(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ id: adWindows.id, createdAt: adWindows.createdAt })
    .from(adWindows)
    .where(
      and(
        eq(adWindows.reserverIp, ip),
        eq(adWindows.status, "expired"),
      ),
    );

  const recentCount = rows.filter((r: { createdAt: Date }) => r.createdAt >= since).length;
  return recentCount >= maxExpiredReservations();
}

/** Allowed image MIME prefixes in ad submissions (data URL format). */
const ALLOWED_IMAGE_PREFIXES = [
  "data:image/jpeg;base64,",
  "data:image/jpg;base64,",
  "data:image/png;base64,",
  "data:image/webp;base64,",
  "data:image/gif;base64,",
];

function isValidAdImageDataUrl(value: string): boolean {
  return ALLOWED_IMAGE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/** Validate that channelLink is a proper Eitaa channel URL. */
function isValidEitaaChannelLink(value: string): boolean {
  // Must be https://eitaa.com/<username> with a sane username
  return /^https:\/\/eitaa\.com\/[a-zA-Z0-9_]{2,64}$/.test(value);
}

// ── GET /mine ─────────────────────────────────────────────────────────────────
// List the authenticated user's saved ad drafts.

router.get("/mine", requireAuth, generalReadLimiter, async (req: AuthedRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(savedAds)
      .where(eq(savedAds.userId, req.userId!))
      .orderBy(savedAds.createdAt);
    return res.json({ ads: rows });
  } catch (err) {
    logger.error({ err }, "ads/mine error");
    return res.status(500).json({ error: "internal_error" });
  }
});

// Public status used to gate entry to the advertisement submission flow.
router.get("/maintenance", generalReadLimiter, async (_req, res) => {
  try {
    const [row] = await db.select({ value: pricingConfig.value })
      .from(pricingConfig)
      .where(eq(pricingConfig.key, "ad_submissions_disabled"))
      .limit(1);
    return res.json({ disabled: row ? row.value === true : DEFAULT_PRICING.ad_submissions_disabled });
  } catch {
    return res.json({ disabled: false });
  }
});

// ── POST /create ──────────────────────────────────────────────────────────────
// Create a saved ad draft (auth required). The draft goes through admin content
// review before the user can schedule it.
// Body: { channelVerificationId: number, adText: string, adImage: string }

router.post("/create", requireAuth, adSubmitLimiter, async (req: AuthedRequest, res) => {
  const { channelVerificationId, adText, adImage } = req.body as {
    channelVerificationId?: number;
    adText?: string;
    adImage?: string;
  };

  if (!channelVerificationId || !adText || !adImage) {
    return res.status(400).json({ error: "missing_fields" });
  }

  // Check maintenance mode
  try {
    const [maintenanceRow] = await db
      .select({ value: pricingConfig.value })
      .from(pricingConfig)
      .where(eq(pricingConfig.key, "ad_submissions_disabled"))
      .limit(1);
    const disabled = maintenanceRow
      ? (maintenanceRow.value as boolean)
      : DEFAULT_PRICING.ad_submissions_disabled;
    if (disabled) {
      return res.status(503).json({
        error: "submissions_disabled",
        message: "در حال حاضر ثبت آگهی جدید غیرفعال است. لطفاً بعداً تلاش کنید.",
      });
    }
  } catch { /* config unavailable — allow submission */ }

  // Look up the channel verification (must belong to user and be approved)
  const [channelRow] = await db
    .select()
    .from(channelVerifications)
    .where(eq(channelVerifications.id, channelVerificationId))
    .limit(1);

  if (!channelRow) return res.status(404).json({ error: "channel_not_found" });
  if (channelRow.userId !== req.userId) return res.status(403).json({ error: "forbidden" });
  if (channelRow.status !== "approved") {
    return res.status(409).json({ error: "channel_not_approved", message: "فقط کانال‌های تأیید شده می‌توانند برای آگهی انتخاب شوند" });
  }

  // Enforce max 5 saved ads per user
  const [countRow] = await db
    .select({ total: count() })
    .from(savedAds)
    .where(eq(savedAds.userId, req.userId!));
  if ((countRow?.total ?? 0) >= 5) {
    return res.status(409).json({ error: "limit_reached", message: "حداکثر ۵ آگهی برای هر حساب کاربری مجاز است" });
  }

  // Strip bold markers for length check
  const plainText = adText.replace(/\*\*([^*]+)\*\*/g, "$1");
  if (plainText.length > 200) {
    return res.status(400).json({ error: "text_too_long", message: "متن آگهی حداکثر ۲۰۰ کاراکتر مجاز است" });
  }
  if (!isValidAdImageDataUrl(adImage)) {
    return res.status(400).json({ error: "invalid_image_format", message: "فقط تصاویر JPEG، PNG، WEBP یا GIF مجاز هستند" });
  }
  const commaIdx = adImage.indexOf(",");
  const imageSizeBytes = commaIdx >= 0 ? Math.ceil((adImage.length - commaIdx - 1) * 0.75) : adImage.length;
  if (imageSizeBytes > 500 * 1024) {
    return res.status(400).json({ error: "image_too_large", message: "حجم تصویر حداکثر ۵۰۰ کیلوبایت مجاز است" });
  }

  try {
    const [created] = await db
      .insert(savedAds)
      .values({
        userId: req.userId!,
        channelLink: channelRow.channelLink,
        channelName: channelRow.channelUsername,
        adText,
        adImage,
        status: "draft",
      })
      .returning();
    return res.json({ ad: created });
  } catch (err) {
    logger.error({ err }, "ads/create error");
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── DELETE /saved/:id ─────────────────────────────────────────────────────────
// Cancel/delete a saved ad that belongs to the authenticated user.
// Only draft, content_approved, or content_rejected ads can be deleted.

router.delete("/saved/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });

  try {
    const [row] = await db
      .select({ id: savedAds.id, userId: savedAds.userId, status: savedAds.status })
      .from(savedAds)
      .where(eq(savedAds.id, id))
      .limit(1);

    if (!row) return res.status(404).json({ error: "not_found" });
    if (row.userId !== req.userId) return res.status(403).json({ error: "forbidden" });
    if (!["draft", "content_approved", "content_rejected"].includes(row.status)) {
      return res.status(409).json({ error: "not_cancellable", message: "این آگهی قابل لغو نیست" });
    }

    await db.delete(savedAds).where(eq(savedAds.id, id));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "ads/saved/delete error");
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /slots ────────────────────────────────────────────────────────────────

router.get("/slots", async (_req, res) => {
  try {
    await expireStaleReservations();

    const dates = nextNIranDates(3);
    const todayStr = todayIranString();
    const currentSlotIdx = currentSlot();

    // Fetch all non-available windows for the next 3 days
    const bookedRows = await db
      .select({ windowDate: adWindows.windowDate, windowSlot: adWindows.windowSlot })
      .from(adWindows)
      .where(
        and(
          inArray(adWindows.windowDate, dates),
          or(eq(adWindows.status, "reserved"), eq(adWindows.status, "paid")),
        ),
      );

    const bookedSet = new Set(
      bookedRows.map((r: { windowDate: string; windowSlot: number }) => `${r.windowDate}:${r.windowSlot}`),
    );

    const result = dates.map((date) => ({
      date,
      slots: [0, 1, 2, 3].map((slot) => {
        const isPast =
          date < todayStr ||
          (date === todayStr && slot <= currentSlotIdx);
        const isBooked = bookedSet.has(`${date}:${slot}`);
        return {
          slot,
          available: !isPast && !isBooked,
        };
      }),
    }));

    return res.json({ days: result, windowPriceTomans: Math.floor(windowPriceRials() / 10) });
  } catch (err) {
    logger.error({ err }, "ads/slots error");
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /submit ──────────────────────────────────────────────────────────────

/**
 * Create an advertisement order from a content-approved saved ad.
 * Slot reservation no longer happens here — it is deferred to /pay so that
 * browsing and selecting slots never permanently holds availability.
 *
 * Body: { savedAdId: number, windows: Array<{ date: string, slot: number }> }
 * Returns: { adId: number }
 */
router.post("/submit", requireAuth, adSubmitLimiter, async (req: AuthedRequest, res) => {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.ip ??
    "unknown";

  const { savedAdId, windows } = req.body as {
    savedAdId?: number;
    windows?: Array<{ date: string; slot: number }>;
  };

  if (!savedAdId || !Array.isArray(windows) || windows.length === 0) {
    return res.status(400).json({ error: "missing_fields" });
  }
  if (windows.length > 4) {
    return res.status(400).json({ error: "too_many_windows", message: "حداکثر ۴ بازه در هر سفارش مجاز است" });
  }

  // Load and validate the saved ad
  const [savedAd] = await db
    .select()
    .from(savedAds)
    .where(eq(savedAds.id, savedAdId))
    .limit(1);

  if (!savedAd) return res.status(404).json({ error: "saved_ad_not_found", message: "آگهی ذخیره‌شده یافت نشد" });
  if (savedAd.userId !== req.userId) return res.status(403).json({ error: "forbidden" });
  if (savedAd.status !== "content_approved") {
    return res.status(409).json({ error: "not_approved", message: "آگهی هنوز توسط ادمین تأیید نشده است" });
  }

  // Validate selected windows (format only — availability checked at pay time)
  const validDates = nextNIranDates(3);
  const todayStr = todayIranString();
  const nowSlot = currentSlot();

  for (const w of windows) {
    if (typeof w.date !== "string" || !validDates.includes(w.date)) {
      return res.status(400).json({ error: "invalid_date" });
    }
    if (typeof w.slot !== "number" || !Number.isInteger(w.slot) || w.slot < 0 || w.slot > 3) {
      return res.status(400).json({ error: "invalid_slot" });
    }
    const isPast = w.date < todayStr || (w.date === todayStr && w.slot <= nowSlot);
    if (isPast) return res.status(400).json({ error: "slot_in_past" });
  }

  try {
    // Create advertisement record only — no slot reservation yet.
    // Reservation happens atomically in /pay when the user commits to payment.
    const [ad] = await db
      .insert(advertisements)
      .values({
        savedAdId: savedAd.id,
        channelLink: savedAd.channelLink,
        channelName: savedAd.channelName,
        adText: savedAd.adText,
        adImage: savedAd.adImage,
        submitterIp: ip,
        status: "pending_payment",
      })
      .returning({ id: advertisements.id });

    return res.json({ adId: ad.id });
  } catch (err) {
    logger.error({ err }, "ads/submit error");
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /pay/:adId ───────────────────────────────────────────────────────────
//
// Reserves the requested time-slots atomically and initiates IDPay payment.
// Slot reservation was moved here from /submit so that browsing and selecting
// slots never occupies availability.
//
// Body: { windows: Array<{ date: string, slot: number }> }

router.post("/pay/:adId", requireAuth, adPayLimiter, async (req: AuthedRequest, res) => {
  const adId = Number(req.params.adId);
  if (!adId || !Number.isInteger(adId)) {
    return res.status(400).json({ error: "invalid_ad_id" });
  }

  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.ip ??
    "unknown";

  // Receive windows from the client (they are not yet stored in adWindows)
  const { windows } = req.body as {
    windows?: Array<{ date: string; slot: number }>;
  };

  if (!Array.isArray(windows) || windows.length === 0) {
    return res.status(400).json({ error: "missing_windows", message: "بازه‌های زمانی ارائه نشده‌اند." });
  }
  if (windows.length > 4) {
    return res.status(400).json({ error: "too_many_windows", message: "حداکثر ۴ بازه در هر سفارش مجاز است" });
  }

  // Re-validate window dates/slots
  const validDates = nextNIranDates(3);
  const todayStr = todayIranString();
  const nowSlot = currentSlot();

  for (const w of windows) {
    if (typeof w.date !== "string" || !validDates.includes(w.date)) {
      return res.status(400).json({ error: "invalid_date" });
    }
    if (typeof w.slot !== "number" || !Number.isInteger(w.slot) || w.slot < 0 || w.slot > 3) {
      return res.status(400).json({ error: "invalid_slot" });
    }
    const isPast = w.date < todayStr || (w.date === todayStr && w.slot <= nowSlot);
    if (isPast) return res.status(400).json({ error: "slot_in_past", message: "یک یا چند بازه زمانی گذشته است" });
  }

  // Check IP abuse history
  if (await isIpBlocked(ip)) {
    return res.status(429).json({
      error: "too_many_expired",
      message: "به دلیل تعداد زیاد رزرو ناموفق، موقتاً امکان پرداخت وجود ندارد.",
    });
  }

  try {
    // Load ad and verify ownership via savedAd
    const [ad] = await db
      .select()
      .from(advertisements)
      .where(eq(advertisements.id, adId))
      .limit(1);

    if (!ad) return res.status(404).json({ error: "not_found" });
    if (ad.status !== "pending_payment") {
      return res.status(409).json({ error: "already_paid" });
    }

    // Verify ownership: the ad must originate from this user's saved ad
    if (ad.savedAdId) {
      const [savedAd] = await db
        .select({ userId: savedAds.userId })
        .from(savedAds)
        .where(eq(savedAds.id, ad.savedAdId))
        .limit(1);
      if (!savedAd || savedAd.userId !== req.userId) {
        return res.status(403).json({ error: "forbidden" });
      }
    }

    // Expire stale reservations from other users before checking availability
    await expireStaleReservations();

    // Check availability for the requested windows
    const bookedRows = await db
      .select({ windowDate: adWindows.windowDate, windowSlot: adWindows.windowSlot })
      .from(adWindows)
      .where(
        and(
          inArray(adWindows.windowDate, windows.map((w) => w.date)),
          or(eq(adWindows.status, "reserved"), eq(adWindows.status, "paid")),
        ),
      );

    const bookedSet = new Set(
      bookedRows.map((r: { windowDate: string; windowSlot: number }) => `${r.windowDate}:${r.windowSlot}`),
    );
    for (const w of windows) {
      if (bookedSet.has(`${w.date}:${w.slot}`)) {
        return res.status(409).json({
          error: "slot_unavailable",
          message: "یک یا چند بازه زمانی انتخاب‌شده دیگر در دسترس نیست. لطفاً بازه‌های دیگری انتخاب کنید.",
        });
      }
    }

    // Reserve windows atomically before contacting IDPay
    const reservedUntil = new Date(Date.now() + reservationTimeoutMinutes() * 60 * 1000);
    await db.insert(adWindows).values(
      windows.map((w) => ({
        adId: ad.id,
        windowDate: w.date,
        windowSlot: w.slot,
        status: "reserved" as const,
        reservedUntil,
        reserverIp: ip,
      })),
    );

    const amountRials = windows.length * windowPriceRials();
    const orderId = randomUUID();
    const callback = `${getAppBaseUrl()}/api/ads/callback`;

    const idpayResult = await createPayment({
      orderId,
      amount: amountRials,
      callback,
      desc: `آگهی کانال ایتا — ${windows.length} بازه`,
    });

    // Persist payment record with userId and paymentUrl for history/resume
    const paymentUrlExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    await db.insert(payments).values({
      orderId,
      idpayId: idpayResult.id,
      type: "ad",
      refId: adId,
      userId: req.userId ?? undefined,
      amountRials,
      status: "pending",
      paymentUrl: idpayResult.link,
      paymentUrlExpiresAt,
    });

    return res.json({ paymentUrl: idpayResult.link, orderId });
  } catch (err) {
    logger.error({ err }, "ads/pay error");
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /callback ────────────────────────────────────────────────────────────

router.post("/callback", async (req, res) => {
  const { id: idpayId, order_id: orderId } = req.body as {
    id?: string;
    order_id?: string;
  };

  const frontendBase = getFrontendUrl();

  if (!idpayId || !orderId) {
    return res.redirect(`${frontendBase}/advertise?payment=failed`);
  }

  try {
    const [record] = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .limit(1);

    if (!record || record.type !== "ad") {
      return res.redirect(`${frontendBase}/advertise?payment=failed`);
    }

    // Already verified — idempotent redirect, no second IDPay call
    if (record.status === "verified") {
      return res.redirect(
        `${frontendBase}/advertise?payment=success&orderId=${orderId}`,
      );
    }

    // Server-to-server verification with IDPay
    const verification = await verifyPayment({ id: idpayId, orderId });

    if (isVerifiedStatus(verification.status)) {
      // Mark payment verified
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

      // Mark ad windows as paid; content was already reviewed so set approved directly
      if (record.refId) {
        await db
          .update(adWindows)
          .set({ status: "paid" })
          .where(
            and(
              eq(adWindows.adId, record.refId),
              eq(adWindows.status, "reserved"),
            ),
          );

        await db
          .update(advertisements)
          .set({ status: "approved", updatedAt: new Date() })
          .where(eq(advertisements.id, record.refId));
      }

      // Send payment success Eitaa message (fire-and-forget, best-effort)
      if (record.userId) {
        db.select({ eitaaId: users.eitaaId })
          .from(users)
          .where(eq(users.id, record.userId))
          .limit(1)
          .then(([user]) => {
            if (user?.eitaaId) {
              const amountTomans = Math.floor(record.amountRials / 10);
              sendMessage(user.eitaaId, paymentSuccessMessage(amountTomans, orderId));
            }
          })
          .catch(() => { /* fire-and-forget */ });
      }

      return res.redirect(
        `${frontendBase}/advertise?payment=success&orderId=${orderId}`,
      );
    } else {
      await db
        .update(payments)
        .set({
          status: "failed",
          verificationPayload: verification as unknown as Record<string, unknown>,
        })
        .where(eq(payments.orderId, orderId));

      // Send payment failed Eitaa message (fire-and-forget, best-effort)
      if (record.userId) {
        db.select({ eitaaId: users.eitaaId })
          .from(users)
          .where(eq(users.id, record.userId))
          .limit(1)
          .then(([user]) => {
            if (user?.eitaaId) {
              sendMessage(user.eitaaId, paymentFailedMessage(orderId));
            }
          })
          .catch(() => { /* fire-and-forget */ });
      }

      return res.redirect(`${frontendBase}/advertise?payment=failed`);
    }
  } catch (err) {
    logger.error({ err }, "ads/callback error");
    return res.redirect(`${frontendBase}/advertise?payment=failed`);
  }
});

// ── GET /status/:orderId ──────────────────────────────────────────────────────

router.get("/status/:orderId", async (req, res) => {
  try {
    const [record] = await db
      .select({ status: payments.status })
      .from(payments)
      .where(
        and(eq(payments.orderId, req.params.orderId), eq(payments.type, "ad")),
      )
      .limit(1);

    if (!record) return res.status(404).json({ error: "not_found" });
    return res.json({ status: record.status });
  } catch (err) {
    logger.error({ err }, "ads/status error");
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /ad-terms ─────────────────────────────────────────────────────────────
// Returns whether the authenticated user has already accepted the Ads ToS.

router.get("/ad-terms", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const [row] = await db
      .select({ id: userAdTermsAcceptance.id })
      .from(userAdTermsAcceptance)
      .where(eq(userAdTermsAcceptance.userId, req.userId!))
      .limit(1);
    return res.json({ accepted: !!row });
  } catch (err) {
    logger.error({ err }, "ads/ad-terms GET error");
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /ad-terms ────────────────────────────────────────────────────────────
// Records that the authenticated user has accepted the Ads ToS.
// Idempotent — calling it again after acceptance is a no-op.

router.post("/ad-terms", requireAuth, async (req: AuthedRequest, res) => {
  try {
    // Idempotent upsert: only insert if no row exists yet
    const [existing] = await db
      .select({ id: userAdTermsAcceptance.id })
      .from(userAdTermsAcceptance)
      .where(eq(userAdTermsAcceptance.userId, req.userId!))
      .limit(1);

    if (!existing) {
      await db
        .insert(userAdTermsAcceptance)
        .values({ userId: req.userId! });
    }

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "ads/ad-terms POST error");
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /current ──────────────────────────────────────────────────────────────
// Returns the approved advertisement for the current Iran time window.
// Falls back to a random custom default ad when no paid ad is running.

router.get("/current", async (_req, res) => {
  try {
    const todayStr = todayIranString();
    const slot = currentSlot();

    const rows = await db
      .select({
        channelLink: advertisements.channelLink,
        channelName: advertisements.channelName,
        adText:      advertisements.adText,
        adImage:     advertisements.adImage,
      })
      .from(adWindows)
      .innerJoin(
        advertisements,
        eq(adWindows.adId, advertisements.id),
      )
      .where(
        and(
          eq(adWindows.windowDate, todayStr),
          eq(adWindows.windowSlot, slot),
          eq(adWindows.status, "paid"),
          eq(advertisements.status, "approved"),
        ),
      )
      .limit(1);

    if (rows.length > 0) {
      return res.json({ ad: rows[0] });
    }

    // No paid ad — return the admin-selected fallback.
    try {
      const configRows = await db
        .select({ value: pricingConfig.value })
        .from(pricingConfig)
        .where(inArray(pricingConfig.key, ["active_default_ad", "default_custom_ads"]));
      const active = String(configRows.find((r: { value: unknown }) => r.value && typeof r.value === "string")?.value ?? DEFAULT_PRICING.active_default_ad);
      const defaultsValue = configRows.find((r: { value: unknown }) => Array.isArray(r.value))?.value;
      const customDefaults = (defaultsValue as Array<{
        channelName: string; channelLink: string; adText: string; adImage: string;
      }> ?? []);

      if (active === "built_in_donation") {
        return res.json({ ad: null, defaultKind: "donation_promo", source: "built_in_default" });
      }
      if (active.startsWith("custom:")) {
        const index = Number(active.slice("custom:".length));
        if (Number.isInteger(index) && customDefaults[index]) {
          return res.json({ ad: customDefaults[index], source: "custom_default" });
        }
      }
      return res.json({ ad: null, defaultKind: "promo", source: "built_in_default" });
    } catch { /* pricingConfig unavailable */ }

    return res.json({ ad: null, defaultKind: "promo", source: "built_in_default" });
  } catch (err) {
    logger.error({ err }, "ads/current error");
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;

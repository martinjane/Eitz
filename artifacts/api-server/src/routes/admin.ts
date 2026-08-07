/**
 * Administrator panel routes — all require the authenticated user to be "dev_user".
 *
 * Channel verifications:
 *   GET  /api/admin/channels              — list all pending channel verifications
 *   POST /api/admin/channels/:id/approve  — approve a channel verification
 *   POST /api/admin/channels/:id/reject   — reject with optional note
 *
 * Advertisement review:
 *   GET  /api/admin/ads                   — list all pending_review advertisements
 *   POST /api/admin/ads/:id/approve       — approve an advertisement
 *   POST /api/admin/ads/:id/reject        — reject with optional note
 *
 * Pricing:
 *   GET  /api/admin/pricing               — get all pricing config values
 *   POST /api/admin/pricing               — set/update one or more config values
 */

import { Router } from "express";
import { db, channelVerifications, advertisements, savedAds, pricingConfig, users, adWindows, feedbackReports } from "@workspace/db";
import { eq, inArray, or, and } from "drizzle-orm";
import { requireAdmin } from "../lib/adminAuth";
import { DEFAULT_PRICING } from "../lib/adminAuth";
import type { AuthedRequest } from "../lib/auth";
import { logger } from "../lib/logger";
import { adminActionLimiter } from "../lib/rateLimiter";

const router = Router();

// All routes under /api/admin require admin auth + rate limit
router.use(requireAdmin as any);
router.use(adminActionLimiter);

router.get("/feedback", async (_req, res) => {
  try {
    const feedback = await db.select().from(feedbackReports).orderBy(feedbackReports.createdAt);
    return res.json({ feedback });
  } catch (err) {
    logger.error({ err }, "admin/feedback error");
    return res.status(500).json({ error: "internal_error" });
  }
});

router.delete("/feedback/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "invalid_id" });
  try {
    const deleted = await db.delete(feedbackReports)
      .where(eq(feedbackReports.id, id))
      .returning({ id: feedbackReports.id });
    if (!deleted.length) return res.status(404).json({ error: "not_found" });
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin/feedback/delete error");
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── Channel verifications ─────────────────────────────────────────────────────

router.get("/channels", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id:               channelVerifications.id,
        userId:           channelVerifications.userId,
        username:         users.username,
        channelUsername:  channelVerifications.channelUsername,
        channelLink:      channelVerifications.channelLink,
        verificationCode: channelVerifications.verificationCode,
        status:           channelVerifications.status,
        reviewNote:       channelVerifications.reviewNote,
        submittedAt:      channelVerifications.submittedAt,
        reviewedAt:       channelVerifications.reviewedAt,
      })
      .from(channelVerifications)
      .innerJoin(users, eq(channelVerifications.userId, users.id))
      .orderBy(channelVerifications.submittedAt);

    return res.json({ channels: rows });
  } catch (err) {
    logger.error({ err }, "admin/channels error");
    return res.status(500).json({ error: "internal_error" });
  }
});

router.post("/channels/:id/approve", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid_id" });

  try {
    const [updated] = await db
      .update(channelVerifications)
      .set({ status: "approved", reviewedAt: new Date() })
      .where(eq(channelVerifications.id, id))
      .returning({ id: channelVerifications.id });

    if (!updated) return res.status(404).json({ error: "not_found" });
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin/channels/approve error");
    return res.status(500).json({ error: "internal_error" });
  }
});

router.post("/channels/:id/reject", async (req, res) => {
  const id = Number(req.params.id);
  const note = String(req.body?.note ?? "");
  if (!id) return res.status(400).json({ error: "invalid_id" });

  try {
    const [updated] = await db
      .update(channelVerifications)
      .set({ status: "rejected", reviewNote: note || null, reviewedAt: new Date() })
      .where(eq(channelVerifications.id, id))
      .returning({ id: channelVerifications.id });

    if (!updated) return res.status(404).json({ error: "not_found" });
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin/channels/reject error");
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── Advertisement content review (saved_ads: draft → content_approved/rejected) ──

router.get("/ads", async (_req, res) => {
  try {
    // Show user ads awaiting review and approved ads available for admin removal,
    // plus legacy pending_review advertisements.
    const saved = await db
      .select({
        id:          savedAds.id,
        channelLink: savedAds.channelLink,
        channelName: savedAds.channelName,
        adText:      savedAds.adText,
        adImage:     savedAds.adImage,
        status:      savedAds.status,
        reviewNote:  savedAds.reviewNote,
        createdAt:   savedAds.createdAt,
        _source:     savedAds.id,  // dummy to distinguish source
      })
      .from(savedAds)
      .where(inArray(savedAds.status, ["draft", "content_approved"]))
      .orderBy(savedAds.createdAt);

    const legacy = await db
      .select()
      .from(advertisements)
      .where(eq(advertisements.status, "pending_review"))
      .orderBy(advertisements.createdAt);

    return res.json({ ads: saved, legacyAds: legacy });
  } catch (err) {
    logger.error({ err }, "admin/ads error");
    return res.status(500).json({ error: "internal_error" });
  }
});

router.post("/ads/:id/approve", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid_id" });

  try {
    const [updated] = await db
      .update(savedAds)
      .set({ status: "content_approved", updatedAt: new Date() })
      .where(eq(savedAds.id, id))
      .returning({ id: savedAds.id });

    if (!updated) {
      // Fallback: try legacy advertisements table
      const [legacyUpdated] = await db
        .update(advertisements)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(advertisements.id, id))
        .returning({ id: advertisements.id });
      if (!legacyUpdated) return res.status(404).json({ error: "not_found" });
    }
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin/ads/approve error");
    return res.status(500).json({ error: "internal_error" });
  }
});

router.post("/ads/:id/reject", async (req, res) => {
  const id = Number(req.params.id);
  const note = String(req.body?.note ?? "");
  if (!id) return res.status(400).json({ error: "invalid_id" });

  try {
    const [updated] = await db
      .update(savedAds)
      .set({ status: "content_rejected", reviewNote: note || null, updatedAt: new Date() })
      .where(eq(savedAds.id, id))
      .returning({ id: savedAds.id });

    if (!updated) {
      // Fallback: legacy advertisements table
      const [legacyUpdated] = await db
        .update(advertisements)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(eq(advertisements.id, id))
        .returning({ id: advertisements.id });
      if (!legacyUpdated) return res.status(404).json({ error: "not_found" });
    }
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin/ads/reject error");
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── Pricing ───────────────────────────────────────────────────────────────────

router.get("/pricing", async (_req, res) => {
  try {
    const rows = await db.select().from(pricingConfig);

    // Merge DB values over defaults
    const result = { ...DEFAULT_PRICING } as Record<string, unknown>;
    for (const row of rows) {
      result[row.key] = row.value;
    }

    return res.json({ pricing: result });
  } catch (err) {
    logger.error({ err }, "admin/pricing GET error");
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * Body: partial pricing object — only keys provided are updated.
 */
router.post("/pricing", async (req, res) => {
  const VALID_KEYS = new Set([
    "donation_presets",
    "donation_monthly_target_tomans",
    "slot_0_price_tomans",
    "slot_1_price_tomans",
    "slot_2_price_tomans",
    "slot_3_price_tomans",
    "ad_submissions_disabled",
    "default_custom_ads",
    "active_default_ad",
  ]);

  const body = req.body as Record<string, unknown>;
  const entries = Object.entries(body).filter(([k]) => VALID_KEYS.has(k));

  if (entries.length === 0) {
    return res.status(400).json({ error: "no_valid_keys" });
  }

  // Validate types
  for (const [key, val] of entries) {
    if (key === "donation_presets") {
      if (!Array.isArray(val) || val.some((v) => typeof v !== "number" || v <= 0)) {
        return res.status(400).json({ error: "invalid_donation_presets" });
      }
    } else if (key === "ad_submissions_disabled") {
      if (typeof val !== "boolean") {
        return res.status(400).json({ error: "invalid_ad_submissions_disabled" });
      }
    } else if (key === "default_custom_ads") {
      if (!Array.isArray(val)) {
        return res.status(400).json({ error: "invalid_default_custom_ads" });
      }
      for (const item of val as any[]) {
        if (!item?.channelName || !item?.channelLink || !item?.adText || !item?.adImage) {
          return res.status(400).json({ error: "invalid_default_custom_ads_item" });
        }
      }
    } else if (key === "active_default_ad") {
      if (typeof val !== "string" || !/^(built_in_promo|built_in_donation|custom:\d+)$/.test(val)) {
        return res.status(400).json({ error: "invalid_active_default_ad" });
      }
    } else {
      const n = Number(val);
      if (!n || n <= 0) {
        return res.status(400).json({ error: `invalid_${key}` });
      }
    }
  }

  try {
    const now = new Date();
    for (const [key, value] of entries) {
      await db
        .insert(pricingConfig)
        .values({ key, value: value as any, updatedAt: now })
        .onConflictDoUpdate({ target: pricingConfig.key, set: { value: value as any, updatedAt: now } });
    }

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin/pricing POST error");
    return res.status(500).json({ error: "internal_error" });
  }
});

// Remove an owned channel. Approved channels can be removed only by admins.
router.delete("/channels/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "invalid_id" });
  try {
    const [row] = await db.select({ id: channelVerifications.id, status: channelVerifications.status })
      .from(channelVerifications).where(eq(channelVerifications.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: "not_found" });
    if (row.status !== "approved") {
      return res.status(409).json({ error: "not_approved", message: "فقط کانال‌های تأییدشده قابل حذف ادمین هستند" });
    }
    await db.delete(channelVerifications).where(eq(channelVerifications.id, id));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin/channels/delete error");
    return res.status(500).json({ error: "internal_error" });
  }
});

// Remove approved saved/legacy ads, but never orphan a reserved or paid booking.
router.delete("/ads/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "invalid_id" });
  try {
    const [saved] = await db.select({ id: savedAds.id, status: savedAds.status })
      .from(savedAds).where(eq(savedAds.id, id)).limit(1);
    if (saved) {
      if (saved.status !== "content_approved") {
        return res.status(409).json({ error: "not_approved", message: "فقط آگهی‌های تأییدشده قابل حذف ادمین هستند" });
      }
      const linked = await db.select({ id: advertisements.id })
        .from(advertisements).where(and(eq(advertisements.savedAdId, id), inArray(advertisements.status, ["pending_payment", "approved"]))).limit(1);
      if (linked.length) return res.status(409).json({ error: "has_bookings", message: "این آگهی دارای رزرو یا نمایش فعال است و قابل حذف نیست" });
      await db.delete(savedAds).where(eq(savedAds.id, id));
      return res.json({ ok: true });
    }

    const [legacy] = await db.select({ id: advertisements.id, status: advertisements.status })
      .from(advertisements).where(eq(advertisements.id, id)).limit(1);
    if (!legacy) return res.status(404).json({ error: "not_found" });
    if (legacy.status !== "approved") return res.status(409).json({ error: "not_approved" });
    const booked = await db.select({ id: adWindows.id }).from(adWindows)
      .where(and(eq(adWindows.adId, id), inArray(adWindows.status, ["reserved", "paid"]))).limit(1);
    if (booked.length) return res.status(409).json({ error: "has_bookings", message: "این آگهی دارای رزرو یا نمایش فعال است و قابل حذف نیست" });
    await db.delete(advertisements).where(eq(advertisements.id, id));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin/ads/delete error");
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;

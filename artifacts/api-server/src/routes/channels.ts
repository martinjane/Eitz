/**
 * Channel verification routes (user-facing)
 *
 * GET  /api/channels/mine          — list current user's channel verifications
 * POST /api/channels/submit        — submit a new channel for verification
 */

import { Router } from "express";
import { randomBytes } from "node:crypto";
import { db, channelVerifications, users } from "@workspace/db";
import { eq, or, and, count } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { logger } from "../lib/logger";
import { channelSubmitLimiter, generalReadLimiter } from "../lib/rateLimiter";

const router = Router();

// ── GET /mine ─────────────────────────────────────────────────────────────────

router.get("/mine", requireAuth, generalReadLimiter, async (req: AuthedRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(channelVerifications)
      .where(eq(channelVerifications.userId, req.userId!))
      .orderBy(channelVerifications.submittedAt);

    return res.json({ channels: rows });
  } catch (err) {
    logger.error({ err }, "channels/mine error");
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /submit ──────────────────────────────────────────────────────────────

/**
 * Body: { channelUsername: string }  (just the part after eitaa.com/)
 */
router.post("/submit", requireAuth, channelSubmitLimiter, async (req: AuthedRequest, res) => {
  const { channelUsername } = req.body as { channelUsername?: string };

  if (!channelUsername || typeof channelUsername !== "string") {
    return res.status(400).json({
      error: "invalid_username",
      message: "نام کاربری کانال الزامی است",
    });
  }

  // Only allow valid Eitaa channel usernames
  if (!/^[a-zA-Z0-9_]{3,64}$/.test(channelUsername)) {
    return res.status(400).json({
      error: "invalid_username",
      message: "نام کاربری کانال نامعتبر است (۳ تا ۶۴ کاراکتر، حروف انگلیسی، اعداد یا زیرخط)",
    });
  }

  const channelLink = `https://eitaa.com/${channelUsername}`;

  try {
    // Enforce max 10 channels per user
    const [countRow] = await db
      .select({ total: count() })
      .from(channelVerifications)
      .where(eq(channelVerifications.userId, req.userId!));
    if ((countRow?.total ?? 0) >= 10) {
      return res.status(409).json({ error: "limit_reached", message: "حداکثر ۱۰ کانال برای هر حساب کاربری مجاز است" });
    }

    // Check if this channel is already claimed (pending or approved by anyone)
    const [existing] = await db
      .select({ id: channelVerifications.id })
      .from(channelVerifications)
      .where(
        and(
          eq(channelVerifications.channelUsername, channelUsername),
          or(
            eq(channelVerifications.status, "pending"),
            eq(channelVerifications.status, "approved"),
          ),
        ),
      )
      .limit(1);

    if (existing) {
      return res.status(409).json({
        error: "channel_already_claimed",
        message: "این کانال قبلاً توسط یک حساب کاربری ثبت شده است",
      });
    }

    // Generate a unique 8-char alphanumeric verification code
    const verificationCode = randomBytes(4).toString("hex").toUpperCase();

    const [created] = await db
      .insert(channelVerifications)
      .values({
        userId: req.userId!,
        channelUsername,
        channelLink,
        verificationCode,
        status: "pending",
      })
      .returning();

    return res.json({ channel: created });
  } catch (err) {
    logger.error({ err }, "channels/submit error");
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
// Cancel a pending channel verification (only the owner, only if still pending).

router.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isInteger(id)) {
    return res.status(400).json({ error: "invalid_id" });
  }

  try {
    const [row] = await db
      .select({ id: channelVerifications.id, status: channelVerifications.status, userId: channelVerifications.userId })
      .from(channelVerifications)
      .where(eq(channelVerifications.id, id))
      .limit(1);

    if (!row) return res.status(404).json({ error: "not_found" });
    if (row.userId !== req.userId) return res.status(403).json({ error: "forbidden" });
    if (row.status !== "pending") {
      return res.status(409).json({ error: "not_cancellable", message: "فقط درخواست‌های در انتظار قابل لغو هستند" });
    }

    await db.delete(channelVerifications).where(eq(channelVerifications.id, id));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "channels/delete error");
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;

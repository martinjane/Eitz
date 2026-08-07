import { Router } from "express";
import { db, feedbackReports } from "@workspace/db";
import { feedbackSubmitLimiter } from "../lib/rateLimiter";
import { logger } from "../lib/logger";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router = Router();

router.post("/", requireAuth, feedbackSubmitLimiter, async (req: AuthedRequest, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) return res.status(400).json({ error: "message_required", message: "متن بازخورد را وارد کنید." });
  if (message.length > 200) return res.status(400).json({ error: "message_too_long", message: "متن بازخورد حداکثر ۲۰۰ کاراکتر است." });

  try {
    await db.insert(feedbackReports).values({
      message,
      username: req.username!,
      userId: req.userId ?? undefined,
    });
    return res.status(201).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "feedback/create error");
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
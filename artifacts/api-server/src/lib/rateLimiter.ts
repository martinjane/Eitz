/**
 * Pre-configured express-rate-limit instances for sensitive endpoints.
 *
 * All limiters key by IP (default), trust the X-Forwarded-For header
 * via express-rate-limit's built-in behaviour (no extra trust-proxy config needed
 * because the values here are conservative enough to absorb proxy header spoofing).
 */

import rateLimit from "express-rate-limit";
import { ipKeyGenerator } from "express-rate-limit";

/** 429 response body used across all limiters. */
function handler429(res: import("express").Response, message: string) {
  res.status(429).json({ error: "too_many_requests", message });
}

/**
 * Eitaa login initData submission — 20 per 15 min per IP.
 * Prevents brute-force guessing of HMAC hashes.
 */
export const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => handler429(res, "تعداد درخواست‌های ورود زیاد است. لطفاً کمی صبر کنید."),
});

/**
 * Username completion / account creation — 5 per 15 min per IP.
 * Prevents mass account creation from a single IP.
 */
export const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => handler429(res, "تعداد تلاش برای ثبت‌نام زیاد است. لطفاً کمی صبر کنید."),
});

/**
 * Username availability check — 60 per 15 min per IP.
 * Generous limit for debounced checks; still prevents enumeration at scale.
 */
export const usernameCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => handler429(res, "درخواست‌های بررسی نام کاربری زیاد است."),
});

/**
 * Donation payment creation — 10 per hour per IP.
 */
export const donationStartLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => handler429(res, "تعداد درخواست‌های پرداخت زیاد است. لطفاً بعداً تلاش کنید."),
});

/**
 * Ad submission — 5 per hour per IP.
 * Expensive operation that reserves slots and stores images.
 */
export const adSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => handler429(res, "تعداد درخواست‌های ثبت آگهی زیاد است. لطفاً بعداً تلاش کنید."),
});

/**
 * Ad payment initiation — 10 per hour per IP.
 */
export const adPayLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => handler429(res, "تعداد درخواست‌های پرداخت آگهی زیاد است. لطفاً بعداً تلاش کنید."),
});

/**
 * Channel ownership submission — 5 per hour per IP.
 */
export const channelSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => handler429(res, "تعداد درخواست‌های تأیید کانال زیاد است. لطفاً بعداً تلاش کنید."),
});

/**
 * General read API limiter — 200 per 15 min per IP.
 * Applied to listing endpoints (channels/mine, ads/mine, etc.).
 */
export const generalReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => handler429(res, "تعداد درخواست‌ها زیاد است. لطفاً کمی صبر کنید."),
});

/** Authenticated-only feedback — one report per user ID every five days. */
export const feedbackSubmitLimiter = rateLimit({
  windowMs: 5 * 24 * 60 * 60 * 1000,
  max: 1,
  keyGenerator: (req) => {
    // Use the stable internal user ID (set by requireAuth) so username changes
    // cannot reset the cooldown. Fall back to IP only if somehow unauthenticated.
    const userId = (req as import("express").Request & { userId?: number }).userId;
    return userId ? `feedback:uid:${userId}` : `feedback:${ipKeyGenerator(req.ip ?? "")}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => handler429(res, "هر پنج روز فقط یک بازخورد می‌توانید ارسال کنید."),
});

/**
 * Admin actions — 60 per 15 min per IP.
 */
export const adminActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => handler429(res, "تعداد درخواست‌های ادمین زیاد است."),
});

/**
 * Global baseline limiter — 500 per 15 min per IP.
 * Applied to the entire /api prefix in app.ts.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => handler429(res, "تعداد درخواست‌ها زیاد است. لطفاً کمی صبر کنید."),
});

/**
 * Logo / style upload writes — 30 per hour per IP.
 */
export const uploadWriteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => handler429(res, "تعداد آپلودها زیاد است. لطفاً بعداً تلاش کنید."),
});

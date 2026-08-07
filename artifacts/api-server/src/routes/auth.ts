import { Router } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthedRequest, JWT_SECRET } from "../lib/auth";
import {
  authLoginLimiter,
  signupLimiter,
  usernameCheckLimiter,
} from "../lib/rateLimiter";

const router = Router();
/** 30-day session tokens. */
const SESSION_TTL = "30d";
/** 10-minute temp token (holds Eitaa profile while user picks a username). */
const TEMP_TTL = "10m";

// In production, EITAA_BOT_TOKEN is required. Without it the hash check is
// skipped, meaning anyone can forge initData and log in as any Eitaa user.
if (!process.env.EITAA_BOT_TOKEN && process.env.NODE_ENV === "production") {
  throw new Error(
    "[auth] EITAA_BOT_TOKEN is required in production. " +
    "Set it to your Eitaa bot token before starting the server.",
  );
}

// ── Hash verification ─────────────────────────────────────────────────────────
// Eitaa WebApp uses the same HMAC-SHA256 scheme as Telegram WebApp:
//   secret_key  = HMAC-SHA256("WebAppData", bot_token)
//   check_string = sorted key=value pairs (excluding hash), joined by \n
//   expected_hash = HMAC-SHA256(check_string, secret_key)
function verifyInitData(initData: string, botToken: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const providedHash = params.get("hash");
    if (!providedHash) return false;
    params.delete("hash");
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    return computed === providedHash;
  } catch {
    return false;
  }
}

// ── Parse user from initData ──────────────────────────────────────────────────
interface EitaaRawUser {
  id: string | number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface ParsedInitData {
  eitaaId: string;
  firstName: string | null;
  lastName: string | null;
  deviceId: string | null;
}

function parseInitData(initData: string): ParsedInitData | null {
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get("user");
    if (!userStr) return null;
    const raw: EitaaRawUser = JSON.parse(decodeURIComponent(userStr));
    if (!raw.id) return null;
    return {
      eitaaId:   String(raw.id),
      firstName: raw.first_name ?? null,
      lastName:  raw.last_name  ?? null,
      deviceId:  params.get("device_id") ?? null,
    };
  } catch {
    return null;
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/eitaa
 * Body: { initData: string }
 *
 * Verifies the Eitaa WebApp initData hash.
 * Returns:
 *   { status: "ok",               token, user }       — known user, session issued
 *   { status: "needs_username",   tempToken, eitaaUser } — new user, must pick a username
 */
router.post("/eitaa", authLoginLimiter, async (req, res) => {
  const { initData } = req.body as { initData?: string };
  if (!initData || typeof initData !== "string") {
    return res.status(400).json({ error: "initData_required" });
  }

  const botToken = process.env.EITAA_BOT_TOKEN;
  if (botToken) {
    if (!verifyInitData(initData, botToken)) {
      return res.status(401).json({ error: "invalid_hash", message: "بررسی امنیتی داده‌های ورود ناموفق بود" });
    }
  } else {
    // Dev / testing mode — skip hash check but warn loudly
    console.warn("[auth] EITAA_BOT_TOKEN not set — hash verification skipped (dev mode only)");
  }

  const parsed = parseInitData(initData);
  if (!parsed) {
    return res.status(400).json({ error: "cannot_parse_user", message: "اطلاعات کاربر یافت نشد" });
  }

  const { eitaaId, firstName, lastName, deviceId } = parsed;

  // Known user → session token
  const [existing] = await db.select().from(users).where(eq(users.eitaaId, eitaaId)).limit(1);
  if (existing) {
    const token = jwt.sign(
      { type: "session", userId: existing.id, eitaaId },
      JWT_SECRET,
      { expiresIn: SESSION_TTL }
    );
    return res.json({
      status: "ok",
      token,
      user: { id: existing.id, username: existing.username, firstName: existing.firstName, lastName: existing.lastName },
    });
  }

  // New user → temp token
  const tempToken = jwt.sign(
    { type: "temp", eitaaId, firstName, lastName, deviceId },
    JWT_SECRET,
    { expiresIn: TEMP_TTL }
  );
  return res.json({
    status: "needs_username",
    tempToken,
    eitaaUser: { id: eitaaId, firstName, lastName },
  });
});

/**
 * POST /api/auth/complete-signup
 * Body: { tempToken: string, username: string, tosAccepted: boolean }
 *
 * Validates username, records ToS acceptance, creates the user, returns a session token.
 */
router.post("/complete-signup", signupLimiter, async (req, res) => {
  const { tempToken, username, tosAccepted } = req.body as {
    tempToken?: string;
    username?: string;
    tosAccepted?: unknown;
  };

  if (!tempToken || !username) {
    return res.status(400).json({ error: "missing_fields" });
  }

  // ToS acceptance is mandatory — must be explicitly true
  if (tosAccepted !== true) {
    return res.status(400).json({
      error: "tos_not_accepted",
      message: "برای ادامه باید شرایط استفاده را بپذیرید",
    });
  }

  // Normalize: lowercase, trim
  const normalizedUsername = username.trim().toLowerCase();

  // Username format: 3–16 chars, lowercase letters / digits / underscore
  if (!/^[a-z0-9_]{3,16}$/.test(normalizedUsername)) {
    return res.status(400).json({
      error: "invalid_username",
      message: "نام کاربری باید ۳ تا ۱۶ کاراکتر، شامل حروف انگلیسی کوچک، اعداد یا زیرخط باشد",
    });
  }

  // Verify temp token
  let payload: { type: string; eitaaId: string; firstName: string | null; lastName: string | null; deviceId: string | null };
  try {
    payload = jwt.verify(tempToken, JWT_SECRET) as typeof payload;
  } catch {
    return res.status(401).json({ error: "expired_token", message: "لینک منقضی شده، لطفاً مجدداً وارد شوید" });
  }
  if (payload.type !== "temp") {
    return res.status(401).json({ error: "invalid_token" });
  }

  const { eitaaId, firstName, lastName, deviceId } = payload;

  // Username taken?
  const [byUsername] = await db.select({ id: users.id }).from(users).where(eq(users.username, normalizedUsername)).limit(1);
  if (byUsername) {
    return res.status(409).json({ error: "username_taken", message: "این نام کاربری قبلاً انتخاب شده است" });
  }

  // Race-condition guard: Eitaa ID already registered?
  const [byEitaa] = await db.select().from(users).where(eq(users.eitaaId, eitaaId)).limit(1);
  if (byEitaa) {
    const token = jwt.sign({ type: "session", userId: byEitaa.id, eitaaId }, JWT_SECRET, { expiresIn: SESSION_TTL });
    return res.json({
      status: "ok",
      token,
      user: { id: byEitaa.id, username: byEitaa.username, firstName: byEitaa.firstName, lastName: byEitaa.lastName },
    });
  }

  // Create user — record ToS acceptance timestamp
  const [newUser] = await db
    .insert(users)
    .values({
      eitaaId,
      username: normalizedUsername,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      deviceId: deviceId ?? null,
      tosAcceptedAt: new Date(),
    })
    .returning();

  const token = jwt.sign({ type: "session", userId: newUser.id, eitaaId }, JWT_SECRET, { expiresIn: SESSION_TTL });
  return res.json({
    status: "ok",
    token,
    user: { id: newUser.id, username: newUser.username, firstName: newUser.firstName, lastName: newUser.lastName },
  });
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 *
 * Returns the current user or 401.
 */
router.get("/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "no_token" });
  }
  let payload: { type: string; userId: number; eitaaId: string };
  try {
    payload = jwt.verify(auth.slice(7), JWT_SECRET) as typeof payload;
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
  if (payload.type !== "session") {
    return res.status(401).json({ error: "invalid_token" });
  }

  const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
  if (!user) {
    return res.status(401).json({ error: "user_not_found" });
  }
  return res.json({ user: { id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName } });
});

/**
 * PATCH /api/auth/me
 * Header: Authorization: Bearer <token>
 * Body: { username: string }
 *
 * Updates the authenticated user's username.
 */
router.patch("/me", requireAuth, async (req: AuthedRequest, res) => {
  const raw = (req.body as { username?: string }).username;
  if (!raw) {
    return res.status(400).json({ error: "missing_fields" });
  }
  const username = raw.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,16}$/.test(username)) {
    return res.status(400).json({
      error: "invalid_username",
      message: "نام کاربری باید ۳ تا ۱۶ کاراکتر، شامل حروف انگلیسی کوچک، اعداد یا زیرخط باشد",
    });
  }

  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (taken && taken.id !== req.userId) {
    return res.status(409).json({ error: "username_taken", message: "این نام کاربری قبلاً انتخاب شده است" });
  }

  const [updated] = await db
    .update(users)
    .set({ username, updatedAt: new Date() })
    .where(eq(users.id, req.userId!))
    .returning();

  return res.json({ user: { id: updated.id, username: updated.username, firstName: updated.firstName, lastName: updated.lastName } });
});

/**
 * GET /api/auth/check-username/:username
 * Returns { available: boolean, reason?: string }
 */
router.get("/check-username/:username", usernameCheckLimiter, async (req, res) => {
  const username = String(req.params.username).toLowerCase();
  if (!/^[a-z0-9_]{3,16}$/.test(username)) {
    return res.json({ available: false, reason: "invalid_format" });
  }
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  return res.json({ available: !row });
});

/**
 * GET /api/auth/dev-session
 *
 * Development only — automatically creates and returns a session for the
 * dev_user account (or whatever ADMIN_USERNAME is set to). This endpoint
 * is completely blocked in production (NODE_ENV === "production").
 *
 * This is the replacement for the Eitaa SDK login flow during local
 * development so the app can be tested without an Eitaa bot token.
 */
router.get("/dev-session", async (_req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "not_found" });
  }

  const devUsername = process.env.ADMIN_USERNAME ?? "dev_user";
  const devEitaaId  = `dev_${devUsername}`;

  try {
    // Find or auto-create the dev user
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, devUsername))
      .limit(1);

    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          eitaaId:       devEitaaId,
          username:      devUsername,
          firstName:     "Dev",
          lastName:      "User",
          tosAcceptedAt: new Date(),
        })
        .returning();
    }

    const token = jwt.sign(
      { type: "session", userId: user.id, eitaaId: user.eitaaId },
      JWT_SECRET,
      { expiresIn: SESSION_TTL },
    );

    return res.json({
      status: "ok",
      token,
      user: {
        id:        user.id,
        username:  user.username,
        firstName: user.firstName,
        lastName:  user.lastName,
      },
    });
  } catch (err) {
    console.error("[dev-session] error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /api/auth/logout
 * Stateless — just tells the client to clear its token.
 */
router.post("/logout", (_req, res) => {
  res.json({ ok: true });
});

export default router;

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";

const rawSecret = process.env.SESSION_SECRET;

// In production, a missing SESSION_SECRET is a critical misconfiguration.
// In development it falls back to a well-known weak default so the server
// can still start without manually setting the secret.
if (!rawSecret && process.env.NODE_ENV === "production") {
  throw new Error(
    "[auth] SESSION_SECRET environment variable is required in production. " +
    "Set it to a long random string before starting the server.",
  );
}

export const JWT_SECRET = rawSecret ?? "dev-secret-please-set-SESSION_SECRET";

export interface AuthedRequest extends Request {
  userId?: number;
  username?: string;
}

/**
 * Express middleware — requires a valid `Authorization: Bearer <token>` session
 * token. Attaches `req.userId` on success, otherwise responds 401.
 */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "no_token" });
  }
  let payload: { type: string; userId: number };
  try {
    payload = jwt.verify(auth.slice(7), JWT_SECRET) as typeof payload;
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
  if (payload.type !== "session") {
    return res.status(401).json({ error: "invalid_token" });
  }
  const [user] = await db.select({ id: users.id, username: users.username }).from(users).where(eq(users.id, payload.userId)).limit(1);
  if (!user) {
    return res.status(401).json({ error: "user_not_found" });
  }
  req.userId = user.id;
  req.username = user.username;
  return next();
}

/**
 * Backend-only switch controlling whether authentication is required to use
 * the app. This must never be exposed as a UI-editable setting — it is
 * controlled solely via the AUTH_REQUIRED environment variable.
 */
export function isAuthRequired(): boolean {
  return process.env.AUTH_REQUIRED === "true";
}

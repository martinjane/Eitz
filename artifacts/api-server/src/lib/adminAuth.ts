import type { Response, NextFunction } from "express";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "./auth";

const rawAdminUsername = process.env.ADMIN_USERNAME;

if (!rawAdminUsername && process.env.NODE_ENV === "production") {
  throw new Error(
    "[adminAuth] ADMIN_USERNAME environment variable is required in production. " +
    "Set it to the username of the administrator account before starting the server.",
  );
}

// In development, fall back to "dev_user" so the automatically-created dev
// session immediately has admin access without any extra configuration.
// In production, rawAdminUsername is always set (the check above would have
// thrown otherwise), so this fallback is never reached there.
export const ADMIN_USERNAME = rawAdminUsername ?? "dev_user";

/**
 * Express middleware — requires a valid session (via requireAuth) AND
 * the authenticated user's username must be exactly ADMIN_USERNAME.
 * Responds 401 if not authenticated, 403 if not admin.
 */
export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  // First validate JWT
  await new Promise<void>((resolve) => requireAuth(req, res, () => resolve()));
  if (res.headersSent) return; // requireAuth already responded with 401

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, req.userId!))
    .limit(1);

  if (!user || user.username !== ADMIN_USERNAME) {
    return res.status(403).json({ error: "forbidden" });
  }

  return next();
}

/** Helper to get default pricing values */
export const DEFAULT_PRICING = {
  donation_presets: [10_000, 30_000, 50_000, 100_000],
  donation_monthly_target_tomans: 298_000,
  slot_0_price_tomans: 50_000,
  slot_1_price_tomans: 50_000,
  slot_2_price_tomans: 50_000,
  slot_3_price_tomans: 50_000,
  ad_submissions_disabled: false,
  default_custom_ads: [] as Array<{ channelName: string; channelLink: string; adText: string; adImage: string }>,
  active_default_ad: "built_in_promo" as string,
};

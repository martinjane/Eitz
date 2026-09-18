import { Router } from "express";
import jwt from "jsonwebtoken";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isAuthRequired, JWT_SECRET } from "../lib/auth";
import { isTestMode } from "../lib/eitaa";

const router = Router();

/**
 * GET /api/config
 * Minimal bootstrap config the frontend reads on load.
 * - `authRequired` is a backend-only switch (AUTH_REQUIRED env var)
 * - `testMode` tells the frontend whether Eitaa SDK features should be used
 * - `blocked` — in production (TEST_MODE=false), this is true unless the
 *   request carries a valid session token. The only way to obtain such a token
 *   in production is a successful Eitaa WebApp login, so non-Eitaa visitors
 *   are blocked from loading any app assets.
 */
router.get("/", async (req, res) => {
  let blocked = false;

  if (!isTestMode()) {
    // Production: only Eitaa-authenticated sessions may load the app.
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      blocked = true;
    } else {
      try {
        const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { type: string; userId: number };
        if (payload.type !== "session") {
          blocked = true;
        } else {
          const [user] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, payload.userId))
            .limit(1);
          if (!user) blocked = true;
        }
      } catch {
        blocked = true;
      }
    }
  }

  res.json({ authRequired: isAuthRequired(), testMode: isTestMode(), blocked });
});

export default router;

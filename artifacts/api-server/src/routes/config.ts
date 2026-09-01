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
 * - `blocked` — when testMode=false, this is true unless the request carries a
 *   valid session token. The frontend uses this to refuse rendering entirely
 *   so non-Eitaa users cannot access or consume any app assets.
 */
router.get("/", async (req, res) => {
  let blocked = false;

  if (!isTestMode()) {
    // In production (TEST_MODE=false), check for a valid session token.
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

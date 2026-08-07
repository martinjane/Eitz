import { Router } from "express";
import { isAuthRequired } from "../lib/auth";

const router = Router();

/**
 * GET /api/config
 * Minimal bootstrap config the frontend reads on load. `authRequired` is a
 * backend-only switch (AUTH_REQUIRED env var) — there is no UI to change it.
 */
router.get("/", (_req, res) => {
  res.json({ authRequired: isAuthRequired() });
});

export default router;

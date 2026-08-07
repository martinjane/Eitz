/**
 * Public pricing endpoint — returns current pricing config for the client.
 *
 * GET /api/pricing
 */

import { Router } from "express";
import { db, pricingConfig } from "@workspace/db";
import { DEFAULT_PRICING } from "../lib/adminAuth";
import { logger } from "../lib/logger";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const rows = await db.select().from(pricingConfig);
    const result = { ...DEFAULT_PRICING } as Record<string, unknown>;
    for (const row of rows) result[row.key] = row.value;
    return res.json({ pricing: result });
  } catch (err) {
    logger.error({ err }, "pricing error");
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;

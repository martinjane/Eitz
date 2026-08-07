import { Router } from "express";
import { db, savedStyles } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { uploadWriteLimiter, generalReadLimiter } from "../lib/rateLimiter";

const router = Router();
const MAX_STYLES_PER_USER = 5;
const MAX_OBJECTS_PER_STYLE = 10;

/** GET /api/saved-styles — list the authenticated user's saved styles. */
router.get("/", requireAuth, generalReadLimiter, async (req: AuthedRequest, res) => {
  const rows = await db
    .select()
    .from(savedStyles)
    .where(eq(savedStyles.userId, req.userId!))
    .orderBy(asc(savedStyles.createdAt));
  res.json({ savedStyles: rows });
});

/**
 * POST /api/saved-styles — create a new saved style.
 * Body: { name: string, data: { objects: Array<...> } }
 * `data.objects` must be an ordered array of at most 10 percentage-based
 * objects, produced by the constrained editor's save flow.
 */
router.post("/", requireAuth, uploadWriteLimiter, async (req: AuthedRequest, res) => {
  const { name, data } = req.body as { name?: string; data?: { objects?: unknown[] } };
  if (!name || !data || !Array.isArray(data.objects)) {
    return res.status(400).json({ error: "missing_fields" });
  }
  if (data.objects.length > MAX_OBJECTS_PER_STYLE) {
    return res.status(400).json({ error: "too_many_objects", message: `حداکثر ${MAX_OBJECTS_PER_STYLE} شیء مجاز است` });
  }

  const existing = await db.select({ id: savedStyles.id }).from(savedStyles).where(eq(savedStyles.userId, req.userId!));
  if (existing.length >= MAX_STYLES_PER_USER) {
    return res.status(409).json({ error: "style_limit_reached", message: "حداکثر ۵ استایل ذخیره‌شده مجاز است. ابتدا یکی را حذف کنید" });
  }

  const [row] = await db
    .insert(savedStyles)
    .values({ userId: req.userId!, name, data })
    .returning();
  return res.status(201).json({ savedStyle: row });
});

/** DELETE /api/saved-styles/:id */
router.delete("/:id", requireAuth, uploadWriteLimiter, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
  const deleted = await db
    .delete(savedStyles)
    .where(and(eq(savedStyles.id, id), eq(savedStyles.userId, req.userId!)))
    .returning({ id: savedStyles.id });
  if (deleted.length === 0) return res.status(404).json({ error: "not_found" });
  return res.json({ ok: true });
});

export default router;

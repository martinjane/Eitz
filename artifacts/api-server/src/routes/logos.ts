import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { db, logos } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { uploadWriteLimiter, generalReadLimiter } from "../lib/rateLimiter";

const router = Router();

/** Explicit MIME-type allowlist — SVG and BMP are excluded on purpose (XSS / risk). */
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("invalid_mime_type"));
    }
  },
});

const MAX_LOGOS_PER_USER = 5;
const MAX_SIZE_BYTES = 500 * 1024;

/** Compress an image buffer under MAX_SIZE_BYTES, preserving quality as much as possible. */
async function compressUnder500kb(buffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (buffer.length <= MAX_SIZE_BYTES) return { buffer, mimeType };

  const isPng = mimeType === "image/png";
  let quality = 90;
  let width: number | undefined;
  let out = buffer;

  for (let attempt = 0; attempt < 8; attempt++) {
    const pipeline = sharp(buffer).resize(width, undefined, { withoutEnlargement: true });
    out = isPng
      ? await pipeline.png({ quality, compressionLevel: 9 }).toBuffer()
      : await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();

    if (out.length <= MAX_SIZE_BYTES) {
      return { buffer: out, mimeType: isPng ? "image/png" : "image/jpeg" };
    }

    if (quality > 40) {
      quality -= 15;
    } else {
      const meta = await sharp(buffer).metadata();
      width = Math.round((width ?? meta.width ?? 1000) * 0.8);
    }
  }

  return { buffer: out, mimeType: isPng ? "image/png" : "image/jpeg" };
}

/** GET /api/logos — list the authenticated user's logos. */
router.get("/", requireAuth, generalReadLimiter, async (req: AuthedRequest, res) => {
  const rows = await db
    .select({ id: logos.id, mimeType: logos.mimeType, size: logos.size, data: logos.data, createdAt: logos.createdAt })
    .from(logos)
    .where(eq(logos.userId, req.userId!))
    .orderBy(asc(logos.createdAt));
  res.json({ logos: rows });
});

/** POST /api/logos — upload a new logo (multipart, field name "logo"). */
router.post("/", requireAuth, uploadWriteLimiter, (req: AuthedRequest, res, next) => {
  upload.single("logo")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: "upload_error", message: err.message });
    }
    if (err) {
      // fileFilter rejection
      return res.status(400).json({ error: "invalid_type", message: "فقط فایل‌های JPEG، PNG، WEBP یا GIF مجاز هستند" });
    }
    return next();
  });
}, async (req: AuthedRequest, res) => {
  const file = (req as typeof req & { file?: Express.Multer.File }).file;
  if (!file) return res.status(400).json({ error: "file_required" });

  // Secondary MIME check after upload (belt-and-suspenders)
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return res.status(400).json({ error: "invalid_type", message: "فقط فایل‌های JPEG، PNG، WEBP یا GIF مجاز هستند" });
  }

  // Validate with sharp — ensure the buffer is actually a decodable image
  try {
    await sharp(file.buffer).metadata();
  } catch {
    return res.status(400).json({ error: "corrupt_image", message: "فایل آپلودشده قابل خواندن نیست" });
  }

  const existing = await db.select({ id: logos.id }).from(logos).where(eq(logos.userId, req.userId!));
  if (existing.length >= MAX_LOGOS_PER_USER) {
    return res.status(409).json({ error: "logo_limit_reached", message: "حداکثر ۵ لوگو مجاز است. ابتدا یکی را حذف کنید" });
  }

  const { buffer, mimeType } = await compressUnder500kb(file.buffer, file.mimetype);
  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const [row] = await db
    .insert(logos)
    .values({ userId: req.userId!, data: dataUrl, mimeType, size: buffer.length })
    .returning({ id: logos.id, mimeType: logos.mimeType, size: logos.size, data: logos.data, createdAt: logos.createdAt });

  return res.status(201).json({ logo: row });
});

/** DELETE /api/logos/:id — remove one of the authenticated user's logos. */
router.delete("/:id", requireAuth, uploadWriteLimiter, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "invalid_id" });
  const deleted = await db
    .delete(logos)
    .where(and(eq(logos.id, id), eq(logos.userId, req.userId!)))
    .returning({ id: logos.id });
  if (deleted.length === 0) return res.status(404).json({ error: "not_found" });
  return res.json({ ok: true });
});

export default router;

import type { Layer, LayerType } from "@/contexts/EditorContext";

export const MAX_STYLE_OBJECTS = 10;

/** Tools allowed while creating/editing a Saved Style. Everything else (e.g. adjustments, blur) is hidden. */
export const ALLOWED_STYLE_TOOLS = new Set([
  "برش", // crop
  "تغییر اندازه", // resize
  "چرخش", // rotate
  "وارونه", // flip
  "متن", // text
  "نقاشی", // paint
  "فیلتر", // filters
  "لوگو", // logo
  "واترمارک", // watermark
  // "تصویر" (picture-in-picture) is intentionally excluded from style mode:
  // overlay images are session-only and cannot be persisted as reusable style objects.
  "کادر", // add frame
  "لایه‌ها", // layers
]);

/**
 * A single object inside a Saved Style, in percentage-based coordinates
 * relative to the source image.
 *
 * Logo objects MUST use `logo_id` (a reference to a persisted logo) instead
 * of embedding raw image data in `src`. Session-only images (from overlay /
 * picture-in-picture) may still use `src` but are flagged as non-persistent.
 */
export type SavedStyleObject = {
  type: LayerType;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  rotation: number;
  opacity: number;
  text?: string;
  fontSizePct?: number; // font size relative to image height
  color?: string;
  fontFamily?: string;
  /** Persistent logo reference. Resolved to a data URL when the style is applied. */
  logo_id?: number;
  /** Session-only image src (not persisted across sessions; absent for logo objects). */
  src?: string;
  shape?: "rect" | "circle";
  fill?: string;
  stroke?: string;
  strokeWidthPct?: number;
};

export type SavedStyleData = {
  objects: SavedStyleObject[];
};

/** Convert the editor's pixel-based layers into the percentage-based Saved Style format. */
export function serializeLayersToStyle(
  layers: Layer[],
  imageWidth: number,
  imageHeight: number,
): SavedStyleData {
  if (!imageWidth || !imageHeight) return { objects: [] };
  const objects: SavedStyleObject[] = layers.slice(0, MAX_STYLE_OBJECTS).map(l => ({
    type: l.type,
    xPct: (l.x / imageWidth) * 100,
    yPct: (l.y / imageHeight) * 100,
    widthPct: (l.width / imageWidth) * 100,
    heightPct: (l.height / imageHeight) * 100,
    rotation: l.rotation,
    opacity: l.opacity,
    text: l.text,
    fontSizePct: l.fontSize != null ? (l.fontSize / imageHeight) * 100 : undefined,
    color: l.color,
    fontFamily: l.fontFamily,
    logo_id: l.logo_id,
    // Only include src for non-logo images (logos always use logo_id)
    src: l.logo_id == null ? l.src : undefined,
    shape: l.shape,
    fill: l.fill,
    stroke: l.stroke,
    strokeWidthPct: l.strokeWidth != null ? (l.strokeWidth / imageHeight) * 100 : undefined,
  }));
  return { objects };
}

/**
 * Convert a Saved Style back into pixel-based layers for a target image size.
 *
 * @param logoMap - optional map from logo_id → data URL, built from the user's
 *   saved logos. If absent, logo objects will render without an image (they
 *   still exist in the layer list — the caller can re-resolve them later).
 */
export function applyStyleToLayers(
  style: SavedStyleData,
  imageWidth: number,
  imageHeight: number,
  logoMap?: Map<number, string>,
): Layer[] {
  return style.objects.slice(0, MAX_STYLE_OBJECTS).map(o => {
    // Resolve logo_id → data URL when a map is provided
    const src = o.logo_id != null
      ? (logoMap?.get(o.logo_id) ?? o.src)
      : o.src;

    return {
      id: Math.random().toString(36).substr(2, 9),
      type: o.type,
      x: (o.xPct / 100) * imageWidth,
      y: (o.yPct / 100) * imageHeight,
      width: (o.widthPct / 100) * imageWidth,
      height: (o.heightPct / 100) * imageHeight,
      rotation: o.rotation,
      opacity: o.opacity,
      text: o.text,
      fontSize: o.fontSizePct != null ? (o.fontSizePct / 100) * imageHeight : undefined,
      color: o.color,
      fontFamily: o.fontFamily,
      logo_id: o.logo_id,
      src,
      shape: o.shape,
      fill: o.fill,
      stroke: o.stroke,
      strokeWidth: o.strokeWidthPct != null ? (o.strokeWidthPct / 100) * imageHeight : undefined,
    };
  });
}

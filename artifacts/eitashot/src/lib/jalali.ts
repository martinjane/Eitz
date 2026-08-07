/**
 * Jalali (Solar Hijri) calendar utilities using the browser's built-in
 * Intl.DateTimeFormat with ca-persian extension.
 * No external dependencies required.
 */

const SLOT_LABELS = [
  "۰۰:۰۰ تا ۰۶:۰۰",
  "۰۶:۰۰ تا ۱۲:۰۰",
  "۱۲:۰۰ تا ۱۸:۰۰",
  "۱۸:۰۰ تا ۲۴:۰۰",
];

export function slotLabel(slot: number): string {
  return SLOT_LABELS[slot] ?? "";
}

/**
 * Format a "YYYY-MM-DD" Gregorian date string as a full Persian date.
 * Example output: "یکشنبه ۲۷ تیر"
 */
export function formatJalaliDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  // Use noon to avoid any DST / timezone edge cases
  const date = new Date(y, m - 1, d, 12, 0, 0);
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

/**
 * Format a "YYYY-MM-DD" Gregorian date string as a short Persian date.
 * Example output: "۲۷ تیر ۱۴۰۴"
 */
export function formatJalaliDateFull(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0);
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** Format a number in Persian numerals with thousand separators. */
export function toPersianNumber(n: number): string {
  return n.toLocaleString("fa-IR");
}

/**
 * Return a Jalali date string for use in export filenames.
 * Format: "Eitashot-1403-01-01" (ASCII digits, no Persian numerals).
 */
export function toJalaliFilename(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "00";
  return `Eitashot-${get("year")}-${get("month")}-${get("day")}`;
}

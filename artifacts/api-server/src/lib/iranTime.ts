/**
 * Utilities for Iran Standard Time (Asia/Tehran, UTC+3:30).
 * Uses the Intl API which is available in Node 20+.
 */

const TZ = "Asia/Tehran";

/** Returns the current datetime in Iran time. */
export function nowInIran(): Date {
  const now = new Date();
  // Convert to Iran local time via string round-trip
  return new Date(now.toLocaleString("en-US", { timeZone: TZ }));
}

/** Formats a Date as "YYYY-MM-DD" in Iran time. */
export function iranDateString(date: Date): string {
  return new Date(date.toLocaleString("en-US", { timeZone: TZ }))
    .toLocaleDateString("en-CA"); // en-CA gives YYYY-MM-DD
}

/** Returns the current date as "YYYY-MM-DD" in Iran time. */
export function todayIranString(): string {
  return iranDateString(new Date());
}

/** Returns the window slot (0–3) for a given Iran-local hour. */
export function slotForHour(hour: number): number {
  if (hour < 6)  return 0; // 00:00–06:00
  if (hour < 12) return 1; // 06:00–12:00
  if (hour < 18) return 2; // 12:00–18:00
  return 3;                 // 18:00–24:00
}

/** Returns the current window slot based on Iran time. */
export function currentSlot(): number {
  return slotForHour(nowInIran().getHours());
}

/**
 * Returns the next N calendar date strings (including today) in Iran time,
 * formatted as "YYYY-MM-DD".
 */
export function nextNIranDates(n: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getTime() + i * 86_400_000);
    dates.push(iranDateString(d));
  }
  return dates;
}

/**
 * Calculates the start date of the current 30-day donation cycle.
 * @param cycleOrigin — the ISO date string of the first cycle start (from env config).
 */
export function currentCycleStart(cycleOrigin: Date): Date {
  const CYCLE_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const elapsed = now - cycleOrigin.getTime();
  if (elapsed < 0) return cycleOrigin;
  const cyclesPassed = Math.floor(elapsed / CYCLE_MS);
  return new Date(cycleOrigin.getTime() + cyclesPassed * CYCLE_MS);
}

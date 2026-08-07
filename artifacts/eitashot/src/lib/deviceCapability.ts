/**
 * Device capability detection for automatic image resolution selection.
 *
 * Before an image enters the editor, we pick a max long-side pixel limit that
 * suits the device. Four tiers are supported:
 *
 *   Tier 3 → 2048 px  (Maximum Quality)
 *   Tier 2 → 1440 px  (High Quality)
 *   Tier 1 → 1080 px  (Medium Quality)
 *   Tier 0 →  720 px  (Low Quality)
 *
 * ─── TUNING ──────────────────────────────────────────────────────────────────
 * To change resolution values, edit RESOLUTION_TIERS below.
 * To change tier assignment rules, edit the three tier* functions below.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Pixel counts for each tier, indexed by tier number (0 = lowest). */
const RESOLUTION_TIERS = [720, 1080, 1440, 2048] as const;
export type ResolutionTier = (typeof RESOLUTION_TIERS)[number];

// ─── Individual signal scorers ───────────────────────────────────────────────

/**
 * Tier from navigator.deviceMemory (Chrome/Android; undefined elsewhere).
 * Returns null when the API is unavailable so we can skip it in the average.
 */
function tierFromMemory(): number | null {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem === undefined) return null;
  if (mem >= 6) return 3;
  if (mem >= 4) return 2;
  if (mem >= 2) return 1;
  return 0; // < 2 GB → low-end (e.g. Samsung Galaxy J7: 1.5 GB)
}

/**
 * Tier from navigator.hardwareConcurrency (logical CPU cores).
 * Note: core *count* alone is a weak signal on ARM (many weak cores look
 * high), so this is weighted lower than memory and canvas perf.
 * Returns null when unavailable.
 */
function tierFromCores(): number | null {
  const cores = navigator.hardwareConcurrency;
  if (!cores) return null;
  if (cores >= 8) return 2; // capped at 2 — core count over-reports on ARM
  if (cores >= 4) return 1;
  return 0;
}

/**
 * Tier from a lightweight canvas pixel-processing benchmark.
 * Runs 4 rounds of getImageData + simple pixel manipulation on a 128×128
 * offscreen canvas, measuring total elapsed wall-clock time.
 *
 * This is the most reliable signal: it exercises the actual CPU path used
 * during painting and filter application. On a Samsung Galaxy J7 (2016) with
 * its slow A53 cores the whole loop takes ~80-200 ms; on a modern mid-range
 * Android it finishes in ~10-25 ms; on desktop in < 5 ms.
 *
 * Thresholds (tunable):
 *   < 10 ms  → tier 3 (fast device)
 *   < 30 ms  → tier 2
 *   < 70 ms  → tier 1
 *   ≥ 70 ms  → tier 0 (slow device)
 */
function tierFromCanvas(): number {
  try {
    const SIZE = 128;
    const ROUNDS = 4;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 1; // neutral fallback

    // Prime the canvas with data so reads are not trivially skipped
    ctx.fillStyle = '#4a90d9';
    ctx.fillRect(0, 0, SIZE, SIZE);

    const t0 = performance.now();
    for (let r = 0; r < ROUNDS; r++) {
      const imgData = ctx.getImageData(0, 0, SIZE, SIZE);
      const buf = imgData.data;
      // Simple pixel walk — same operation as brightness/contrast filters
      for (let i = 0; i < buf.length; i += 4) {
        buf[i]     = Math.min(255, buf[i]     + 5);
        buf[i + 1] = Math.min(255, buf[i + 1] + 5);
        buf[i + 2] = Math.min(255, buf[i + 2] + 5);
      }
      ctx.putImageData(imgData, 0, 0);
    }
    const elapsed = performance.now() - t0;

    if (elapsed < 10) return 3;
    if (elapsed < 30) return 2;
    if (elapsed < 70) return 1;
    return 0;
  } catch {
    return 1; // neutral fallback on any error
  }
}

// ─── Aggregate & cache ───────────────────────────────────────────────────────

let _cached: ResolutionTier | null = null;

/**
 * Returns the recommended maximum long-side resolution (px) for the current
 * device. The result is computed once and cached; subsequent calls are instant.
 *
 * Detection is synchronous and takes < 5 ms on modern devices, < 200 ms on
 * very old ones. It is intentionally deferred to first call (i.e. first image
 * upload) so it does not slow down initial page load.
 */
export function getDeviceResolution(): ResolutionTier {
  if (_cached !== null) return _cached;

  const signals: number[] = [];

  const mem = tierFromMemory();
  if (mem !== null) signals.push(mem * 1.5); // memory is a strong signal

  const cores = tierFromCores();
  if (cores !== null) signals.push(cores * 0.5); // weak signal (ARM caveat)

  signals.push(tierFromCanvas() * 2); // canvas perf is the strongest signal

  const totalWeight = signals.length > 0
    ? (mem !== null ? 1.5 : 0) + (cores !== null ? 0.5 : 0) + 2
    : 1;

  const weightedSum = signals.reduce((a, b) => a + b, 0);
  const avg = weightedSum / totalWeight;
  const tierIndex = Math.round(Math.max(0, Math.min(3, avg)));

  _cached = RESOLUTION_TIERS[tierIndex];

  if (import.meta.env.DEV) {
    console.debug(
      `[deviceCapability] memory=${mem ?? 'n/a'} cores=${cores ?? 'n/a'} ` +
      `canvas=${tierFromCanvas()} → tier ${tierIndex} → ${_cached}px`,
    );
  }

  return _cached;
}

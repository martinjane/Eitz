import { useState, useEffect } from "react";

const STORAGE_KEY = "eitashot-auto-reduce";

/**
 * Client-side toggle for automatic image quality/resolution reduction.
 * When enabled (default), images are automatically downscaled on low-end
 * devices to keep editing smooth. When disabled, no automatic reduction
 * occurs — the user accepts potential lag for maximum quality.
 *
 * Stored in localStorage, same pattern as useTheme.
 */
export function useAutoReduce() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) return saved !== "off";
      return true; // default: enabled
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    } catch {
      // ignore
    }
  }, [enabled]);

  return { enabled, toggle: () => setEnabled(e => !e) };
}

/**
 * Synchronous helper to read the auto-reduce setting from localStorage.
 * Used by EditorContext's downsampleIfNeeded which runs outside React.
 */
export function getAutoReduceEnabled(): boolean {
  try {
    const saved = localStorage.getItem("eitashot-auto-reduce");
    if (saved !== null) return saved !== "off";
    return true; // default: enabled
  } catch {
    return true;
  }
}

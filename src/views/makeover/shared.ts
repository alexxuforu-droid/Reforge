// Shared makeover bits — extracted from views/Makeover.tsx (V2 pillar 2b).
// Pure helpers + constants only; no component state.
export const IMPORT_TIMEOUT_MS = 180_000;

/** Copy to the clipboard with a legacy execCommand fallback for older webviews. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function shade(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const n = (i: number) => Math.min(255, Math.max(0, parseInt(h.slice(i, i + 2), 16) + amt));
  return `#${[n(0), n(2), n(4)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

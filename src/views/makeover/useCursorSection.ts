// cursor scheme section (lazy) — extracted from views/Makeover.tsx (V2 pillar 2b, zero behavior change).
import { call, errorCopy } from "../../lib/api";
import { toast } from "../../components/ui";
import { useLazyLoad, useVisibleOnce } from "../../lib/useLoad";
import type { CursorScheme, CursorState } from "../../lib/types";

export function useCursorSection() {
  // ---- Cursor (S7.2: loads when its section first scrolls into view) ----
  const { data: cursorSchemes, error: cursorSchemesError, refresh: refreshCursorSchemes, load: loadCursorSchemes } = useLazyLoad<CursorScheme[]>("list_cursor_schemes");
  const { data: cursorState, error: cursorStateError, refresh: refreshCursorState, load: loadCursorState } = useLazyLoad<CursorState>("get_cursor_state");
  const cursorRef = useVisibleOnce(() => { loadCursorSchemes(); loadCursorState(); });
  const applyCursor = async (id: string) => {
    try { await call<CursorState>("apply_cursor_scheme", { id }); refreshCursorState(); toast("Cursor scheme applied"); }
    catch (e) { toast(errorCopy(e), "err"); }
  };
  return { cursorSchemes, cursorSchemesError, refreshCursorSchemes, cursorState, cursorStateError, refreshCursorState, cursorRef, applyCursor };
}

// theme + packs state and actions — extracted from views/Makeover.tsx (V2 pillar 2b, zero behavior change).
import { useState } from "react";
import { call, errorCopy } from "../../lib/api";
import { toast } from "../../components/ui";
import { announceThemeChanged } from "../../lib/theme-dom";
import type { Pack, ThemeState } from "../../lib/types";

export function useMakeoverTheme(refresh: () => void) {
  // ---- Theme ----
  // S2.2 — every state-critical load goes through useLoad: one toast per
  // command per session on first failure, plus a per-section InlineAlert.
  const [theme, setTheme] = useState<ThemeState | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [activePack, setActivePack] = useState<Pack | null>(null);
  const [wpPath, setWpPath] = useState("");
  const [applying, setApplying] = useState<string | null>(null);
  const setAccent = async (hex: string) => {
    try { const t = await call<ThemeState>("set_accent_color", { hex }); setTheme(t); announceThemeChanged(t.accent_hex, t.mode); toast(`Accent → ${hex}`); }
    catch (e) { toast(errorCopy(e), "err"); }
  };

  const setMode = async (mode: "dark" | "light") => {
    try { const t = await call<ThemeState>("set_theme_mode", { mode }); setTheme(t); announceThemeChanged(t.accent_hex, t.mode); toast(`Mode → ${mode}`); }
    catch (e) { toast(errorCopy(e), "err"); }
  };

  const setTransparency = async (on: boolean) => {
    try { const t = await call<ThemeState>("set_transparency", { on }); setTheme(t); }
    catch (e) { toast(errorCopy(e), "err"); }
  };

  const applyPack = async (p: Pack) => {
    setApplying(p.id);
    try { await call<Pack>("apply_pack", { id: p.id }); setActivePack(p); refresh(); toast(`Applied "${p.name}"`); }
    catch (e) { toast(errorCopy(e), "err"); } finally { setApplying(null); }
  };
  return { theme, setTheme, packs, setPacks, activePack, setActivePack, wpPath, setWpPath, applying, setApplying, setAccent, setMode, setTransparency, applyPack };
}

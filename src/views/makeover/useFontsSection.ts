// system font replacer — extracted from views/Makeover.tsx (V2 pillar 2b, zero behavior change).
import { useState } from "react";
import { call, errorCopy } from "../../lib/api";
import { toast } from "../../components/ui";
import { useLazyLoad, useVisibleOnce } from "../../lib/useLoad";
import type { FontEntry, FontSubstitution } from "../../lib/types";

export function useFontsSection() {
  // ---- Fonts ----
  const { data: fontSubs, error: fontSubsError, refresh: refreshFontSubs, load: loadFontSubs } = useLazyLoad<FontSubstitution[]>("list_font_substitutions");
  const { data: installedFonts, error: installedFontsError, refresh: refreshInstalledFonts, load: loadInstalledFonts } = useLazyLoad<FontEntry[]>("list_installed_fonts");
  const fontsRef = useVisibleOnce(() => { loadFontSubs(); loadInstalledFonts(); });
  const [fontOriginal, setFontOriginal] = useState("Segoe UI");
  const [fontSubstitute, setFontSubstitute] = useState("");
  const [fontInstallPath, setFontInstallPath] = useState("");
  const refreshFonts = () => {
    refreshFontSubs();
    refreshInstalledFonts();
  };
  const applyFontSub = () => {
    if (!fontOriginal.trim()) return;
    call<FontSubstitution[]>("set_font_substitution", { original: fontOriginal, substitute: fontSubstitute })
      .then(() => { toast("Font substitution set"); refreshFontSubs(); })
      .catch((e) => toast(errorCopy(e), "err"));
  };
  const installFont = () => {
    if (!fontInstallPath.trim()) return;
    call<FontEntry[]>("install_user_font", { path: fontInstallPath })
      .then(() => { toast("Font installed"); setFontInstallPath(""); refreshInstalledFonts(); })
      .catch((e) => toast(errorCopy(e), "err"));
  };
  const removeFont = (name: string) => {
    call<FontEntry[]>("remove_user_font", { name }).then(() => { toast(`Removed: ${name}`); refreshInstalledFonts(); }).catch((e) => toast(errorCopy(e), "err"));
  };
  return { fontSubs, fontSubsError, installedFonts, installedFontsError, fontsRef, fontOriginal, setFontOriginal, fontSubstitute, setFontSubstitute, fontInstallPath, setFontInstallPath, refreshFonts, refreshFontSubs, applyFontSub, installFont, removeFont };
}

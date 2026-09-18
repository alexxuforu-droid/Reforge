// screensaver config (E4.6) — extracted from views/Makeover.tsx (V2 pillar 2b, zero behavior change).
import { useEffect, useState } from "react";
import { call, errorCopy } from "../../lib/api";
import { toast } from "../../components/ui";
import { useLazyLoad, useVisibleOnce } from "../../lib/useLoad";
import type { SceneConfig, ScreensaverConfig, ScreensaverRegistry } from "../../lib/types";

export function useScreensaverSection(scenes: SceneConfig[] | null) {
  // ---- Screensaver (E4.6) ----
  const { data: screensaverCfg, error: screensaverCfgError, refresh: refreshScreensaverCfg, load: loadScreensaverCfg } = useLazyLoad<ScreensaverConfig>("get_screensaver_config");
  const { data: screensaverReg, refresh: refreshScreensaverReg, load: loadScreensaverReg } = useLazyLoad<ScreensaverRegistry>("get_screensaver_registry");
  const screensaverRef = useVisibleOnce(() => { loadScreensaverCfg(); loadScreensaverReg(); });
  const [screensaverBusy, setScreensaverBusy] = useState(false);
  const [screensaverSceneId, setScreensaverSceneId] = useState<string>("");
  // Local mirror — successive saves merge onto THIS, not the (async) hook data,
  // so a fast toggle→timeout→scene sequence can't clobber earlier edits.
  const [ssCfg, setSsCfg] = useState<ScreensaverConfig | null>(null);
  // Adopt the loaded config only if the user hasn't edited yet — a stale load
  // resolving after a save must never overwrite the user's choice.
  useEffect(() => { setSsCfg((prev) => prev ?? screensaverCfg ?? null); }, [screensaverCfg]);
  const shownSsCfg = ssCfg ?? screensaverCfg;
  // P2-6 — the scene currently picked for the screensaver (for the thumbnail).
  const screensaverScene = (scenes ?? []).find((s) => s.id === screensaverSceneId) ?? shownSsCfg?.scene ?? null;

  const saveScreensaver = async (next: Partial<ScreensaverConfig>) => {
    const base = shownSsCfg ?? { enabled: false, timeout_secs: 300, scene: null };
    try {
      const saved = await call<ScreensaverConfig>("set_screensaver_config", { config: { ...base, ...next } });
      setSsCfg(saved); refreshScreensaverCfg(); refreshScreensaverReg();
      toast(saved.enabled ? `Screensaver armed — activates after ${saved.timeout_secs}s idle` : "Screensaver disabled");
    } catch (err) { toast(errorCopy(err), "err"); }
  };

  const previewScreensaver = async () => {
    setScreensaverBusy(true);
    try { const msg = await call<string>("preview_screensaver"); toast(msg); }
    catch (err) { toast(errorCopy(err), "err"); } finally { setScreensaverBusy(false); }
  };
  return { screensaverCfg, screensaverCfgError, screensaverReg, screensaverRef, screensaverBusy, screensaverSceneId, setScreensaverSceneId, shownSsCfg, screensaverScene, saveScreensaver, previewScreensaver };
}

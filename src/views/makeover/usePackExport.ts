// pack export actions — extracted from views/Makeover.tsx (V2 pillar 2b, zero behavior change).
import { useState } from "react";
import { call, errorCopy } from "../../lib/api";
import { toast } from "../../components/ui";
import type { EngineState } from "../../lib/types";

export function usePackExport(engine: EngineState | null) {
  // P2-7 — scene → pack export (capture_look now includes the running scene).
  const [packBusy, setPackBusy] = useState(false);
  // P2-7 — capture the current look (running scene included) as a shareable pack.
  const exportScenePack = async () => {
    if (!engine?.scene) return;
    setPackBusy(true);
    try {
      const b = await call<{ name: string }>("marketplace_export_look", { name: engine.scene.name });
      toast(`Captured "${b.name}" as a pack — see Pack Marketplace to share it`);
    } catch (err) { toast(errorCopy(err), "err"); } finally { setPackBusy(false); }
  };

  // P5-4 — one-click full look export (accent, mode, wallpaper, video, scene,
  // sounds, fonts, taskbar, cursor, lock screen — capture_look does it all).
  const exportCurrentLook = async () => {
    setPackBusy(true);
    try {
      const b = await call<{ name: string }>("marketplace_export_look", { name: "My Look" });
      toast(`Captured your current look as "${b.name}" — see Pack Marketplace to share it`);
    } catch (err) { toast(errorCopy(err), "err"); } finally { setPackBusy(false); }
  };
  return { packBusy, exportScenePack, exportCurrentLook };
}

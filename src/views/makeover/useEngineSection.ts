// animated engine + studio builder — extracted from views/Makeover.tsx (V2 pillar 2b, zero behavior change).
import { useState } from "react";
import { call, errorCopy } from "../../lib/api";
import { toast } from "../../components/ui";
import { useLoad, useLazyLoad, useVisibleOnce } from "../../lib/useLoad";
import type { EngineState, SceneConfig } from "../../lib/types";

export function useEngineSection() {
  // ---- Engine ----
  const { data: engine, error: engineError, refresh: refreshEngine, load: loadEngine } = useLazyLoad<EngineState>("get_wallpaper_engine_state");
  const engineRef = useVisibleOnce(() => { loadEngine(); });
  const { data: scenes, error: scenesError, refresh: refreshScenes } = useLoad<SceneConfig[]>("list_wallpaper_scenes");
  const [moodFilter, setMoodFilter] = useState("all");
  // S7.6 — scene tiles play only on hover: at most one ScenePreview canvas
  // animates at a time, zero on load (same budget as the style grid).
  const [hoverScene, setHoverScene] = useState<string | null>(null);
  const [engineBusy, setEngineBusy] = useState(false);
  // ---- Wallpaper Studio ----
  const [studioOpen, setStudioOpen] = useState(false);
  const [studio, setStudio] = useState<SceneConfig>({
    id: "studio-custom", name: "My Scene", kind: "particles",
    mood: "custom", speed: 1.0, density: 1.0,
    colors: ["#818cf8", "#38bdf8", "#f472b6"],
  });
  const applyScene = async (scene: SceneConfig) => {
    setEngineBusy(true);
    try { await call<EngineState>("set_animated_wallpaper", { scene }); refreshEngine(); toast(`Animated wallpaper: ${scene.name}`); }
    catch (err) { toast(errorCopy(err), "err"); } finally { setEngineBusy(false); }
  };

  const stopScene = async () => {
    setEngineBusy(true);
    try { await call<EngineState>("stop_animated_wallpaper", {}); refreshEngine(); toast("Animated wallpaper stopped"); }
    catch (err) { toast(errorCopy(err), "err"); } finally { setEngineBusy(false); }
  };

  const freezeScene = async (frozen: boolean) => {
    try { await call<EngineState>("freeze_wallpaper", { frozen }); refreshEngine(); toast(frozen ? "Frozen" : "Resumed"); }
    catch (err) { toast(errorCopy(err), "err"); }
  };
  const applyStudio = async () => { await applyScene(studio); setStudioOpen(false); };

  // A6.2 — scene editor v2: save the studio scene as a persistent custom scene.
  // Each save stamps a fresh id so saving twice creates two scenes (undoable).
  const saveStudioScene = async () => {
    const saved: SceneConfig = { ...studio, id: `custom-${Date.now().toString(36)}` };
    try {
      await call<SceneConfig[]>("save_custom_scene", { scene: saved });
      toast(`Custom scene “${saved.name}” saved — undoable from History`);
      setStudio({ ...studio, name: "My Scene" });
      refreshScenes();
    } catch (err) {
      toast(errorCopy(err), "err");
    }
  };

  const deleteCustomScene = async (s: SceneConfig) => {
    try {
      await call<SceneConfig[]>("delete_custom_scene", { id: s.id });
      toast(`Custom scene “${s.name}” deleted`);
      refreshScenes();
    } catch (err) {
      toast(errorCopy(err), "err");
    }
  };
  return { engine, engineError, refreshEngine, loadEngine, scenes, scenesError, refreshScenes, moodFilter, setMoodFilter, hoverScene, setHoverScene, engineBusy, studioOpen, setStudioOpen, studio, setStudio, applyScene, stopScene, freezeScene, applyStudio, saveStudioScene, deleteCustomScene, engineRef };
}

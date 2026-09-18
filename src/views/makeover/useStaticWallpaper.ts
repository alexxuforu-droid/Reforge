// slideshow, history, per-monitor — extracted from views/Makeover.tsx (V2 pillar 2b, zero behavior change).
import { useEffect, useState } from "react";
import { call, callWithTimeout, errorCopy } from "../../lib/api";
import { toast } from "../../components/ui";
import { useLoad } from "../../lib/useLoad";
import type { EngineState, WallpaperHistoryEntry, WallpaperSlideshowConfig, WallpaperState } from "../../lib/types";
import { IMPORT_TIMEOUT_MS } from "./shared";

export function useStaticWallpaper(refresh: () => void, refreshVideo: () => void, wpPath: string) {
  const { data: wallpapers, error: wallpapersError, refresh: refreshWallpapers } = useLoad<WallpaperState>("get_wallpapers");
  // ---- Static wallpaper: slideshow + history + per-monitor ----
  const { data: slideshow, error: slideshowError, refresh: refreshSlideshowCfg } = useLoad<WallpaperSlideshowConfig>("get_wallpaper_slideshow");
  const { data: wpHistory, error: wpHistoryError, refresh: refreshWpHistory } = useLoad<WallpaperHistoryEntry[]>("get_wallpaper_history");
  const [slideshowFolder, setSlideshowFolder] = useState("");
  const [slideshowInterval, setSlideshowInterval] = useState(30);
  const [monitorTarget, setMonitorTarget] = useState("");
  // S11.5 — smart slideshow: favorites (3× weight), day/night filter, skip-now.
  const [favInput, setFavInput] = useState("");
  const refreshSlideshow = () => {
    refreshSlideshowCfg();
    refreshWpHistory();
  };

  // S2.2 — keep the editable slideshow inputs in sync with the loaded config.
  useEffect(() => {
    if (slideshow) {
      setSlideshowFolder(slideshow.folder);
      setSlideshowInterval(slideshow.interval_minutes);
    }
  }, [slideshow]);

  const saveSlideshow = (patch: Partial<WallpaperSlideshowConfig>) => {
    const base: WallpaperSlideshowConfig = slideshow ?? {
      enabled: false, folder: slideshowFolder, interval_minutes: slideshowInterval,
      shuffle: false, next_rotation_ts: null, last_applied: null,
      favorites: [], day_night_filter: false,
    };
    const next: WallpaperSlideshowConfig = { ...base, ...patch, folder: slideshowFolder, interval_minutes: slideshowInterval };
    call<WallpaperSlideshowConfig>("set_wallpaper_slideshow", { cfg: next })
      .then(() => { refreshSlideshowCfg(); toast(next.enabled ? `Rotation on — every ${next.interval_minutes} min` : "Rotation off"); })
      .catch((e) => toast(errorCopy(e), "err"));
  };

  // S11.5 — favorites are weighted 3× in the rotation; skip jumps straight
  // to the next pick (no waiting for the interval).
  const addFavorite = () => {
    const p = favInput.trim();
    if (!p) return;
    const cur = slideshow?.favorites ?? [];
    if (!cur.includes(p)) saveSlideshow({ favorites: [...cur, p] });
    setFavInput("");
  };

  const removeFavorite = (p: string) => {
    saveSlideshow({ favorites: (slideshow?.favorites ?? []).filter((f) => f !== p) });
  };

  const skipNow = async () => {
    try {
      const msg = await call<string>("skip_slideshow");
      toast(msg);
      refreshSlideshow();
    } catch (e) {
      toast(errorCopy(e), "err");
    }
  };

  const setWallpaperTarget = async () => {
    if (!wpPath.trim()) return;
    try {
      const isLive = /\.(mp4|webm|gif)$/i.test(wpPath.trim());
      if (monitorTarget && wallpapers?.monitors.some((m) => m.id === monitorTarget)) {
        await call<WallpaperState>("set_monitor_wallpaper", { monitor_id: monitorTarget, path: wpPath });
        toast("Wallpaper set for that monitor only");
      } else if (isLive) {
        const eng = await callWithTimeout<EngineState>("set_video_wallpaper", { source: wpPath, monitor: monitorTarget || undefined }, IMPORT_TIMEOUT_MS);
        toast(`Now playing: ${eng.media?.name ?? "video"}`);
      } else {
        await call<WallpaperState>("set_wallpaper", { path: wpPath });
        toast("Wallpaper set");
      }
      refresh();
      refreshSlideshow();
      refreshVideo();
    } catch (e) {
      toast(errorCopy(e), "err");
    }
  };
  return { wallpapers, wallpapersError, refreshWallpapers, slideshow, slideshowError, wpHistory, wpHistoryError, slideshowFolder, setSlideshowFolder, slideshowInterval, setSlideshowInterval, monitorTarget, setMonitorTarget, favInput, setFavInput, refreshSlideshow, saveSlideshow, addFavorite, removeFavorite, skipNow, setWallpaperTarget };
}

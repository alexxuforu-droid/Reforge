// video wallpaper + transcode — extracted from views/Makeover.tsx (V2 pillar 2b, zero behavior change).
import { useEffect, useState } from "react";
import { call, callWithTimeout, errorCopy, onEvent } from "../../lib/api";
import { toast } from "../../components/ui";
import { useLazyLoad, useVisibleOnce } from "../../lib/useLoad";
import type { EngineState, TranscodeConfig, TranscodeStatus, VideoWallpaper } from "../../lib/types";
import { IMPORT_TIMEOUT_MS } from "./shared";

export function useVideoSection(refreshEngine: () => void) {
  // ---- Video wallpaper ----
  const { data: videoWallpapers, error: videoError, refresh: refreshVideoWallpapers, load: loadVideoWallpapers } = useLazyLoad<VideoWallpaper[]>("list_video_wallpapers");
  const { data: transcode, error: transcodeError, refresh: refreshTranscode, load: loadTranscode } = useLazyLoad<TranscodeStatus>("media_get_transcode_status");
  // P2-1 — the import quality preset lives here too, not just in Settings.
  const { data: transcodeCfg, refresh: refreshTranscodeCfg, load: loadTranscodeCfg } = useLazyLoad<TranscodeConfig>("get_transcode_config");
  const videoRef = useVisibleOnce(() => { loadVideoWallpapers(); loadTranscode(); loadTranscodeCfg(); });
  const [videoPath, setVideoPath] = useState("");
  const [videoBusy, setVideoBusy] = useState(false);
  // P2-1 — pause/resume state (the video window keeps playing underneath).
  const [videoPaused, setVideoPaused] = useState(false);
  const [soundImportPath, setSoundImportPath] = useState("");
  // E1 — live transcode status from the backend (`transcode-progress` events).
  const [transcodeNote, setTranscodeNote] = useState<string | null>(null);
  // M-1 — which monitor a newly-set video wallpaper plays on ("" = all)
  const [videoMonitor, setVideoMonitor] = useState("");
  const refreshVideo = () => {
    refreshVideoWallpapers();
    refreshTranscode();
  };
  // ---- Handlers ----
  // E1 — subscribe to the ffmpeg progress stream so the import button shows a
  // live "Normalizing video… Ns" line instead of an opaque spinner.
  useEffect(
    () =>
      onEvent<{ phase: string; seconds?: number }>("transcode-progress", (p) => {
        if (p.phase === "transcoding")
          setTranscodeNote(`Normalizing video… ${Math.max(1, Math.floor(p.seconds ?? 0))}s`);
        else if (p.phase === "done") setTranscodeNote("Normalized — applying…");
      }),
    [],
  );

  const setVideoWallpaper = async () => {
    if (!videoPath.trim()) return;
    setVideoBusy(true);
    setTranscodeNote(null);
    try {
      await callWithTimeout<EngineState>("set_video_wallpaper", { source: videoPath, monitor: videoMonitor || undefined }, IMPORT_TIMEOUT_MS);
      setVideoPaused(false);
      refreshEngine(); refreshVideo(); toast("Video wallpaper set");
    } catch (err) { toast(errorCopy(err), "err"); } finally { setVideoBusy(false); setTranscodeNote(null); }
  };

  const stopVideoWallpaper = async () => {
    setVideoBusy(true);
    try {
      await call<EngineState>("stop_video_wallpaper", {});
      setVideoPaused(false);
      refreshEngine(); toast("Video wallpaper stopped");
    } catch (err) { toast(errorCopy(err), "err"); } finally { setVideoBusy(false); }
  };

  // P2-1 — pause/resume without restarting the video window.
  const toggleVideoPaused = async () => {
    const next = !videoPaused;
    setVideoPaused(next);
    try {
      await call("set_video_paused", { paused: next });
      toast(next ? "Video paused" : "Video playing");
    } catch (err) { toast(errorCopy(err), "err"); }
  };
  return { videoWallpapers, videoError, videoRef, videoPath, setVideoPath, videoBusy, videoPaused, soundImportPath, setSoundImportPath, transcodeNote, videoMonitor, setVideoMonitor, transcode, transcodeError, transcodeCfg, refreshTranscodeCfg, refreshVideo, setVideoWallpaper, stopVideoWallpaper, toggleVideoPaused };
}

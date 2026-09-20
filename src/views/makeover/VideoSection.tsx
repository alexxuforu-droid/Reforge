import type { Dispatch, RefObject, SetStateAction } from "react";
import { call, errorCopy } from "../../lib/api";
import type { EngineState, TranscodeConfig, TranscodeStatus, VideoWallpaper, WallpaperState } from "../../lib/types";
import { InlineAlert, Section, StatusDot, toast } from "../../components/ui";
import { IconPower, IconPause, IconPlay } from "../../components/icons";

export type VideoSectionProps = {
  videoWallpapers: VideoWallpaper[] | null;
  videoError: string | null;
  videoRef: RefObject<HTMLDivElement | null>;
  videoPath: string;
  setVideoPath: Dispatch<SetStateAction<string>>;
  videoBusy: boolean;
  videoPaused: boolean;
  transcodeNote: string | null;
  videoMonitor: string;
  setVideoMonitor: Dispatch<SetStateAction<string>>;
  transcode: TranscodeStatus | null;
  transcodeError: string | null;
  transcodeCfg: TranscodeConfig | null;
  refreshTranscodeCfg: () => void;
  setVideoWallpaper: () => void;
  stopVideoWallpaper: () => void;
  toggleVideoPaused: () => void;
  engine: EngineState | null;
  refreshEngine: () => void;
  wallpapers: WallpaperState | null;
};

export default function VideoSection({
  videoWallpapers,
  videoError,
  videoRef,
  videoPath,
  setVideoPath,
  videoBusy,
  videoPaused,
  transcodeNote,
  videoMonitor,
  setVideoMonitor,
  transcode,
  transcodeError,
  transcodeCfg,
  refreshTranscodeCfg,
  setVideoWallpaper,
  stopVideoWallpaper,
  toggleVideoPaused,
  engine,
  refreshEngine,
  wallpapers,
}: VideoSectionProps) {
  return (
    <div ref={videoRef}>
    <Section title="Video & GIF wallpaper" subtitle="Loop a video or animated image — MP4, WebM and GIF, normalized on import" actions={engine?.media ? (<div className="flex gap-2"><button className="btn-ghost shrink-0 text-xs" onClick={toggleVideoPaused}>{videoPaused ? <><IconPlay size={12} /> Resume</> : <><IconPause size={12} /> Pause</>}</button><button className="btn-danger shrink-0 text-xs" disabled={videoBusy} onClick={stopVideoWallpaper}><IconPower size={12} /> Stop video</button></div>) : undefined}>
      {videoError && <InlineAlert>{videoError}</InlineAlert>}
      {transcodeError && <InlineAlert>{transcodeError}</InlineAlert>}
      <div className="mb-3 flex gap-2">
        <input className="input" placeholder="C:\videos\aurora.mp4" value={videoPath} onChange={(e) => setVideoPath(e.target.value)} />
        <button className="btn-primary shrink-0" onClick={setVideoWallpaper} disabled={videoBusy || !videoPath.trim()}>{videoBusy ? "Importing…" : "Set video"}</button>
      </div>
      {/* P2-1 — import quality preset lives here too (not just Settings) */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-2xs text-[var(--text-tertiary)]">Import quality:</span>
        {(["high", "balanced", "performance"] as const).map((p) => (
          <button
            key={p}
            onClick={() =>
              call<TranscodeConfig>("set_transcode_config", { config: { preset: p } })
                .then(() => { refreshTranscodeCfg(); toast(`Video imports → ${p}`); })
                .catch((e) => toast(errorCopy(e), "err"))
            }
            className={`rounded-lg border px-2.5 py-1 text-2xs capitalize transition-colors ${(transcodeCfg?.preset ?? "balanced") === p ? "border-[var(--accent-hex)] bg-[var(--accent-hex)]/10 text-[var(--text-primary)]" : "border-[var(--border-default)] bg-[var(--surface-overlay)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"}`}
          >
            {p}
          </button>
        ))}
        <span className="text-2xs text-[var(--text-tertiary)]">high = best quality, biggest files · performance = fastest, smallest</span>
      </div>
      {/* M-1 — pin the video to one monitor or span them all */}
      {wallpapers && wallpapers.monitors.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-2xs text-[var(--text-tertiary)]">Play on:</span>
          <select value={videoMonitor} onChange={(e) => setVideoMonitor(e.target.value)} aria-label="Monitor for new video wallpapers">
            <option value="">All monitors</option>
            {wallpapers.monitors.map((m) => (<option key={m.id} value={m.id}>{m.id}</option>))}
          </select>
          <span className="text-2xs text-[var(--text-tertiary)]">applies to the next video you set</span>
        </div>
      )}
      {videoBusy && transcodeNote && (
        <div className="mb-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-hex)]" />
          {transcodeNote}
        </div>
      )}
      {transcode && !transcode.available && (
        <div className="mb-3 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning)]">
          ffmpeg isn't bundled — videos play without normalization.
        </div>
      )}
      {engine?.media && (
        <div className="mb-3 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-2.5 text-sm text-[var(--status-success)]">
          <StatusDot status="success" pulse /> Now playing: <b>{engine.media.name}</b> ({engine.media.width}×{engine.media.height})
        </div>
      )}
      {!videoError && (videoWallpapers ?? []).length > 0 && (
        <>
          <div className="mb-1.5 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Imported media</div>
          <div className="flex flex-wrap gap-2">
            {(videoWallpapers ?? []).map((v) => (
              <button key={v.path} onClick={() => call<EngineState>("set_video_wallpaper", { source: v.path, monitor: videoMonitor || undefined }).then(() => { refreshEngine(); toast(`Video → ${v.name}`); }).catch((e) => toast(errorCopy(e), "err"))} className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${engine?.media?.path === v.path ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)]" : "border-[var(--border-default)] bg-[var(--surface-overlay)] hover:bg-[var(--surface-hover)]"}`}>
                <div className="font-medium text-[var(--text-primary)]">{v.name}</div>
                <div className="text-2xs text-[var(--text-tertiary)]">{v.kind} · {v.width}×{v.height}{engine?.media?.monitor ? <> · pinned to {engine.media.monitor}</> : null}</div>
              </button>
            ))}
          </div>
        </>
      )}
      {!videoError && (videoWallpapers ?? []).length === 0 && (
        <div className="empty-state">
          No imported videos yet — paste a path above to loop an MP4, WebM or GIF.
        </div>
      )}
    </Section>
    </div>
  );
}

// Extracted from views/Makeover.tsx (V2 pillar 2b, zero behavior change).
import { useEffect, useRef, useState } from "react";
import { swallow } from "../../lib/api";
import { IconPlay } from "../../components/icons";
import type { WallpaperEntry } from "../../styles";

/** Live tile: preload=none + imperative play on hover — at most one video
 *  decodes at a time, nothing loads for tiles you never hover (C1.11).
 *  On failure the video hides itself and the tile falls back to the
 *  dominant-color placeholder so a broken file never shows a black box. */
export default function LiveTile({ w, hovered }: { w: WallpaperEntry; hovered: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v || failed) return;
    if (hovered) v.play().catch((e) => swallow("video hover autoplay", e));
    else v.pause();
  }, [hovered, failed]);
  return (
    <>
      <video
        ref={ref}
        src={w.file}
        muted
        loop
        playsInline
        preload="none"
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover transition-transform group-hover:scale-110 ${failed ? "hidden" : ""}`}
      />
      {!hovered && !failed && (
        <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white">
          <IconPlay size={13} className="ml-0.5" />
        </span>
      )}
      {failed && (
        <span className="absolute inset-0 flex items-center justify-center text-2xs text-white/50">Preview unavailable</span>
      )}
    </>
  );
}

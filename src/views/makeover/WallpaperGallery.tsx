// Extracted from views/Makeover.tsx (V2 pillar 2b, zero behavior change).
import { useState } from "react";
import { ALL_WALLPAPERS, CATEGORIES, WALLPAPER_COUNT } from "../../styles";
import { IconChevronDown, IconFilm, IconImage, IconStar } from "../../components/icons";
import type { WallpaperEntry } from "../../styles";
import LiveTile from "./LiveTile";

export default function WallpaperGallery({ onApply, onStyle }: { onApply: (path: string, type: "static" | "live") => void; onStyle: (w: WallpaperEntry) => void }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [typeFilter, setTypeFilter] = useState<"all" | "static" | "live">("all");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filtered = ALL_WALLPAPERS.filter((w) => {
    if (category !== "All" && w.category !== category) return false;
    if (typeFilter !== "all" && w.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border-default)]">
      {/* Collapsed-by-default header — content lazy-mounts on first expand (C1.9) */}
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 transition-colors hover:bg-[var(--surface-hover)]"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
          <IconImage size={14} className="text-[var(--text-tertiary)]" />
          Wallpaper library
          <span className="badge badge-accent">{WALLPAPER_COUNT.total}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-2xs text-[var(--text-tertiary)]">
          {WALLPAPER_COUNT.static} static · {WALLPAPER_COUNT.live} live
          <IconChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--border-default)] p-3">
          <div className="mb-3 flex gap-1">
            {(["all", "static", "live"] as const).map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)} className={`rounded px-2 py-0.5 text-2xs transition-colors ${typeFilter === t ? "bg-[var(--accent-hex)] text-white" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`}>
                {t === "live" && <IconFilm size={10} className="mr-0.5" />}
                {t === "static" && <IconImage size={10} className="mr-0.5" />}
                {t}
              </button>
            ))}
          </div>

          {/* Category pills */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={`rounded-full px-3 py-1 text-2xs transition-colors ${category === c ? "bg-[var(--accent-hex)] text-white" : "bg-[var(--surface-overlay)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`}>
                {c}
              </button>
            ))}
          </div>

          {/* Windowed grid — only tiles near the viewport mount media (C1.10–C1.11) */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((w) => (
              <div
                key={w.id}
                role="button"
                tabIndex={0}
                onClick={() => onApply(w.file, w.type)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onApply(w.file, w.type); } }}
                onMouseEnter={() => setHoveredId(w.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="group relative aspect-video cursor-pointer overflow-hidden rounded-lg border border-[var(--border-default)] transition-all hover:border-[var(--border-accent)] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-hex)]"
                style={{ boxShadow: hoveredId === w.id ? `0 4px 20px ${w.dominantColor}44` : undefined, background: w.dominantColor }}
              >
                {w.type === "static" ? (
                  <img src={w.file} alt={w.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                ) : (
                  <LiveTile w={w} hovered={hoveredId === w.id} />
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="px-2 pb-1.5">
                    <div className="truncate text-2xs font-medium text-white" title={w.name}>{w.name}</div>
                    <div className="flex items-center gap-1">
                      {w.type === "live" && <span className="badge badge-accent !text-2xs !py-0">LIVE</span>}
                      <span className="text-2xs text-white/60">{w.category}</span>
                    </div>
                  </div>
                </div>
                {/* Turn this wallpaper into a full style (C1.18) */}
                <button
                  onClick={(e) => { e.stopPropagation(); onStyle(w); }}
                  className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-black/35 text-white/85 opacity-0 transition-opacity hover:bg-[var(--accent-hex)] hover:text-white group-hover:opacity-100"
                  title="Generate a complete style from this wallpaper"
                >
                  <IconStar size={11} />
                </button>
                {/* Dominant color indicator */}
                <div className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border border-white/30 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: w.dominantColor }} />
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="empty-state">No wallpapers match this filter.</div>
          )}

          <p className="mt-3 text-2xs text-[var(--text-tertiary)]">
            {WALLPAPER_COUNT.static} static + {WALLPAPER_COUNT.live} live wallpapers bundled. Images load lazily as you scroll; videos are on-demand and play on hover.
          </p>
        </div>
      )}
    </div>
  );
}

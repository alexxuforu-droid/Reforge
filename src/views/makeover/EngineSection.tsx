import type { Dispatch, RefObject, SetStateAction } from "react";
import type { EngineState, SceneConfig } from "../../lib/types";
import { InlineAlert, Section, StatusDot, ScenePreview } from "../../components/ui";
import { IconPower, IconPause, IconPlay, IconTrash } from "../../components/icons";

export type EngineSectionProps = {
  engine: EngineState | null;
  engineError: string | null;
  scenes: SceneConfig[] | null;
  scenesError: string | null;
  moodFilter: string;
  setMoodFilter: (v: string) => void;
  hoverScene: string | null;
  setHoverScene: Dispatch<SetStateAction<string | null>>;
  engineBusy: boolean;
  setStudioOpen: Dispatch<SetStateAction<boolean>>;
  applyScene: (s: SceneConfig) => void;
  stopScene: () => void;
  freezeScene: (frozen: boolean) => void;
  deleteCustomScene: (s: SceneConfig) => void;
  engineRef: RefObject<HTMLDivElement | null>;
  packBusy: boolean;
  exportScenePack: () => void;
};

export default function EngineSection({
  engine,
  engineError,
  scenes,
  scenesError,
  moodFilter,
  setMoodFilter,
  hoverScene,
  setHoverScene,
  engineBusy,
  setStudioOpen,
  applyScene,
  stopScene,
  freezeScene,
  deleteCustomScene,
  engineRef,
  packBusy,
  exportScenePack,
}: EngineSectionProps) {
  return (
    <div ref={engineRef}>
    <Section title="Animated Wallpaper Engine" subtitle="Living, breathing desktops — procedural scenes render behind your icons" actions={<div className="flex gap-2"><button className="btn-ghost shrink-0 text-2xs" onClick={() => setStudioOpen(true)}>Wallpaper Studio</button>{engine?.active ? (<><button className="btn-ghost shrink-0 text-2xs" onClick={() => freezeScene(!engine.frozen)}>{engine.frozen ? <><IconPlay size={11} /> Resume</> : <><IconPause size={11} /> Freeze</>}</button><button className="btn-danger shrink-0 text-2xs" disabled={engineBusy} onClick={stopScene}><IconPower size={11} /> Stop</button></>) : (<span className="badge badge-neutral">Not running</span>)}{engine?.scene && (<button className="btn-ghost shrink-0 text-2xs" disabled={packBusy} onClick={exportScenePack} title="Capture this scene (plus your current look) into a shareable pack">{packBusy ? "Capturing…" : "Export scene pack"}</button>)}</div>}>
      {engineError && <InlineAlert>{engineError}</InlineAlert>}
      {scenesError && <InlineAlert>{scenesError}</InlineAlert>}
      {engine?.active && (
        <div className="mb-3 rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2 text-xs text-[var(--status-success)]">
          <StatusDot status="success" pulse /> {engine.scene?.name ?? "Scene"} is live{engine.frozen ? " (frozen)" : ""}
        </div>
      )}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {["all", "calm", "energetic", "nature", "space", "seasonal"].map((m) => (
          <button key={m} onClick={() => setMoodFilter(m)} className={`rounded-full px-3 py-1 text-xs capitalize transition-colors ${moodFilter === m ? "bg-[var(--accent-hex)] text-white" : "bg-[var(--surface-overlay)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`}>
            {m}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {(scenes ?? []).filter((s) => moodFilter === "all" || s.mood === moodFilter).map((s) => (
          <div key={s.id} onMouseEnter={() => setHoverScene(s.id)} onMouseLeave={() => setHoverScene((h) => (h === s.id ? null : h))} className={`group relative overflow-hidden rounded-xl border text-left transition-colors ${engine?.scene?.id === s.id ? "border-[var(--status-success-border)]" : "border-[var(--border-default)] hover:border-[var(--border-accent)]"}`}>
            <button onClick={() => applyScene(s)} disabled={engineBusy} className="w-full">
              <div className="h-24 w-full overflow-hidden">
                {hoverScene === s.id ? (
                  <ScenePreview kind={s.kind} colors={s.colors} speed={s.speed} density={s.density} className="h-full w-full" />
                ) : (
                  // static color story until hovered — zero canvases on load (S7.6, content preview)
                  <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${s.colors[1] ?? s.colors[0]}, ${s.colors[0]})` }} />
                )}
              </div>
              <div className="p-2.5">
                <div className="truncate text-xs font-semibold text-[var(--text-primary)]" title={s.name}>{s.name}</div>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="text-2xs capitalize text-[var(--text-tertiary)]">{s.kind}</span>
                  {engine?.scene?.id === s.id ? <span className="badge badge-success">LIVE</span> : <span className="text-2xs text-[var(--text-secondary)]">Apply</span>}
                </div>
              </div>
            </button>
            {s.id.startsWith("custom-") && (
              <button
                onClick={() => deleteCustomScene(s)}
                className="absolute right-1.5 top-1.5 rounded-md bg-black/45 p-1 text-white/80 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                title="Delete custom scene"
              >
                <IconTrash size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
    </Section>
    </div>
  );
}

import type { Dispatch, SetStateAction } from "react";
import { call, fmtAge, swallow } from "../../lib/api";
import type { AutomationConfig, BundleInfo, StyleScheduleEntry } from "../../lib/types";
import { InlineAlert, Section, SettingRow, Toggle } from "../../components/ui";
import { IconPlus } from "../../components/icons";

export type StyleOptionGroup = { tier: string; items: { id: string; name: string }[] };

export type AutomationSectionProps = {
  t: (key: string) => string;
  automation: AutomationConfig | null;
  automationError: string | null;
  updateAutomation: (patch: Partial<AutomationConfig>) => void;
  runningMaintenance: boolean;
  runDueMaintenance: () => void;
  blueOn: boolean;
  blueIntensity: number;
  setBlueIntensity: Dispatch<SetStateAction<number>>;
  toggleBlueLight: (on: boolean) => void;
  blSchedule: boolean;
  setBlSchedule: Dispatch<SetStateAction<boolean>>;
  blStart: string;
  setBlStart: Dispatch<SetStateAction<string>>;
  blEnd: string;
  setBlEnd: Dispatch<SetStateAction<string>>;
  styleSchedule: StyleScheduleEntry[];
  updateScheduledStyle: (id: string, patch: Partial<StyleScheduleEntry>) => void;
  removeScheduledStyle: (id: string) => void;
  addScheduledStyle: () => void;
  pickStyleId: string;
  setPickStyleId: Dispatch<SetStateAction<string>>;
  pickTime: string;
  setPickTime: Dispatch<SetStateAction<string>>;
  styleOptions: StyleOptionGroup[];
  installedBundles: BundleInfo[] | null;
  pickPackId: string;
  setPickPackId: Dispatch<SetStateAction<string>>;
  pickPackTime: string;
  setPickPackTime: Dispatch<SetStateAction<string>>;
  addScheduledPack: () => void;
};

export default function AutomationSection({
  t,
  automation,
  automationError,
  updateAutomation,
  runningMaintenance,
  runDueMaintenance,
  blueOn,
  blueIntensity,
  setBlueIntensity,
  toggleBlueLight,
  blSchedule,
  setBlSchedule,
  blStart,
  setBlStart,
  blEnd,
  setBlEnd,
  styleSchedule,
  updateScheduledStyle,
  removeScheduledStyle,
  addScheduledStyle,
  pickStyleId,
  setPickStyleId,
  pickTime,
  setPickTime,
  styleOptions,
  installedBundles,
  pickPackId,
  setPickPackId,
  pickPackTime,
  setPickPackTime,
  addScheduledPack,
}: AutomationSectionProps) {
  return (
    <Section bare title={t("settings.automation")} subtitle={t("settings.automation.subtitle")}>
      {automationError && <InlineAlert>{automationError}</InlineAlert>}

      {/* S11.6 — maintenance dashboard: last-run status + next-run countdown
          + per-task toggles + run-now. The countdown mirrors the backend's
          first-run rule (a fresh config waits 24h before its first auto-run). */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-overlay)] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Weekly junk cleanup</span>
            <Toggle on={automation?.weekly_junk ?? false} onChange={(v) => updateAutomation({ weekly_junk: v })} label="Weekly junk cleanup" />
          </div>
          <div className="mt-1 text-2xs text-[var(--text-tertiary)]">
            {automation?.last_weekly_run ? `Last run ${fmtAge(automation.last_weekly_run)} · ` : "Never run · "}
            {maintenanceStatus(automation?.last_weekly_run ?? 0, automation?.created_at ?? 0, 7 * 86400_000)}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-overlay)] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Monthly duplicate scan</span>
            <Toggle on={automation?.monthly_dupes ?? false} onChange={(v) => updateAutomation({ monthly_dupes: v })} label="Monthly duplicate scan" />
          </div>
          <div className="mt-1 text-2xs text-[var(--text-tertiary)]">
            {automation?.last_monthly_run ? `Last run ${fmtAge(automation.last_monthly_run)} · ` : "Never run · "}
            {maintenanceStatus(automation?.last_monthly_run ?? 0, automation?.created_at ?? 0, 30 * 86400_000)}
          </div>
        </div>
      </div>
      <div className="mt-2">
        <button className="btn-ghost btn-sm" onClick={runDueMaintenance} disabled={runningMaintenance}>
          {runningMaintenance ? "Running…" : "Run due maintenance now"}
        </button>
        <span className="ml-2 text-2xs text-[var(--text-tertiary)]">
          Also runs automatically when a task is due (runs stay in History).
        </span>
      </div>

      <div className="my-4 h-px bg-[var(--border-subtle)]" />

      <SettingRow
        title="Re-apply my look on login"
        description="Restore your accent, mode, transparency, font, sound and wallpaper style after Windows restarts"
        control={<Toggle on={automation?.auto_reapply_theme ?? false} onChange={(v) => updateAutomation({ auto_reapply_theme: v })} label="Re-apply my look on login" />}
      />

      <SettingRow
        title="Blue light filter"
        description={`Warm screen tint in the evening — intensity ${(blueIntensity * 100).toFixed(0)}%`}
        control={
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0.1}
              max={0.8}
              step={0.05}
              value={blueIntensity}
              onChange={(e) => {
                const v = +e.target.value;
                setBlueIntensity(v);
                // Persist the intensity even while off so it survives a reload
                // and is ready the moment the filter is toggled on (A2.1).
                call("set_blue_light", { on: blueOn, intensity: v }).catch((e) => swallow("set_blue_light slider", e));
              }}
              className="w-36"
              aria-label="Blue light intensity"
            />
            <Toggle on={blueOn} onChange={toggleBlueLight} disabled={blSchedule} label="Blue light filter" />
            {blSchedule && (
              <span className="text-2xs text-[var(--text-tertiary)]">follows your schedule</span>
            )}
          </div>
        }
      />

      {/* S11.1 — time-based blue light with a 10-min transition ramp. */}
      <SettingRow
        title="Blue light schedule"
        description="Turn the filter on/off automatically with a 10-minute gentle fade. Start after end = overnight (e.g. 19:00 → 07:00)."
        control={<Toggle on={blSchedule} onChange={(v) => { setBlSchedule(v); updateAutomation({ blue_light_schedule: v }); }} label="Blue light schedule" />}
      />
      {blSchedule && (
        <div className="mb-3 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input
            type="time"
            value={blStart}
            onChange={(e) => { setBlStart(e.target.value); updateAutomation({ blue_light_start: e.target.value }); }}
            className="input w-32"
            aria-label="Blue light start time"
          />
          <span>to</span>
          <input
            type="time"
            value={blEnd}
            onChange={(e) => { setBlEnd(e.target.value); updateAutomation({ blue_light_end: e.target.value }); }}
            className="input w-32"
            aria-label="Blue light end time"
          />
        </div>
      )}

      {/* S11.3 — wall-clock style applies (morning/evening/any time). */}
      <div className="mb-1 mt-4 text-sm font-medium text-[var(--text-primary)]">Scheduled styles</div>
      <p className="mb-2 text-2xs text-[var(--text-tertiary)]">
        Apply a style at a set time — a morning look, an evening look, anything. Each apply is one revertible History entry.
      </p>
      <div className="space-y-2">
        {styleSchedule.length === 0 && !automationError && (
          <p className="text-2xs text-[var(--text-tertiary)]">
            No scheduled styles yet. Pick a style and a time below.
          </p>
        )}
        {styleSchedule.map((e) => (
          <div key={e.id} className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-overlay)] px-3 py-2">
            <input
              type="time"
              value={e.time}
              onChange={(ev) => updateScheduledStyle(e.id, { time: ev.target.value })}
              className="input w-32"
              aria-label={`Time for ${e.name}`}
            />
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]" title={e.name}>{e.name}</span>
            <button
              onClick={() => removeScheduledStyle(e.id)}
              className="shrink-0 text-2xs text-[var(--status-danger)] hover:underline"
              aria-label={`Remove scheduled style ${e.name}`}
            >
              Remove
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={pickStyleId}
            onChange={(e) => setPickStyleId(e.target.value)}
            className="h-8 max-w-64 rounded-[4px] border border-[#8A8A8A] bg-[var(--surface-base)] px-2 text-sm text-[var(--text-primary)]"
            aria-label="Style to schedule"
          >
            <option value="">Pick a style…</option>
            {styleOptions.map((g) => (
              <optgroup key={g.tier} label={g.tier[0].toUpperCase() + g.tier.slice(1)}>
                {g.items.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <input
            type="time"
            value={pickTime}
            onChange={(e) => setPickTime(e.target.value)}
            className="input w-32"
            aria-label="Scheduled style time"
          />
          <button className="btn-primary btn-sm" onClick={addScheduledStyle} disabled={!pickStyleId}>
            <IconPlus size={13} /> Schedule
          </button>
        </div>
        {/* P5-7 — pack rotation: schedule an installed pack instead of a style. */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select
            value={pickPackId}
            onChange={(e) => setPickPackId(e.target.value)}
            className="h-8 max-w-64 rounded-[4px] border border-[#8A8A8A] bg-[var(--surface-base)] px-2 text-sm text-[var(--text-primary)]"
            aria-label="Pack to schedule"
          >
            <option value="">Schedule a pack…</option>
            {(installedBundles ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <input
            type="time"
            value={pickPackTime}
            onChange={(e) => setPickPackTime(e.target.value)}
            className="input w-32"
            aria-label="Scheduled pack time"
          />
          <button className="btn-ghost btn-sm" onClick={addScheduledPack} disabled={!pickPackId}>
            <IconPlus size={13} /> Schedule pack
          </button>
        </div>
        {(installedBundles ?? []).length === 0 && (
          <p className="text-2xs text-[var(--text-tertiary)]">
            No packs installed — capture or import one in Pack Marketplace to schedule a rotating look.
          </p>
        )}
      </div>
    </Section>
  );
}

/** S11.6 — next-run countdown text, mirroring the backend's first-run rule:
 *  a fresh config (last run 0) waits 24h after creation before its first
 *  auto-run; afterwards it's last-run + interval. */
function maintenanceStatus(lastRun: number, createdAt: number, intervalMs: number): string {
  const next =
    lastRun === 0
      ? createdAt === 0
        ? null
        : createdAt + 24 * 3600 * 1000
      : lastRun + intervalMs;
  if (next === null) return "next run unknown";
  const diff = next - Date.now();
  if (diff <= 0) return "due now";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `next in ${d}d ${h}h`;
  if (h > 0) return `next in ${h}h ${m}m`;
  return `next in ${Math.max(1, m)}m`;
}

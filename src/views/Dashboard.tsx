import { useEffect, useMemo, useRef, useState } from "react";
import { call, fmt, fmtAge } from "../lib/api";
import { riskScore, riskTrend } from "../lib/risk";
import { useLoad } from "../lib/useLoad";
import { useI18n } from "../i18n";
import { useFinePointer, useReducedMotion } from "../components/motion/useMotionPrefs";
import type { DashboardMetrics, HealthScore, SystemInfo, UndoDigest } from "../lib/types";
import { InlineAlert, EmptyState, Meter, ScoreRing, Section, StatCard, StatusDot, toast } from "../components/ui";
import { Sparkline } from "../components/charts";
import {
  NavMakeover, IconCpu, IconHardDrive, IconClock, IconShieldCheck,
} from "../components/icons";

interface SecurityDigest {
  overall: string;
  third_party_active: boolean;
  tamper_protection: boolean | null;
  recent_scans: { ts: number; scan_type: string; result: string; threats_found: number }[];
}
import { hasResumableSession, loadSession, sessionAgeMinutes } from "../lib/sessionStore";
import type { View } from "../App";

export default function Dashboard({ onNavigate = () => {} }: { onNavigate?: (v: View) => void }) {
  const { t } = useI18n();
  const [health, setHealth] = useState<HealthScore | null>(null);
  const [sys, setSys] = useState<SystemInfo | null>(null);
  // S2.2 — state-critical loads through useLoad: one toast per command per
  // session on first failure + a real error surface (InlineAlert) per section.
  const { data: metrics, error: metricsError } = useLoad<DashboardMetrics>("get_dashboard_metrics");
  // v1.1 Task 2 — hot path uses the digest (counts + top-5, ~0.6 KB) instead
  // of the full undo log (~336 KB). History.tsx stays on get_undo_log: it is
  // the only consumer that reads entry `data`.
  const { data: recent, error: recentError } = useLoad<UndoDigest>("get_undo_digest");
  // P1-8 — one-call security digest from the Security Center.
  const { data: digest } = useLoad<SecurityDigest>("security_get_digest");
  // D4 — risk score inputs: flagged autorun entries (already suspicious items).
  const { data: flagged } = useLoad<{ flags: string[] }[]>("security_audit_autorun_threat_surface");
  const risk = useMemo(() => riskScore({
    startup: health?.startup_count ?? 0,
    autorunFlags: (flagged ?? []).length,
    defenderOn: digest ? digest.overall === "healthy" || digest.overall === "attention" : true,
  }), [health, flagged, digest]);
  const [resumeAge, setResumeAge] = useState<number | null>(null);
  const magnet = useMagneticCta();

  useEffect(() => {
    if (hasResumableSession()) setResumeAge(sessionAgeMinutes(loadSession()));
  }, []);

  useEffect(() => {
    call<HealthScore>("get_health_score").then(setHealth).catch(() => toast("Could not load health score", "err"));
    call<SystemInfo>("get_system_info").then(setSys).catch(() => toast("Could not load system info", "err"));
  }, []);

  const recentList = recent?.recent ?? [];
  // X-6 — activity trends from the digest's by_day counts (same bar labels as
  // the old full-log bucketing, no payload bytes over IPC).
  const trendBuckets = useMemo(() => lastDaysFromByDay(recent?.by_day ?? {}, 14), [recent]);
  const trendPeak = Math.max(1, ...trendBuckets.map((b) => b.count));
  const monthBuckets = useMemo(() => lastMonthsFromByDay(recent?.by_day ?? {}, 6), [recent]);
  const monthPeak = Math.max(1, ...monthBuckets.map((b) => b.count));
  // Risk v2 trend — daily 0-100 scores from the digest's by_day counts via
  // riskTrend() (same scale as the risk card above). Empty until the first
  // logged change.
  const riskTrendPoints = useMemo(() => (recent ? riskTrend(recent, 14) : []), [recent]);
  const riskTrendLast = riskTrendPoints.length > 0 ? riskTrendPoints[riskTrendPoints.length - 1].score : null;
  const riskTrendColor =
    riskTrendLast === null || riskTrendLast >= 75
      ? "var(--status-success)"
      : riskTrendLast >= 40
        ? "var(--status-warning)"
        : "var(--status-danger)";
  const latestChange = recent?.recent[0] ?? null;

  const disk = sys?.disks.length ? [...sys.disks].sort((a, b) => a.free_pct - b.free_pct)[0] : null;
  const ramPct = sys ? ((sys.ram_total - sys.ram_used) / sys.ram_total) * 100 : 0;

  return (
    <div className="space-y-4">
      <header className="page-head">
        <h1 className="page-title">Welcome back</h1>
        <p className="page-subtitle">
          {sys ? `${sys.host} · ${sys.os}` : "Loading your PC…"}
        </p>
      </header>

      {/* Health & Personalization side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* PC Health Score — primary card */}
          <Section title="PC Health Score" subtitle="How your machine is feeling today">
            <div className="flex flex-col items-center gap-4">
              <ScoreRing score={health?.score ?? 0} />
              <div className="w-full space-y-2.5">
                {health?.breakdown.map((b) => (
                  <div key={b.label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-[var(--text-tertiary)]">{b.label}</span>
                      <span className="text-[var(--text-secondary)]">
                        {b.points}/{b.max}
                      </span>
                    </div>
                    <Meter
                      value={b.points}
                      max={b.max}
                      color={
                        b.points / b.max > 0.6
                          ? "var(--status-success)"
                          : b.points / b.max > 0.3
                            ? "var(--status-warning)"
                            : "var(--status-danger)"
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Personalization Score */}
          <Section title="Personalization Score" subtitle="How much your PC feels like yours">
            {metricsError && <InlineAlert>{metricsError}</InlineAlert>}
            <div className="flex flex-col items-center gap-4">
              <ScoreRing score={metrics?.personalization_score ?? 0} />
              <div className="w-full space-y-1.5">
                {metrics?.active_features.map((f) => (
                  <div
                    key={f}
                    className="flex items-center gap-2 rounded-lg bg-[var(--surface-overlay)] px-3 py-1.5 text-xs text-[var(--text-secondary)]"
                  >
                    <span className="h-1 w-1 rounded-full bg-[var(--status-success)]" />
                    {f}
                  </div>
                ))}
                {(!metrics || metrics.active_features.length === 0) && (
                  <p className="text-center text-xs text-[var(--text-tertiary)]">
                    Head to Makeover and make something yours
                  </p>
                )}
              </div>
            </div>
          </Section>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="RAM free"
            value={sys ? `${ramPct.toFixed(0)}%` : "…"}
            sub={sys ? `${fmt(sys.ram_total - sys.ram_used)} free of ${fmt(sys.ram_total)}` : ""}
            accent={
              ramPct > 40 ? "var(--status-success)" : ramPct > 20 ? "var(--status-warning)" : "var(--status-danger)"
            }
            icon={<IconHardDrive size={14} />}
          />
          <StatCard
            label="CPU load"
            value={sys ? `${sys.cpu_usage_pct.toFixed(1)}%` : "…"}
            sub={sys ? `${sys.cpu_name}` : ""}
            accent={sys && sys.cpu_usage_pct < 60 ? "var(--status-success)" : "var(--status-warning)"}
            icon={<IconCpu size={14} />}
          />
          <StatCard
            label="Lowest disk"
            value={disk ? `${disk.free_pct.toFixed(0)}%` : "…"}
            sub={disk ? `${disk.mount} — ${fmt(disk.free)} free` : ""}
            accent={disk && disk.free_pct > 20 ? "var(--status-success)" : "var(--status-danger)"}
          />
          <StatCard
            label="Startup entries"
            value={health ? String(health.startup_count) : "…"}
            sub="apps launching at boot"
            accent={health && health.startup_count <= 5 ? "var(--status-success)" : "var(--status-warning)"}
          />
          <StatCard
            label="Last cleanup"
            value={health?.last_cleanup_ts ? fmtAge(health.last_cleanup_ts) : "Never"}
            sub="junk & cache"
          />
          <StatCard
            label="Storage freed"
            value={metrics ? fmt(metrics.storage_freed) : "…"}
            animateValue={metrics?.storage_freed}
            formatValue={fmt}
            sub="junk, duplicates & stale files"
            accent="var(--status-success)"
          />
          <StatCard
            label="Time saved"
            value={metrics ? `${fmtTime(metrics.time_saved_secs)}` : "…"}
            sub={`${metrics?.files_organized ?? 0} files organized`}
            accent="var(--gray-10)"
          />
          <StatCard
            label="Security"
            value={digest ? digest.overall : "…"}
            sub={
              digest && digest.recent_scans.length > 0
                ? `last ${digest.recent_scans[0].scan_type} scan · ${digest.recent_scans[0].threats_found} threat(s)`
                : "no scans yet — run one in Security"
            }
            accent={
              digest?.overall === "healthy"
                ? "var(--status-success)"
                : digest?.overall === "attention"
                  ? "var(--status-warning)"
                  : "var(--status-danger)"
            }
            icon={<IconShieldCheck size={14} />}
          />
          <StatCard
            label={t("dashboard.risk")}
            value={health && digest ? `${risk.score}` : "…"}
            sub={t("dashboard.risk.sub", {
              startup: health?.startup_count ?? 0,
              flags: (flagged ?? []).length,
              defender: digest ? digest.overall : "…",
            })}
            accent={
              risk.level === "low"
                ? "var(--status-success)"
                : risk.level === "medium"
                  ? "var(--status-warning)"
                  : "var(--status-danger)"
            }
            icon={<IconShieldCheck size={14} />}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <Section title="Quick actions">
        <div className="flex flex-wrap gap-2">
          <button ref={magnet.ref} className="btn-primary btn-sm magnet-label" onClick={() => onNavigate("makeover")} style={magnet.style} {...magnet.handlers}>
            <NavMakeover size={14} /> {resumeAge !== null ? "Resume makeover" : "Makeover"}
          </button>
          {resumeAge !== null && (
            <span className="self-center text-2xs text-[var(--text-tertiary)]">
              a session is in progress — saved {resumeAge}m ago
            </span>
          )}
          <button className="btn-ghost btn-sm" onClick={() => onNavigate("tuneup")}>
            Scan junk
          </button>
          <button className="btn-ghost btn-sm" onClick={() => onNavigate("history")}>
            <IconClock size={14} /> History
          </button>
          <button className="btn-ghost btn-sm" onClick={() => onNavigate("performance")}>
            Performance
          </button>
        </div>
      </Section>

      {/* Recent Activity */}
      <Section
        title="Recent activity"
        subtitle="Your last makeover moves"
        actions={
          <button
            className="btn-ghost btn-sm shrink-0"
            onClick={() => onNavigate("history")}
          >
            Open timeline
          </button>
        }
      >
        {recentError ? (
          <InlineAlert>{recentError}</InlineAlert>
        ) : recentList.length === 0 ? (
          <div className="empty-state">
            Nothing yet — every change you make is logged here and on the History timeline.
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentList.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-lg bg-[var(--surface-overlay)] px-3 py-2"
              >
                <StatusDot status={e.revertible ? "success" : "info"} />
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-secondary)]" title={e.description}>
                  {e.description}
                </span>
                <span className="shrink-0 text-2xs text-[var(--text-tertiary)]">{fmtAge(e.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Activity Trends (X-6) — changes per day from your local History */}
      <Section title={t("analytics.title")} subtitle={t("analytics.subtitle")}>
        {(recent?.total ?? 0) === 0 ? (
          <div className="empty-state">
            {t("analytics.empty")}
          </div>
        ) : (
          <div className="space-y-4">
            {latestChange && (
              <p aria-live="polite" className="text-xs text-[var(--text-secondary)]">
                {t("analytics.away", { desc: latestChange.description, age: fmtAge(latestChange.ts) })}
              </p>
            )}
            <div>
              <div className="mb-1 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{t("analytics.daily")}</div>
              <div className="flex h-24 items-end gap-1" role="img" aria-label={`Changes per day for 14 days, busiest day ${trendPeak} changes`}>
                {trendBuckets.map((b) => (
                  <div
                    key={b.label}
                    title={`${b.label}: ${b.count} change${b.count === 1 ? "" : "s"}`}
                    aria-hidden="true"
                    className="min-w-0 flex-1 rounded-t bg-[var(--accent-hex)] opacity-80"
                    style={{ height: `${Math.max(4, Math.round((b.count / trendPeak) * 100))}%`, opacity: b.count === 0 ? 0.15 : 0.8 }}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{t("analytics.monthly")}</div>
              <div className="flex h-16 items-end gap-1.5" role="img" aria-label={`Changes per month for 6 months, busiest month ${monthPeak} changes`}>
                {monthBuckets.map((b) => (
                  <div
                    key={b.label}
                    title={`${b.label}: ${b.count} change${b.count === 1 ? "" : "s"}`}
                    aria-hidden="true"
                    className="min-w-0 flex-1 rounded-t bg-[var(--accent-hex)] opacity-80"
                    style={{ height: `${Math.max(4, Math.round((b.count / monthPeak) * 100))}%`, opacity: b.count === 0 ? 0.15 : 0.8 }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Risk trend (Risk v2) — daily 0-100 score from the undo digest */}
      <Section title="Risk trend" subtitle="Daily score from your local change history — higher is calmer">
        {riskTrendPoints.length === 0 ? (
          <EmptyState
            title="No risk history yet"
            description="Make a change and your daily risk trend will appear here."
          />
        ) : (
          <div>
            <div className="mb-1 flex items-baseline justify-between text-2xs text-[var(--text-tertiary)]">
              <span>
                {riskTrendPoints[0].day} → {riskTrendPoints[riskTrendPoints.length - 1].day}
              </span>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {riskTrendLast}
              </span>
            </div>
            <div
              role="img"
              aria-label={`Daily risk score for ${riskTrendPoints.length} days, latest ${riskTrendLast} out of 100`}
            >
              <Sparkline
                data={riskTrendPoints.map((p) => p.score)}
                color={riskTrendColor}
                maxOverride={100}
              />
            </div>
          </div>
        )}
      </Section>

      {/* Resource Hogs */}
      {sys && (
        <Section title="Resource hogs" subtitle="Top processes by memory">
          <div className="space-y-2">
            {sys.top_processes.map((p) => (
              <div
                key={p.name}
                className="flex items-center gap-3 rounded-xl bg-[var(--surface-overlay)] px-3 py-2"
              >
                <span className="w-48 truncate text-sm text-[var(--text-primary)]" title={p.name}>{p.name}</span>
                <div className="flex-1">
                  <Meter
                    value={p.mem_mb}
                    max={sys.top_processes[0]?.mem_mb ?? 1}
                    color="var(--gray-10)"
                  />
                </div>
                <span className="w-20 text-right text-xs text-[var(--text-tertiary)]">
                  {fmt(p.mem_mb * 1024 * 1024)}
                </span>
                <span className="w-16 text-right text-2xs text-[var(--text-tertiary)]">
                  {p.cpu_pct.toFixed(1)}% cpu
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* System Vitals */}
      {sys && (
        <Section title="System vitals" subtitle="Quick glance at your machine">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "OS", value: sys.os, sub: sys.host },
              { label: "CPU", value: sys.cpu_name, sub: `${sys.cpu_count} cores` },
              { label: "RAM", value: fmt(sys.ram_total), sub: `${ramPct.toFixed(0)}% free` },
              { label: "Disks", value: `${sys.disks.length} drive${sys.disks.length === 1 ? "" : "s"}`, sub: sys.disks.map((d) => `${d.mount} ${d.free_pct.toFixed(0)}%`).join(", ") },
            ].map((v) => (
              <div key={v.label} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-overlay)] px-4 py-3">
                <div className="text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{v.label}</div>
                <div className="mt-1 truncate text-sm font-medium text-[var(--text-primary)]" title={v.value}>{v.value}</div>
                <div className="truncate text-2xs text-[var(--text-tertiary)]" title={v.sub}>{v.sub}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function fmtTime(secs: number): string {
  if (secs >= 3600) return `${(secs / 3600).toFixed(1)} hrs`;
  if (secs >= 60) return `${Math.round(secs / 60)} min`;
  return `${secs}s`;
}

// v1.1 Task 2 — bar buckets straight from the digest's by_day (YYYY-MM-DD).
// Same labels the full-log bucketByDay/bucketByMonth produced ("M/D", "Mon").
// Caveat: Rust keys days in UTC while these look up local days, so entries
// logged near local midnight can sit one bar off vs the old exact-ts bucketing.
function lastDaysFromByDay(byDay: Record<string, number>, days = 14): { label: string; count: number }[] {
  const out: { label: string; count: number }[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, count: byDay[key] ?? 0 });
  }
  return out;
}

function lastMonthsFromByDay(byDay: Record<string, number>, months = 6): { label: string; count: number }[] {
  const now = new Date();
  const out: { label: string; count: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
    let count = 0;
    for (const [k, v] of Object.entries(byDay)) if (k.startsWith(prefix)) count += v;
    out.push({ label: ref.toLocaleString("en-US", { month: "short" }), count });
  }
  return out;
}

// Magnetic "Start makeover" nudge (Task 3): the button leans toward the
// cursor while it is within MAGNET_PX of the button center, clamped to a
// MAX_PX magnitude so the click target never moves more than 2px. Plain
// static button on touch pointers and under reduced-motion; the offset also
// snaps back to rest on leave/press so it never sits displaced.
const MAGNET_PX = 120;
const MAX_PX = 2;

function useMagneticCta() {
  const reduced = useReducedMotion();
  const fine = useFinePointer();
  const ref = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [pressed, setPressed] = useState(false);
  const live = !reduced && fine;
  const onMove = (e: React.MouseEvent) => {
    if (!live || pressed) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const dist = Math.hypot(dx, dy);
    if (dist > MAGNET_PX || dist === 0) {
      setOffset((o) => (o.x === 0 && o.y === 0 ? o : { x: 0, y: 0 }));
      return;
    }
    const mag = Math.min(MAX_PX, dist / 60);
    setOffset({ x: Math.round((dx / dist) * mag * 10) / 10, y: Math.round((dy / dist) * mag * 10) / 10 });
  };
  const reset = () => setOffset((o) => (o.x === 0 && o.y === 0 ? o : { x: 0, y: 0 }));
  return {
    ref,
    handlers: live
      ? {
          onMouseMove: onMove,
          onMouseLeave: reset,
          onPointerDown: () => {
            setPressed(true);
            reset();
          },
          onPointerUp: () => setPressed(false),
        }
      : {},
    style: offset.x === 0 && offset.y === 0 ? undefined : { transform: `translate(${offset.x}px, ${offset.y}px)` },
  };
}

import { useCallback, useEffect, useState } from "react";
import { errorCopy, call, callWithTimeout } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { useI18n } from "../i18n";
import type { AuditItem, PermissionState, PrivacyPolicyItem, UsbDevice } from "../lib/types";
import { InlineAlert, Modal, Progress, Section, Select, StatusDot, Toggle, toast } from "../components/ui";
import {
  IconShieldCheck, IconShieldAlert, IconShieldX,
  IconScan, IconFingerprint, IconRefresh, IconChevronDown, IconChevronUp,
  IconPlus, IconTrash, IconExternalLink, IconTimer,
} from "../components/icons";

interface HealthStatus {
  overall_status: string;
  antivirus: { name: string; enabled: boolean; up_to_date: boolean }[];
  firewall: { name: string; enabled: boolean }[];
  third_party_active: boolean;
  tamper_protection_on: boolean | null;
  defender_detail: DefenderDetail | null;
}

interface DefenderDetail {
  real_time_protection_on: boolean | null;
  last_scan_type: string | null;
  last_scan_time: string | null;
  last_scan_result: string | null;
  signature_age_days: number | null;
  definitions_up_to_date: boolean | null;
  definitions_age: string | null;
  tamper_protection: boolean | null;
  behavior_monitor_on: boolean | null;
  nis_on: boolean | null;
  on_access_protection_on: boolean | null;
  ioav_protection_on: boolean | null;
}

interface RegisteredProduct {
  name: string;
  product_kind: string; // "antivirus" | "firewall" | "antispyware"
  enabled: boolean;
  up_to_date: boolean;
  product_state_hex: string;
}

interface ThreatEntry {
  id: string;
  name: string;
  severity: string;
  category_description: string;
  date: string;
  state: string;
  path: string;
}

interface ScanHistoryEntry {
  ts: number;
  scan_type: string;
  result: string;
  threats_found: number;
}

interface FlaggedEntry {
  name: string;
  location: string;
  command: string;
  flags: string[];
  is_signed: boolean | null;
}

interface Exclusion {
  target: string;
  kind: string; // "path" | "extension" | "process"
}

const HEALTH_COLORS: Record<string, string> = {
  healthy: "border-[var(--status-success-border)] bg-[var(--status-success-bg)]",
  attention: "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]",
  critical: "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)]",
  unknown: "border-[var(--border-default)] bg-[var(--surface-overlay)]",
};

const KIND_LABEL: Record<string, string> = { path: "Folder / file path", extension: "File extension", process: "Process name" };

function DefenderLayerRow({ label, on, warning }: { label: string; on: boolean | null; warning?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3 py-2">
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      <StatusDot status={on ? "success" : warning ? "warning" : "danger"} />
    </div>
  );
}

export default function Security() {
  const { t } = useI18n();
  const [_items, setItems] = useState<AuditItem[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [scanHist, setScanHist] = useState<ScanHistoryEntry[]>([]);
  const [threats, setThreats] = useState<ThreatEntry[]>([]);
  const [flagged, setFlagged] = useState<FlaggedEntry[]>([]);
  const [cfaMode, setCfaMode] = useState("disabled");
  const [confirm, setConfirm] = useState<{ title: string; body: string; confirmLabel: string; run: () => void } | null>(null);

  // P1-1 — full Defender detail card (behavior monitor, NIS, on-access, IOAV, last scan).
  const { data: defender, error: defenderError, refresh: refreshDefender } = useLoad<DefenderDetail | null>("security_get_defender_detail");
  // P1-3 — third-party protection products registered with Windows Security Center.
  const { data: products, error: productsError, refresh: refreshProducts } = useLoad<RegisteredProduct[]>("security_list_registered_products");

  // P1-4 — exclusions manager.
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [exclusionsError, setExclusionsError] = useState<string | null>(null);
  const [exclusionTarget, setExclusionTarget] = useState("");
  const [exclusionKind, setExclusionKind] = useState("path");

  // P1-5 — CFA allowlist add/remove (Defender has no clean "list" surface for
  // these via one command, so the manager is add/remove with honest copy).
  const [cfaApp, setCfaApp] = useState("");
  const [cfaFolder, setCfaFolder] = useState("");

  // P1-6 — temporary real-time-protection disable with a live countdown.
  const [rtDisabled, setRtDisabled] = useState<{ disabled: boolean; remaining_secs: number }>({ disabled: false, remaining_secs: 0 });
  const [rtMinutes, setRtMinutes] = useState("10");
  const [rtBusy, setRtBusy] = useState(false);

  // P1-7 — live scan progress polling.
  const [scanActive, setScanActive] = useState(false);

  // P1-2 / P1-9 — drill-down expanders.
  const [expandedThreat, setExpandedThreat] = useState<string | null>(null);
  const [threatDetail, setThreatDetail] = useState<Record<string, unknown> | null>(null);
  const [threatDetailError, setThreatDetailError] = useState<string | null>(null);
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null);
  const [flagDetail, setFlagDetail] = useState<Record<string, unknown> | null>(null);
  const [flagDetailError, setFlagDetailError] = useState<string | null>(null);

  // S2.2 — the Privacy Audit trio + ASR rules load through useLoad: real
  // error surfaces, one toast per command per session on first failure.
  const { data: perms, error: permsError } = useLoad<PermissionState[]>("get_permissions");
  const { data: privacy, error: privacyError } = useLoad<PrivacyPolicyItem[]>("get_browser_privacy");
  const { data: usb, error: usbError } = useLoad<UsbDevice[]>("get_usb_history");
  const { data: asrRules, error: asrError, refresh: refreshAsr } = useLoad<{ id: string; name: string; action: string }[]>("security_list_asr_rules");

  const loadExclusions = useCallback(() => {
    call<Exclusion[]>("security_manage_exclusions", { action: "list" })
      .then(setExclusions)
      .catch((e) => setExclusionsError(errorCopy(e)));
  }, []);

  useEffect(() => {
    loadExclusions();
  }, [loadExclusions]);

  // P1-6 — countdown ticker while real-time protection is paused.
  useEffect(() => {
    if (!rtDisabled.disabled) return;
    const id = window.setInterval(() => {
      call<{ disabled: boolean; remaining_secs: number }>("security_get_rt_disable_remaining_time")
        .then((s) => setRtDisabled(s))
        .catch(() => { /* transient — next tick retries */ });
    }, 1000);
    return () => window.clearInterval(id);
  }, [rtDisabled.disabled]);

  // P1-7 — poll scan progress while a scan is running; refresh results on completion.
  useEffect(() => {
    if (!scanActive) return;
    const id = window.setInterval(() => {
      call<{ in_progress: boolean; progress: number }>("security_get_scan_progress")
        .then((s) => {
          if (!s.in_progress) {
            setScanActive(false);
            run();
          }
        })
        .catch(() => { /* transient */ });
    }, 2000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanActive]);

  const run = useCallback(async () => {
    setScanning(true);
    try {
      const [r, h, sh, th, fl, cfa] = await Promise.all([
        call<AuditItem[]>("get_security_audit"),
        call<HealthStatus>("security_get_health_status"),
        call<ScanHistoryEntry[]>("security_get_scan_history"),
        call<ThreatEntry[]>("security_list_threats"),
        call<FlaggedEntry[]>("security_audit_autorun_threat_surface"),
        call<{ mode: string }>("security_get_cfa_status"),
      ]);
      setItems(r);
      setHealth(h);
      setScanHist(sh);
      setThreats(th);
      setFlagged(fl);
      setCfaMode(cfa.mode);
      refreshAsr();
      refreshDefender();
      refreshProducts();
      loadExclusions();
    } catch (e) {
      toast(errorCopy(e), "err");
    } finally {
      setScanning(false);
    }
  }, [refreshAsr, refreshDefender, refreshProducts, loadExclusions]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startScan = (scanType: string) => {
    // The trigger returns fast (the scan runs in its own thread); the timeout
    // only guards against a hung trigger.
    callWithTimeout("security_trigger_scan", { scan_type: scanType }, 30_000)
      .then((r: any) => {
        toast(r);
        setScanActive(true);
      })
      .catch((e) => toast(errorCopy(e), "err"));
  };

  const toggleThreatDetail = (t: ThreatEntry) => {
    if (expandedThreat === t.id) {
      setExpandedThreat(null);
      setThreatDetail(null);
      return;
    }
    setExpandedThreat(t.id);
    setThreatDetail(null);
    setThreatDetailError(null);
    call<Record<string, unknown>>("security_get_threat_detail", { threat_id: t.id })
      .then(setThreatDetail)
      .catch((e) => setThreatDetailError(errorCopy(e)));
  };

  const toggleFlagDetail = (f: FlaggedEntry) => {
    const key = `${f.name}::${f.location}`;
    if (expandedFlag === key) {
      setExpandedFlag(null);
      setFlagDetail(null);
      return;
    }
    setExpandedFlag(key);
    setFlagDetail(null);
    setFlagDetailError(null);
    call<Record<string, unknown>>("security_get_flagged_entry_detail", { name: f.name, location: f.location })
      .then(setFlagDetail)
      .catch((e) => setFlagDetailError(errorCopy(e)));
  };

  return (
    <div className="space-y-4">
      <header className="page-head flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{t("security.title")}</h1>
          <p className="page-subtitle">
            {t("security.subtitle")}
          </p>
        </div>
        <button className="btn-ghost shrink-0" onClick={run} disabled={scanning}>
          <IconRefresh size={14} /> {scanning ? "Loading…" : "Refresh"}
        </button>
      </header>

      {/* Security Health Dashboard */}
      {health && (
        <Section title={t("security.healthTitle")} subtitle={t("security.healthSubtitle")}>
          <div className="flex items-center gap-6">
            <div
              className={`rounded-2xl border px-6 py-4 text-center ${HEALTH_COLORS[health.overall_status] ?? HEALTH_COLORS.unknown}`}
            >
              <div className="mb-1">
                {health.overall_status === "healthy" ? (
                  <IconShieldCheck size={28} className="mx-auto text-[var(--status-success)]" />
                ) : health.overall_status === "attention" ? (
                  <IconShieldAlert size={28} className="mx-auto text-[var(--status-warning)]" />
                ) : (
                  <IconShieldX size={28} className="mx-auto text-[var(--status-danger)]" />
                )}
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                {health.overall_status}
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                <span className="text-[var(--text-tertiary)]">AV:</span>
                {health.antivirus.map((a) => a.name).join(", ") || "none"}
                {health.third_party_active && (
                  <span className="badge badge-info">3rd party</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                <span className="text-[var(--text-tertiary)]">Firewall:</span>
                <StatusDot status={health.firewall.some((f) => f.enabled) ? "success" : "danger"} />
                {health.firewall.some((f) => f.enabled) ? "ON" : "OFF"}
              </div>
              {health.defender_detail && (
                <>
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <span className="text-[var(--text-tertiary)]">RT Protection:</span>
                    <StatusDot status={health.defender_detail.real_time_protection_on ? "success" : "danger"} />
                    {health.defender_detail.real_time_protection_on ? "On" : "Off"}
                  </div>
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <span className="text-[var(--text-tertiary)]">Definitions:</span>
                    <StatusDot status={health.defender_detail.definitions_up_to_date ? "success" : "warning"} />
                    {health.defender_detail.definitions_up_to_date
                      ? "Up to date"
                      : `Stale (${health.defender_detail.signature_age_days ?? "?"}d)`}
                  </div>
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <span className="text-[var(--text-tertiary)]">Tamper:</span>
                    <StatusDot status={health.tamper_protection_on ? "success" : "warning"} />
                    {health.tamper_protection_on ? "On" : "Off"}
                  </div>
                </>
              )}
            </div>
            <div className="ml-auto flex gap-2">
              <button
                className="btn-ghost text-xs"
                disabled={scanActive}
                onClick={() => startScan("quick")}
              >
                <IconScan size={13} /> {t("security.quickScan")}
              </button>
              <button
                className="btn-ghost text-xs"
                disabled={scanActive}
                onClick={() => startScan("full")}
              >
                <IconScan size={13} /> {t("security.fullScan")}
              </button>
              <button
                className="btn-ghost text-xs"
                onClick={() => {
                  call("security_update_definitions")
                    .then((r: any) => toast(r))
                    .catch((e) => toast(errorCopy(e), "err"));
                }}
              >
                {t("security.updateDefs")}
              </button>
            </div>
          </div>

          {/* P1-7 — live scan progress */}
          {scanActive && (
            <div className="mt-4 flex items-center gap-3">
              <Progress indeterminate />
              <span className="text-xs text-[var(--text-secondary)]">Scan running in the background… results refresh when it finishes.</span>
            </div>
          )}

          {/* P1-1 — Defender protection layers */}
          {defender && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-medium text-[var(--text-tertiary)]">Defender protection layers</div>
              {defenderError && <InlineAlert>{defenderError}</InlineAlert>}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <DefenderLayerRow label="Real-time protection" on={defender.real_time_protection_on} />
                <DefenderLayerRow label="Behavior monitoring" on={defender.behavior_monitor_on} />
                <DefenderLayerRow label="Network inspection (NIS)" on={defender.nis_on} />
                <DefenderLayerRow label="On-access scanning" on={defender.on_access_protection_on} />
                <DefenderLayerRow label="IOAV (downloaded files)" on={defender.ioav_protection_on} />
                <DefenderLayerRow label="Tamper protection" on={defender.tamper_protection} warning />
              </div>
              {defender.last_scan_time && (
                <div className="mt-2 text-xs text-[var(--text-tertiary)]">
                  Last scan: {defender.last_scan_type ?? "quick"} · {defender.last_scan_time} · {defender.last_scan_result ?? "completed"}
                </div>
              )}
            </div>
          )}

          {/* P1-3 — third-party protection */}
          {(products ?? []).length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-medium text-[var(--text-tertiary)]">Registered protection products</div>
                <button
                  className="btn-ghost text-2xs"
                  onClick={() =>
                    call("security_open_thirdparty_scanner")
                      .then((r: any) => toast(r))
                      .catch((e) => toast(errorCopy(e), "err"))
                  }
                >
                  <IconExternalLink size={11} /> Open Windows Security
                </button>
              </div>
              {productsError && <InlineAlert>{productsError}</InlineAlert>}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(products ?? []).map((p) => (
                  <div
                    key={p.name + p.product_kind}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs text-[var(--text-secondary)]" title={p.name}>{p.name}</div>
                      <div className="text-2xs capitalize text-[var(--text-tertiary)]">{p.product_kind}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <StatusDot status={p.enabled ? "success" : "danger"} />
                      <StatusDot status={p.up_to_date ? "success" : "warning"} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scan history */}
          {scanHist.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <div className="text-xs font-medium text-[var(--text-tertiary)]">{t("security.recentScans")}</div>
              {scanHist.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                  <span className="w-16 shrink-0 capitalize">{s.scan_type}</span>
                  <StatusDot status={s.result === "completed" ? "success" : "danger"} />
                  <span className={s.result === "completed" ? "text-[var(--status-success)]" : "text-[var(--status-danger)]"}>
                    {s.result}
                  </span>
                  {s.threats_found > 0 && (
                    <span className="badge badge-danger">{s.threats_found} threat(s)</span>
                  )}
                  <span className="text-[var(--text-tertiary)]">{new Date(s.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Threat & Quarantine Review */}
      {threats.length > 0 && (
        <Section title={t("security.threatTitle")} subtitle={`${threats.length} items from Defender's real detection log`}>
          <div className="space-y-2">
            {threats.slice(0, 10).map((threat) => (
              <div
                key={threat.id}
                className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-overlay)] px-4 py-3"
              >
                <div className="flex items-start justify-between">
                  <button className="min-w-0 flex-1 text-left" onClick={() => toggleThreatDetail(threat)}>
                    <div className="flex items-center gap-1.5">
                      {expandedThreat === threat.id ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {threat.name || "Unknown process"}
                      </span>
                    </div>
                    <div className="ml-4 text-xs text-[var(--text-tertiary)]">{threat.category_description}</div>
                    <div className="ml-4 mt-1 text-2xs text-[var(--text-tertiary)]">
                      State: {threat.state} · Severity: {threat.severity} · {threat.date.substring(0, 10)}
                    </div>
                  </button>
                  <div className="flex gap-1.5">
                    <button
                      className="btn-ghost text-2xs"
                      onClick={() =>
                        call("security_restore_threat", { threat_id: threat.id })
                          .then((r: any) => toast(r))
                          .catch((e) => toast(errorCopy(e), "err"))
                      }
                    >
                      {t("security.restore")}
                    </button>
                    <button
                      className="btn-ghost text-2xs text-[var(--status-danger)]"
                      onClick={() =>
                        setConfirm({
                          title: "Remove this threat permanently?",
                          body: "Defender quarantine actions are one-way — this is not reversible.",
                          confirmLabel: "Remove",
                          run: () =>
                            call("security_remove_threat", { threat_id: threat.id })
                              .then((r: any) => toast(r))
                              .catch((e) => toast(errorCopy(e), "err")),
                        })
                      }
                    >
                      {t("security.remove")}
                    </button>
                  </div>
                </div>

                {/* P1-2 — threat detail drill-down */}
                {expandedThreat === threat.id && (
                  <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                    {threatDetailError && <InlineAlert>{threatDetailError}</InlineAlert>}
                    {threatDetail && (
                      <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                        {Object.entries(threatDetail)
                          .filter(([, v]) => v !== null && v !== "" && v !== "0001-01-01T00:00:00")
                          .map(([k, v]) => (
                            <div key={k} className="flex items-baseline justify-between gap-3 border-b border-[var(--border-subtle)] py-1 last:border-0">
                              <span className="shrink-0 text-[var(--text-tertiary)]">{k}</span>
                              <span className="min-w-0 truncate text-right text-[var(--text-secondary)]" title={String(v)}>
                                {Array.isArray(v) ? v.join("; ") : typeof v === "object" ? JSON.stringify(v) : String(v)}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* P1-9 — flagged auto-start entries */}
      {flagged.length > 0 && (
        <Section title={t("security.flaggedTitle")} subtitle={t("security.flaggedSubtitle")}>
          <div className="space-y-2">
            {flagged.map((f) => {
              const key = `${f.name}::${f.location}`;
              return (
                <div key={key} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-overlay)] px-4 py-3">
                  <button className="w-full text-left" onClick={() => toggleFlagDetail(f)}>
                    <div className="flex items-center gap-1.5">
                      {expandedFlag === key ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
                      <span className="text-sm font-medium text-[var(--text-primary)]">{f.name}</span>
                      <span className="badge badge-danger">{f.flags.length} flag(s)</span>
                    </div>
                    <div className="ml-4 mt-0.5 text-2xs text-[var(--text-tertiary)]">{f.location}</div>
                  </button>
                  <div className="ml-4 mt-1.5 space-y-1">
                    {f.flags.map((fl, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
                        <StatusDot status="danger" />
                        <span>{fl}</span>
                      </div>
                    ))}
                    {f.is_signed !== null && (
                      <div className="text-2xs text-[var(--text-tertiary)]">
                        Signature: {f.is_signed ? "signed" : "not signed"}
                      </div>
                    )}
                  </div>
                  {expandedFlag === key && (
                    <div className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                      {flagDetailError && <InlineAlert>{flagDetailError}</InlineAlert>}
                      {flagDetail && (
                        <div className="space-y-1 text-xs">
                          {(Object.entries(flagDetail) as [string, unknown][]).map(([k, v]) => (
                            <div key={k} className="flex items-baseline justify-between gap-3 border-b border-[var(--border-subtle)] py-1 last:border-0">
                              <span className="shrink-0 text-[var(--text-tertiary)]">{k}</span>
                              <span className="min-w-0 truncate text-right text-[var(--text-secondary)]" title={String(v)}>
                                {Array.isArray(v) ? (v as unknown[]).join("; ") : String(v)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* P1-6 — real-time protection pause */}
      <Section title={t("security.pauseTitle")} subtitle={t("security.pauseSubtitle")}>
        {rtDisabled.disabled ? (
          <div className="flex items-center gap-3 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-3">
            <IconTimer size={16} className="shrink-0 text-[var(--status-warning)]" />
            <span className="text-sm text-[var(--status-warning)]">
              Real-time protection is paused — re-enables in {Math.floor(rtDisabled.remaining_secs / 60)}m {rtDisabled.remaining_secs % 60}s.
            </span>
            <button
              className="btn-ghost ml-auto shrink-0 text-xs"
              disabled={rtBusy}
              onClick={() => {
                setRtBusy(true);
                call("security_cancel_rt_disable_early")
                  .then((r: any) => {
                    toast(r);
                    setRtDisabled({ disabled: false, remaining_secs: 0 });
                  })
                  .catch((e) => toast(errorCopy(e), "err"))
                  .finally(() => setRtBusy(false));
              }}
            >
              Re-enable now
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Select
              ariaLabel="Pause duration"
              value={rtMinutes}
              onChange={setRtMinutes}
              options={[
                { value: "5", label: "5 minutes" },
                { value: "10", label: "10 minutes" },
                { value: "30", label: "30 minutes" },
                { value: "60", label: "1 hour" },
              ]}
            />
            <button
              className="btn-ghost text-xs text-[var(--status-danger)]"
              onClick={() =>
                setConfirm({
                  title: "Pause real-time protection?",
                  body: `Real-time protection will be OFF for ${rtMinutes} minutes. Your PC is vulnerable to new malware during that window. It will re-enable automatically when the timer ends, and this action is logged in History.`,
                  confirmLabel: "Pause protection",
                  run: () => {
                    call("security_request_temporary_rt_disable", { duration_secs: Number(rtMinutes) * 60 })
                      .then((r: any) => {
                        toast(r);
                        setRtDisabled({ disabled: true, remaining_secs: Number(rtMinutes) * 60 });
                      })
                      .catch((e) => toast(errorCopy(e), "err"));
                  },
                })
              }
            >
              Pause real-time protection
            </button>
          </div>
        )}
      </Section>

      {/* Protection Hardening */}
      <Section title={t("security.hardeningTitle")} subtitle={t("security.hardeningSubtitle")}>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[var(--text-secondary)]">
            CFA:{" "}
            <span className="font-medium text-[var(--text-primary)]">{cfaMode}</span>
          </span>
          <div className="flex gap-1.5">
            <button
              className={`btn-ghost text-xs ${cfaMode === "audit" ? "!border-[var(--status-warning-border)] !bg-[var(--status-warning-bg)] !text-[var(--status-warning)]" : ""}`}
              onClick={() =>
                call("security_set_cfa_mode", { mode: "audit" })
                  .then(() => { setCfaMode("audit"); toast("CFA set to Audit Mode"); })
                  .catch((e) => toast(errorCopy(e), "err"))
              }
            >
              Audit
            </button>
            <button
              className={`btn-ghost text-xs ${cfaMode === "enabled" ? "!border-[var(--status-success-border)] !bg-[var(--status-success-bg)] !text-[var(--status-success)]" : ""}`}
              onClick={() =>
                call("security_set_cfa_mode", { mode: "enabled" })
                  .then(() => { setCfaMode("enabled"); toast("CFA enabled"); })
                  .catch((e) => toast(errorCopy(e), "err"))
              }
            >
              Enable
            </button>
            <button
              className="btn-ghost text-xs text-[var(--status-danger)]"
              onClick={() =>
                setConfirm({
                  title: "Disable Controlled Folder Access?",
                  body: "Disabling CFA weakens ransomware protection. Your files will no longer be shielded from unauthorized changes.",
                  confirmLabel: "Disable",
                  run: () =>
                    call("security_set_cfa_mode", { mode: "disabled" })
                      .then(() => { setCfaMode("disabled"); toast("CFA disabled"); })
                      .catch((e) => toast(errorCopy(e), "err")),
                })
              }
            >
              Disable
            </button>
          </div>
        </div>

        {/* P1-5 — CFA allowlist */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-1.5 text-xs font-medium text-[var(--text-tertiary)]">Allow an app (Controlled Folder Access)</div>
            <div className="flex gap-2">
              <input
                className="input min-w-0 flex-1"
                placeholder="C:\Program Files\App\app.exe"
                value={cfaApp}
                onChange={(e) => setCfaApp(e.target.value)}
                aria-label="Allowed app path"
              />
              <button
                className="btn-ghost shrink-0 text-xs"
                onClick={() => {
                  if (!cfaApp.trim()) { toast("Enter an app path first", "err"); return; }
                  call("security_manage_cfa_allowlist", { action: "add", target: cfaApp, is_folder: false })
                    .then((r: any) => { toast(r); setCfaApp(""); })
                    .catch((e) => toast(errorCopy(e), "err"));
                }}
              >
                <IconPlus size={12} /> Allow
              </button>
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-[var(--text-tertiary)]">Protect a folder</div>
            <div className="flex gap-2">
              <input
                className="input min-w-0 flex-1"
                placeholder="C:\Users\you\Documents"
                value={cfaFolder}
                onChange={(e) => setCfaFolder(e.target.value)}
                aria-label="Protected folder path"
              />
              <button
                className="btn-ghost shrink-0 text-xs"
                onClick={() => {
                  if (!cfaFolder.trim()) { toast("Enter a folder path first", "err"); return; }
                  call("security_manage_cfa_allowlist", { action: "add", target: cfaFolder, is_folder: true })
                    .then((r: any) => { toast(r); setCfaFolder(""); })
                    .catch((e) => toast(errorCopy(e), "err"));
                }}
              >
                <IconPlus size={12} /> Protect
              </button>
            </div>
          </div>
        </div>

        {asrError && <InlineAlert>{asrError}</InlineAlert>}
        {(asrRules ?? []).length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="text-xs font-medium text-[var(--text-tertiary)]">
              Attack Surface Reduction rules{" "}
              <span className="text-[var(--text-tertiary)]">(click to toggle audit/enable)</span>
            </div>
            {(asrRules ?? []).map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3 py-2"
              >
                <div className="min-w-0 pr-2">
                  <div className="truncate text-xs text-[var(--text-secondary)]" title={r.name}>{r.name}</div>
                  <div className="text-2xs text-[var(--text-tertiary)]">Action: {r.action}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    className={`btn-ghost text-2xs ${r.action === "audit" ? "!text-[var(--status-warning)]" : ""}`}
                    onClick={() =>
                      call("security_set_asr_rule_action", { rule_id: r.id, action: "audit" })
                        .then(() => { toast("ASR rule set to audit"); run(); })
                        .catch((e) => toast(errorCopy(e), "err"))
                    }
                  >
                    Audit
                  </button>
                  <button
                    className={`btn-ghost text-2xs ${r.action === "enabled" ? "!text-[var(--status-success)]" : ""}`}
                    onClick={() =>
                      call("security_set_asr_rule_action", { rule_id: r.id, action: "enabled" })
                        .then(() => { toast("ASR rule enabled"); run(); })
                        .catch((e) => toast(errorCopy(e), "err"))
                    }
                  >
                    Enable
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* P1-4 — exclusions manager */}
      <Section title={t("security.exclusionsTitle")} subtitle="Files, folders, extensions or processes Defender skips — review these regularly, they're a classic malware persistence spot">
        {exclusionsError && <InlineAlert>{exclusionsError}</InlineAlert>}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            ariaLabel="Exclusion kind"
            value={exclusionKind}
            onChange={setExclusionKind}
            options={[
              { value: "path", label: KIND_LABEL.path },
              { value: "extension", label: KIND_LABEL.extension },
              { value: "process", label: KIND_LABEL.process },
            ]}
          />
          <input
            className="input min-w-0 flex-1"
            placeholder={exclusionKind === "extension" ? ".exe" : exclusionKind === "process" ? "app.exe" : "C:\\path\\to\\folder"}
            value={exclusionTarget}
            onChange={(e) => setExclusionTarget(e.target.value)}
            aria-label="Exclusion target"
          />
          <button
            className="btn-ghost text-xs"
            onClick={() => {
              if (!exclusionTarget.trim()) { toast("Enter a target first", "err"); return; }
              call<Exclusion[]>("security_manage_exclusions", { action: "add", target: exclusionTarget.trim(), kind: exclusionKind })
                .then((list) => { setExclusions(list); setExclusionTarget(""); toast(`Added ${exclusionTarget.trim()} to exclusions`); })
                .catch((e) => toast(errorCopy(e), "err"));
            }}
          >
            <IconPlus size={12} /> Add exclusion
          </button>
        </div>
        {exclusions.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {exclusions.map((x) => (
              <div
                key={x.kind + x.target}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-xs text-[var(--text-secondary)]" title={x.target}>{x.target}</div>
                  <div className="text-2xs capitalize text-[var(--text-tertiary)]">{x.kind}</div>
                </div>
                <button
                  className="btn-ghost shrink-0 text-2xs text-[var(--status-danger)]"
                  aria-label={`Remove exclusion ${x.target}`}
                  onClick={() =>
                    call<Exclusion[]>("security_manage_exclusions", { action: "remove", target: x.target, kind: x.kind })
                      .then((list) => { setExclusions(list); toast("Exclusion removed"); })
                      .catch((e) => toast(errorCopy(e), "err"))
                  }
                >
                  <IconTrash size={12} /> {t("security.remove")}
                </button>
              </div>
            ))}
          </div>
        )}
        {exclusions.length === 0 && !exclusionsError && (
          <div className="mt-3 text-xs text-[var(--text-tertiary)]">{t("security.noExclusions")}</div>
        )}
      </Section>

      {/* Privacy Audit */}
      <Section title={t("security.privacyTitle")} subtitle="Permissions, browser privacy & USB history">
        {permsError && <InlineAlert>{permsError}</InlineAlert>}
        {privacyError && <InlineAlert>{privacyError}</InlineAlert>}
        {usbError && <InlineAlert>{usbError}</InlineAlert>}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* App Permissions */}
          <div>
            <div className="mb-2 text-xs font-medium text-[var(--text-tertiary)]">App Permissions</div>
            <div className="space-y-2">
              {(perms ?? []).map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-overlay)] px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusDot status={p.allowed ? "success" : "warning"} />
                      <span className="text-sm font-medium text-[var(--text-primary)]">{p.label}</span>
                    </div>
                    <Toggle on={p.allowed} onChange={(v) => {
                      call("set_permission", { id: p.id, allowed: v })
                        .then(() => toast(`${p.label} access ${v ? "allowed" : "denied"}`))
                        .catch((e) => toast(errorCopy(e), "err"));
                    }} />
                  </div>
                  {p.apps.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {p.apps.map((a) => (
                        <div key={a.name} className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                          <StatusDot status={a.allowed ? "success" : "danger"} />
                          {a.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Browser Privacy */}
          <div>
            <div className="mb-2 text-xs font-medium text-[var(--text-tertiary)]">Browser Privacy</div>
            <div className="space-y-2">
              {(privacy ?? []).map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-overlay)] px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">{p.label}</div>
                      <div className="text-2xs text-[var(--text-tertiary)]">
                        {p.browser} · {p.description}
                      </div>
                    </div>
                    <Toggle
                      on={p.enabled}
                      onChange={(v) => {
                        call("set_browser_policy", { browser: p.browser, policy: p.label, enabled: v })
                          .then(() => toast(`${p.label} → ${v ? "on" : "off"}`))
                          .catch((e) => toast(errorCopy(e), "err"));
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* USB History */}
            {!usbError && (usb ?? []).length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-medium text-[var(--text-tertiary)]">USB Device History</div>
                <div className="space-y-1.5">
                  {(usb ?? []).map((u) => (
                    <div
                      key={u.vid + u.pid}
                      className="flex items-center gap-2 rounded-lg bg-[var(--surface-overlay)] px-3 py-2 text-xs text-[var(--text-secondary)]"
                    >
                      <IconFingerprint size={12} className="text-[var(--text-tertiary)]" />
                      <span>{u.name}</span>
                      <span className="text-[var(--text-tertiary)]">
                        ({u.vid}:{u.pid})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      <Modal
        open={!!confirm}
        title={confirm?.title ?? ""}
        onClose={() => setConfirm(null)}
        onConfirm={() => { confirm?.run(); setConfirm(null); }}
        confirmLabel={confirm?.confirmLabel ?? "Confirm"}
        danger
      >
        <p>{confirm?.body}</p>
      </Modal>
    </div>
  );
}

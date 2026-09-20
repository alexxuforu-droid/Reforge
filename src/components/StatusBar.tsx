// Task 7 — shell status bar: subscribes to `scan-progress` /
// `transcode-progress` backend events (via onEvent) plus the same payloads as
// window CustomEvents (browser preview parity + synthetic test events), and
// renders the active job + percent. Always mounted so the footer slot is
// stable; idle shows "Ready".
import { useEffect, useState } from "react";
import { onEvent } from "../lib/api";

type ScanPayload = { scanned?: number; total?: number; scanned_bytes?: number };
type TranscodePayload = { phase?: string; seconds?: number; percent?: number };
type Payload = ScanPayload & TranscodePayload;

type Job = { kind: "scan" | "transcode"; label: string; percent: number | null };

function fromScan(p: Payload): Job {
  const scanned = Number(p?.scanned ?? 0);
  const total = Number(p?.total ?? 0);
  return {
    kind: "scan",
    label: `Scanning ${scanned} of ${total}`,
    percent: total > 0 ? Math.round((scanned / total) * 100) : null,
  };
}

function fromTranscode(p: Payload): Job | null {
  if (p?.phase === "done") return null;
  if (typeof p?.percent === "number") {
    return { kind: "transcode", label: `Normalizing video… ${p.percent}%`, percent: p.percent };
  }
  const seconds = Math.max(1, Math.floor(Number(p?.seconds ?? 0)));
  return { kind: "transcode", label: `Normalizing video… ${seconds}s`, percent: null };
}

export default function StatusBar() {
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    const onScan = (p: Payload) => setJob(fromScan(p));
    const onTranscode = (p: Payload) => setJob(fromTranscode(p));
    const unScan = onEvent<Payload>("scan-progress", onScan);
    const unTranscode = onEvent<Payload>("transcode-progress", onTranscode);
    // Browser preview / synthetic events carry the same payload as a
    // CustomEvent detail (the Tauri backend has no channel there).
    const wScan = (e: Event) => onScan((e as CustomEvent<Payload>).detail ?? {});
    const wTranscode = (e: Event) => onTranscode((e as CustomEvent<Payload>).detail ?? {});
    window.addEventListener("scan-progress", wScan);
    window.addEventListener("transcode-progress", wTranscode);
    window.addEventListener("reforge:test-scan-progress", wScan);
    window.addEventListener("reforge:test-transcode-progress", wTranscode);
    return () => {
      unScan();
      unTranscode();
      window.removeEventListener("scan-progress", wScan);
      window.removeEventListener("transcode-progress", wTranscode);
      window.removeEventListener("reforge:test-scan-progress", wScan);
      window.removeEventListener("reforge:test-transcode-progress", wTranscode);
    };
  }, []);

  return (
    <footer data-testid="status-bar" className="status-bar" aria-live="polite">
      {job ? (
        <>
          <span className="badge badge-info">{job.kind === "scan" ? "Scan" : "Video"}</span>
          <span className="status-bar-label">{job.label}</span>
          {job.percent !== null && <span className="status-bar-percent">{job.percent}%</span>}
          {job.percent !== null && (
            <span className="progress status-bar-progress" role="progressbar" aria-valuenow={job.percent} aria-valuemin={0} aria-valuemax={100}>
              <span className="progress-bar" style={{ width: `${job.percent}%` }} />
            </span>
          )}
        </>
      ) : (
        <span className="status-bar-label">Ready</span>
      )}
    </footer>
  );
}

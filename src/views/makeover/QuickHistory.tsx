// Extracted from views/Makeover.tsx (V2 pillar 2b, zero behavior change).
// v1.1 Task 2 — reads the digest's top-5 (no `data` payloads over IPC).
import { useEffect, useState } from "react";
import { call, swallow } from "../../lib/api";
import type { UndoDigest } from "../../lib/types";

// ---------------------------------------------------------------------------
// Quick History — recent theme changes
// ---------------------------------------------------------------------------

export default function QuickHistory() {
  const [entries, setEntries] = useState<{ id: string; description: string; ts: number; kind: string }[]>([]);

  useEffect(() => {
    call<UndoDigest>("get_undo_digest")
      .then((d) => setEntries(d.recent.map((e) => ({ id: e.id, description: e.description, ts: e.ts, kind: e.kind }))))
      .catch((e) => swallow("get_undo_digest (QuickHistory)", e));
  }, []);

  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-overlay)] p-3">
      <div className="mb-2 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Recent Changes</div>
      <div className="space-y-1">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center gap-2 text-2xs">
            <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--text-tertiary)]" />
            <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]" title={e.description}>{e.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

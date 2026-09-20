import { useEffect, useState } from "react";
import { IconClose, IconCheck, IconInfo, IconDanger } from "./icons";

export type Toast = { id: number; msg: string; kind: "ok" | "err" | "info" };
let pushToast: ((t: Toast) => void) | null = null;

export function toast(msg: string, kind: "ok" | "err" | "info" = "ok") {
  pushToast?.({ id: Date.now() + Math.random(), msg, kind });
}

const TOAST_META: Record<string, { Icon: typeof IconCheck; color: string; title: string }> = {
  ok: { Icon: IconCheck, color: "var(--status-success)", title: "Done" },
  err: { Icon: IconDanger, color: "var(--status-danger)", title: "That didn't work" },
  info: { Icon: IconInfo, color: "var(--status-info)", title: "Reforge" },
};

// long notes clamp to two lines and expand on click (S3.7 / B1.5) — a toast
// with more than this many chars gets the affordance
const TOAST_EXPAND_THRESHOLD = 110;

function ToastCard({ t, onClose }: { t: Toast; onClose: () => void }) {
  const meta = TOAST_META[t.kind] ?? TOAST_META.info;
  const Icon = meta.Icon;
  const long = t.msg.length > TOAST_EXPAND_THRESHOLD;
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="animate-slide-up pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3"
      style={{ boxShadow: "var(--shadow-elevation-dropdown)" }}
    >
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-[var(--surface-overlay)]"
        style={{ color: meta.color }}
      >
        <Icon size={16} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-[var(--text-primary)]">{meta.title}</div>
        <button
          type="button"
          onClick={() => {
            if (long) setExpanded((v) => !v);
          }}
          className={`mt-0.5 block w-full text-left text-sm text-[var(--text-secondary)] ${
            long && !expanded ? "line-clamp-2" : ""
          } ${long ? "cursor-pointer" : "cursor-default"}`}
          aria-expanded={long ? expanded : undefined}
          title={long ? (expanded ? "Show less" : "Show more") : undefined}
        >
          {t.msg}
        </button>
        {long && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-0.5 text-xs font-medium text-[var(--text-accent)] hover:underline"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
      <button
        onClick={onClose}
        className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        aria-label="Dismiss notification"
      >
        <IconClose size={14} />
      </button>
    </div>
  );
}

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    pushToast = (t) => {
      // dedupe identical consecutive toasts (S3.7 / B1.5) — a repeated result
      // (e.g. rapid retries of the same action) must not stack clones
      setItems((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.msg === t.msg && last.kind === t.kind) return prev;
        // max ~4 visible: drop the oldest beyond the stack cap
        return [...prev.slice(-3), t];
      });
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 5000);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[360px] flex-col gap-2">
      {items.map((t) => (
        <ToastCard key={t.id} t={t} onClose={() => setItems((prev) => prev.filter((x) => x.id !== t.id))} />
      ))}
    </div>
  );
}

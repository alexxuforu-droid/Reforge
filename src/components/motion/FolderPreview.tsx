import { useState } from "react";
import { useI18n } from "../../i18n";
import { useReducedMotion } from "./useMotionPrefs";

/** Folder row with an inline expandable preview. A real button with
 *  aria-expanded; the chevron rotates via CSS. Frozen keeps the disclosure
 *  (content matters more than motion). */
export function FolderPreview({ name, count, children }: { name: string; count: number; children?: React.ReactNode }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  return (
    <div {...(reduced ? { "data-motion-frozen": true } : {})}>
      <button
        type="button"
        className="btn-ghost btn-sm w-full justify-between"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{name} · {count}</span>
        <span aria-hidden="true" className={`inline-block transition-transform duration-100 ${open ? "rotate-90" : ""}`}>▸</span>
      </button>
      {open && (
        <div className={reduced ? "mt-1 pl-3" : "animate-fade-in mt-1 pl-3"}>
          {children ?? <span className="text-2xs text-[var(--text-tertiary)]">{t("motion.empty")}</span>}
        </div>
      )}
    </div>
  );
}

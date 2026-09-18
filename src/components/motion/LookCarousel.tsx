import { useState } from "react";
import { useI18n } from "../../i18n";
import { useReducedMotion } from "./useMotionPrefs";

/** Minimal keyboard carousel: arrows/Home/End move, buttons work, the
 *  active item is announced via aria-live. No autoplay, no global keys —
 *  everything is scoped to the region. Frozen still navigates (content
 *  matters more than motion). */
export function LookCarousel({ items, label }: { items: string[]; label?: string }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const count = items.length;
  if (count === 0) return null;
  const go = (i: number) => setIndex(((i % count) + count) % count);

  return (
    <section
      aria-label={label ?? "Looks"}
      aria-roledescription="carousel"
      tabIndex={0}
      {...(reduced ? { "data-motion-frozen": true } : {})}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
        else if (e.key === "Home") { e.preventDefault(); go(0); }
        else if (e.key === "End") { e.preventDefault(); go(count - 1); }
      }}
    >
      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost btn-sm" aria-label={t("motion.lookPrev")} disabled={count < 2} onClick={() => go(index - 1)}>{t("motion.prev")}</button>
        <span className="text-xs tabular-nums text-[var(--text-secondary)]" aria-live="polite">{index + 1} / {count}</span>
        <button type="button" className="btn-ghost btn-sm" aria-label={t("motion.lookNext")} disabled={count < 2} onClick={() => go(index + 1)}>{t("motion.next")}</button>
      </div>
      <div aria-live="polite" aria-atomic="true" className={reduced ? undefined : "motion-safe:animate-slide-up"}>
        <div key={index} className="mt-2 text-sm text-[var(--text-primary)]">{items[index]}</div>
      </div>
    </section>
  );
}

// S10.7 — Accessibility page: Windows built-in toggles (high contrast,
// animations off, cursor size, text scale, color filters). Every change is
// undoable from History; text scale honestly notes it needs a sign-out.
import { useState } from "react";
import { errorCopy, call } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { useI18n } from "../i18n";
import type { AccessibilityState, ColorFilterState } from "../lib/types";
import { InlineAlert, Section, Toggle, toast } from "../components/ui";
import { IconEye, IconKeyboard, IconMonitor, IconType, IconPalette } from "../components/icons";

const CURSOR_SIZES = [32, 48, 64];
const TEXT_SCALES = [100, 125, 150, 175, 200];
const FILTERS: { type: number; key: string }[] = [
  { type: 0, key: "a11y.filter.grayscale" },
  { type: 1, key: "a11y.filter.invert" },
  { type: 2, key: "a11y.filter.grayscaleInverted" },
  { type: 3, key: "a11y.filter.deuteranopia" },
  { type: 4, key: "a11y.filter.protanopia" },
  { type: 5, key: "a11y.filter.tritanopia" },
];

export default function Accessibility() {
  const { t } = useI18n();
  const { data, error, refresh } = useLoad<AccessibilityState>("get_accessibility_state");
  const [busy, setBusy] = useState(false);

  const patch = (partial: Partial<AccessibilityState> | { color_filter: ColorFilterState }) => {
    if (busy) return;
    setBusy(true);
    call("set_accessibility_state", partial)
      .then(() => { toast(t("a11y.saved")); refresh(); })
      .catch((e) => toast(errorCopy(e), "err"))
      .finally(() => setBusy(false));
  };

  const a = data ?? {
    high_contrast: false,
    animations_off: false,
    cursor_size: 32,
    text_scale_pct: 100,
    color_filter: { active: false, filter_type: 0 },
  };

  return (
    <div className="space-y-4">
      <div className="page-head">
        <h1 className="page-title">{t("a11y.title")}</h1>
        <p className="page-subtitle">{t("a11y.subtitle")}</p>
      </div>

      {error && <InlineAlert>{error}</InlineAlert>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t("a11y.vision")} subtitle={t("a11y.vision.subtitle")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconEye size={15} className="text-[var(--text-tertiary)]" />
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">{t("a11y.highContrast")}</div>
                <div className="text-2xs text-[var(--text-tertiary)]">{t("a11y.highContrast.desc")}</div>
              </div>
            </div>
            <Toggle on={a.high_contrast} disabled={busy} onChange={(v) => patch({ high_contrast: v })} label={t("a11y.highContrast")} />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconPalette size={15} className="text-[var(--text-tertiary)]" />
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">{t("a11y.colorFilter")}</div>
                <div className="text-2xs text-[var(--text-tertiary)]">{t("a11y.colorFilter.desc")}</div>
              </div>
            </div>
            <Toggle on={a.color_filter.active} disabled={busy} onChange={(v) => patch({ color_filter: { ...a.color_filter, active: v } })} label={t("a11y.colorFilter")} />
          </div>
          {a.color_filter.active && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.type}
                  onClick={() => patch({ color_filter: { active: true, filter_type: f.type } })}
                  disabled={busy}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${a.color_filter.filter_type === f.type ? "bg-[var(--accent-hex)] text-white" : "bg-[var(--surface-overlay)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`}
                >
                  {t(f.key)}
                </button>
              ))}
            </div>
          )}
        </Section>

        <Section title={t("a11y.motion")} subtitle={t("a11y.motion.subtitle")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconMonitor size={15} className="text-[var(--text-tertiary)]" />
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">{t("a11y.animationsOff")}</div>
                <div className="text-2xs text-[var(--text-tertiary)]">{t("a11y.animationsOff.desc")}</div>
              </div>
            </div>
            <Toggle on={a.animations_off} disabled={busy} onChange={(v) => patch({ animations_off: v })} label={t("a11y.animationsOff")} />
          </div>
        </Section>

        <Section title={t("a11y.cursorSize")} subtitle={t("a11y.cursorSize.subtitle")}>
          <div className="flex items-center gap-2">
            <IconKeyboard size={15} className="text-[var(--text-tertiary)]" />
            <div className="flex gap-1.5">
              {CURSOR_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => patch({ cursor_size: s })}
                  disabled={busy}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${a.cursor_size === s ? "border-[var(--accent-hex)] bg-[var(--accent-hex)]/10 text-[var(--text-primary)]" : "border-[var(--border-default)] bg-[var(--surface-overlay)] text-[var(--text-secondary)]"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title={t("a11y.textScale")} subtitle={t("a11y.textScale.subtitle")}>
          <div className="flex items-center gap-2">
            <IconType size={15} className="text-[var(--text-tertiary)]" />
            <div className="flex flex-wrap gap-1.5">
              {TEXT_SCALES.map((p) => (
                <button
                  key={p}
                  onClick={() => patch({ text_scale_pct: p })}
                  disabled={busy}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${a.text_scale_pct === p ? "border-[var(--accent-hex)] bg-[var(--accent-hex)]/10 text-[var(--text-primary)]" : "border-[var(--border-default)] bg-[var(--surface-overlay)] text-[var(--text-secondary)]"}`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 text-2xs text-[var(--text-tertiary)]">{t("a11y.signOutNote")}</div>
        </Section>
      </div>
    </div>
  );
}

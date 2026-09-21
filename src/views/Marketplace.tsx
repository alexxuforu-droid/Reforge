import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { errorCopy, call } from "../lib/api";
import type { BundleInfo, BundleManifest, PackDiff } from "../lib/types";
import { InlineAlert, KindChip, Modal, Section, toast } from "../components/ui";
import { TiltCard } from "../components/motion/TiltCard";
import {
  IconRefresh, IconDownload, IconUpload, IconCheck, IconTrash, IconEye, IconCopy,
} from "../components/icons";
// P5-3 — pack share codes carry the declarative look (accent/mode/taskbar/scene).
import { decodePackCode, encodePackCode, packCodeError } from "../lib/shareCodes";

const COMPONENT_ICONS: Record<string, string> = {
  accent: "A",
  theme_mode: "T",
  wallpaper: "W",
  video: "V",
  taskbar: "B",
  cursor: "C",
  sound_scheme: "S",
  sound_event: "S",
  scene: "S",
  font_sub: "F",
  lock_screen: "L",
};

const COMPONENT_LABELS: Record<string, string> = {
  accent: "Accent color",
  theme_mode: "Theme mode",
  wallpaper: "Wallpaper",
  video: "Video wallpaper",
  taskbar: "Taskbar settings",
  cursor: "Cursor scheme",
  sound_scheme: "Sound scheme",
  sound_event: "Sound event",
  scene: "Animated wallpaper scene",
  font_sub: "Font substitution",
  lock_screen: "Lock screen",
};

function componentLabel(c: {
  type: string;
  asset?: string;
  hex?: string;
  mode?: string;
  scheme?: string;
  guid?: string;
  original?: string;
  event?: string;
}): string {
  const base = COMPONENT_LABELS[c.type] ?? c.type;
  const detail = c.hex ?? c.mode ?? c.scheme ?? c.guid ?? c.original ?? c.asset ?? c.event;
  return detail ? `${base} — ${detail}` : base;
}

// Pack thumbnail gradient based on components
function packGradient(manifest: BundleManifest): string {
  const accent = manifest.components.find((c) => c.type === "accent");
  const mode = manifest.components.find((c) => c.type === "theme_mode");
  const isDark = mode?.mode !== "light";
  const hex = accent?.hex ?? "#6D7CFF";
  if (isDark) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const dark = `rgb(${Math.floor(r * 0.15)},${Math.floor(g * 0.15)},${Math.floor(b * 0.15)})`;
    // content preview — renders the actual gradient accent of the pack
    return `linear-gradient(135deg, ${dark}, ${hex}44)`;
  }
  // content preview — renders the actual gradient accent of the pack
  return `linear-gradient(135deg, var(--gray-12), ${hex}33)`;
}

export default function Marketplace() {
  const { t } = useI18n();
  const [bundles, setBundles] = useState<BundleInfo[]>([]);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const selectedIndex = Math.min(featuredIndex, Math.max(0, bundles.length - 1));
  const featured = bundles[selectedIndex];
  const [importPath, setImportPath] = useState("");
  const [exportName, setExportName] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ bundle: BundleInfo; manifest: BundleManifest } | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BundleInfo | null>(null);
  // P5-2 — rendered preview of the pack's first media asset (data URL).
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  // P5-3 — share-code export + import-from-code.
  const [shareCode, setShareCode] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [codeImportName, setCodeImportName] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  // Pack diffing — compare an installed pack against the current look.
  const [diffTarget, setDiffTarget] = useState<BundleInfo | null>(null);
  const [diff, setDiff] = useState<PackDiff | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [diffBusy, setDiffBusy] = useState(false);

  const refresh = useCallback(() => {
    call<BundleInfo[]>("marketplace_list_bundles")
      .then(setBundles)
      .catch(() => toast("Could not load installed packs", "err"));
  }, []);

  useEffect(refresh, [refresh]);

  const importBundle = async () => {
    if (!importPath.trim()) return;
    setBusy(true);
    try {
      const b = await call<BundleInfo>("marketplace_import", { source: importPath });
      toast(`Installed "${b.name}" — review it below, then apply`);
      setImportPath("");
      refresh();
    } catch (e) {
      toast(errorCopy(e), "err");
    } finally {
      setBusy(false);
    }
  };

  const exportLook = async () => {
    setBusy(true);
    try {
      const b = await call<BundleInfo>("marketplace_export_look", { name: exportName });
      toast(`Captured current look as "${b.name}" — ready to share`);
      setExportName("");
      refresh();
    } catch (e) {
      toast(errorCopy(e), "err");
    } finally {
      setBusy(false);
    }
  };

  const showPreview = async (b: BundleInfo) => {
    try {
      const m = await call<BundleManifest>("marketplace_get_manifest", { bundle_id: b.id });
      setPreview({ bundle: b, manifest: m });
      // P5-2 — render the pack's first media asset (wallpaper, video cover,
      // lock-screen image, or thumbnail) as an inline image preview.
      setPreviewImg(null);
      const asset =
        m.thumbnail ||
        m.components.find((c) => c.type === "wallpaper")?.asset ||
        m.components.find((c) => c.type === "video")?.asset ||
        m.components.find((c) => c.type === "lock_screen")?.asset;
      if (asset) {
        call<string>("marketplace_preview_asset", { bundle_id: b.id, asset })
          .then(setPreviewImg)
          .catch(() => setPreviewImg(null));
      }
    } catch (e) {
      toast(errorCopy(e), "err");
    }
  };

  // P5-3 — copy the pack's share code (declarative look only).
  const sharePackCode = async (b: BundleInfo) => {
    try {
      const m = await call<BundleManifest>("marketplace_get_manifest", { bundle_id: b.id });
      const code = encodePackCode(m);
      if (!code) {
        toast("This pack has no scene to encode — nothing to share as a code", "err");
        return;
      }
      await navigator.clipboard.writeText(code);
      setShareCode(code);
      toast("Pack code copied — paste it to a friend");
    } catch (e) {
      toast(errorCopy(e), "err");
    }
  };

  // P5-3 — import a pack from a share code (creates a declarative pack).
  const importFromCode = async () => {
    const err = packCodeError(codeInput);
    setCodeError(err);
    if (err || !codeInput.trim()) return;
    if (!codeImportName.trim()) {
      setCodeError("Give the imported pack a name first.");
      return;
    }
    setBusy(true);
    try {
      const components = decodePackCode(codeInput);
      if (!components) {
        setCodeError("That code didn't check out — check for typos.");
        return;
      }
      const b = await call<BundleInfo>("marketplace_import_components", {
        name: codeImportName.trim(),
        components,
      });
      toast(`Imported "${b.name}" from code — review it below`);
      setCodeInput("");
      setCodeImportName("");
      setCodeError(null);
      refresh();
    } catch (e) {
      setCodeError(errorCopy(e));
    } finally {
      setBusy(false);
    }
  };

  const applyBundle = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const msg = await call<string>("marketplace_apply_bundle", { bundle_id: preview.bundle.id });
      toast(msg);
      setPreview(null);
      setApplyOpen(false);
      refresh();
    } catch (e) {
      toast(errorCopy(e), "err");
    } finally {
      setBusy(false);
    }
  };

  const deleteBundle = async (b: BundleInfo) => {
    try {
      await call("marketplace_delete_bundle", { bundle_id: b.id });
      toast(`Removed "${b.name}"`);
      refresh();
    } catch (e) {
      toast(errorCopy(e), "err");
    }
  };

  const comparePack = async (b: BundleInfo) => {
    setDiffTarget(b);
    setDiff(null);
    setDiffError(null);
    setDiffBusy(true);
    try {
      const d = await call<PackDiff>("diff_pack", { bundle_id: b.id });
      setDiff(d);
    } catch (e) {
      setDiffError(errorCopy(e));
    } finally {
      setDiffBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="page-head">
        <h1 className="page-title">{t("marketplace.title")}</h1>
        <p className="page-subtitle">
          {t("marketplace.subtitle")}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section
          title={t("marketplace.exportTitle")}
          subtitle={t("marketplace.exportSubtitle")}
        >
          <div className="flex gap-2">
            <input
              className="input"
              placeholder={t("marketplace.exportPlaceholder")}
              value={exportName}
              onChange={(e) => setExportName(e.target.value)}
            />
            <button className="btn-primary shrink-0" onClick={exportLook} disabled={busy || !exportName.trim()}>
              <IconDownload size={14} /> {t("marketplace.captureLook")}
            </button>
          </div>
          <p className="mt-2 text-2xs text-[var(--text-tertiary)]">
            {t("marketplace.exportHint")}
          </p>
        </Section>

        <Section title={t("marketplace.importTitle")} subtitle={t("marketplace.importSubtitle")}>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="C:\path\to\my-look.reforgepack"
              value={importPath}
              onChange={(e) => setImportPath(e.target.value)}
            />
            <button className="btn-ghost shrink-0" onClick={importBundle} disabled={busy || !importPath.trim()}>
              <IconUpload size={14} /> {t("marketplace.importButton")}
            </button>
          </div>
          <div className="mt-3 space-y-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-overlay)] p-3">
            <div className="text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              {t("marketplace.shareCodeTitle")}
            </div>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder={t("marketplace.codePlaceholder")}
                value={codeInput}
                onChange={(e) => { setCodeInput(e.target.value); setCodeError(null); }}
                spellCheck={false}
              />
              <input
                className="input w-40 shrink-0"
                placeholder={t("marketplace.packNamePlaceholder")}
                value={codeImportName}
                onChange={(e) => setCodeImportName(e.target.value)}
              />
              <button className="btn-ghost shrink-0" onClick={importFromCode} disabled={busy || !codeInput.trim()}>
                <IconCheck size={14} /> {t("marketplace.importCodeButton")}
              </button>
            </div>
            {codeError && <p className="text-2xs text-[var(--status-danger-text)]">{codeError}</p>}
            <p className="text-2xs text-[var(--text-tertiary)]">
              {t("marketplace.shareCodeHint")}
            </p>
          </div>
          <p className="mt-2 text-2xs text-[var(--text-tertiary)]">
            {t("marketplace.declarativeNote")}
          </p>
        </Section>
      </div>

      {featured && (
        <section
          aria-label="Featured looks"
          aria-roledescription="carousel"
          tabIndex={0}
          className="card p-4"
          onKeyDown={(event) => {
            const next = event.key === "ArrowRight" ? (selectedIndex + 1) % bundles.length
              : event.key === "ArrowLeft" ? (selectedIndex + bundles.length - 1) % bundles.length
              : event.key === "Home" ? 0 : event.key === "End" ? bundles.length - 1 : null;
            if (next !== null) {
              event.preventDefault();
              setFeaturedIndex(next);
            }
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="widget-title">{t("marketplace.featuredTitle")}</h2>
            <div className="flex items-center gap-2">
              <button className="btn-ghost btn-sm" aria-label="Previous look" disabled={bundles.length < 2} onClick={() => setFeaturedIndex((selectedIndex + bundles.length - 1) % bundles.length)}>Previous</button>
              <span className="flex items-center gap-1" aria-hidden="true">
                {bundles.map((b, i) => (
                  <span key={b.id} className={`h-1.5 w-1.5 rounded-full ${i === selectedIndex ? "bg-[var(--accent-hex)]" : "bg-[var(--surface-active)]"}`} />
                ))}
              </span>
              <span className="text-xs tabular-nums text-[var(--text-secondary)]">{selectedIndex + 1} / {bundles.length}</span>
              <button className="btn-ghost btn-sm" aria-label="Next look" disabled={bundles.length < 2} onClick={() => setFeaturedIndex((selectedIndex + 1) % bundles.length)}>Next</button>
            </div>
          </div>
          <div aria-live="polite" aria-atomic="true" className="mt-4">
            <div key={featured.id} className="motion-safe:animate-slide-up">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{featured.name}</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{featured.description}</p>
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">{featured.component_count} components · by {featured.author}</p>
            </div>
          </div>
          <button className="btn-primary btn-sm mt-4" onClick={() => showPreview(featured)}><IconEye size={12} /> Preview featured look</button>
        </section>
      )}

      {/* Installed Packs Grid */}
      <Section
        title={t("marketplace.installedTitle")}
        subtitle={t("marketplace.installedSubtitle")}
        actions={
          <button className="btn-ghost btn-sm shrink-0" onClick={refresh}>
            <IconRefresh size={12} /> Refresh
          </button>
        }
      >
        {bundles.length === 0 ? (
          <div className="empty-state">
            {t("marketplace.emptyState")}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {bundles.map((b) => (
                <div
                  key={b.id}
                  className="spotlight-card group overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-overlay)] transition-colors hover:border-[var(--border-accent)]"
                  onPointerMove={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
                    event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
                  }}
                >
                {/* Pack thumbnail — flat neutral surface (no decorative gradient, Standard B §1) */}
                <div
                  className="relative h-28 w-full bg-[var(--surface-active)]"
                >
                  {b.applied && (
                    <div className="absolute right-3 top-3 badge badge-success">
                      <IconCheck size={10} /> Applied
                    </div>
                  )}
                  {!b.applied && (
                    <div className="absolute right-3 top-3 badge badge-neutral">Installed</div>
                  )}
                  {/* Component type badges */}
                  <div className="absolute bottom-3 left-3 flex gap-1">
                    {[...new Set(["accent", "mode", "wallpaper"])].map((type) => (
                      <span
                        key={type}
                        className="rounded bg-black/40 px-1.5 py-0.5 text-2xs text-white/80 backdrop-blur-sm"
                      >
                        {COMPONENT_ICONS[type] ?? type}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Pack info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--text-primary)]" title={b.name}>{b.name}</div>
                      <div className="text-2xs text-[var(--text-tertiary)]">
                        v{b.version} · by {b.author}
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--text-tertiary)]" title={b.description}>
                    {b.description}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-2xs text-[var(--text-tertiary)]">
                    <span>{b.component_count} component(s)</span>
                    {b.applied_count > 0 && (
                      <span className="badge badge-neutral">applied {b.applied_count}×</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex gap-2">
                    <button
                      className="btn-ghost btn-sm flex-1"
                      onClick={() => showPreview(b)}
                    >
                      <IconEye size={12} /> Preview
                    </button>
                    <button
                      className="btn-ghost btn-sm flex-1"
                      onClick={() => comparePack(b)}
                      title={`Compare "${b.name}" with your current look`}
                    >
                      Compare with current
                    </button>
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => sharePackCode(b)}
                      title="Copy a share code for this pack's look (settings only)"
                    >
                      <IconCopy size={12} />
                    </button>
                    <button
                      className="btn-primary btn-sm flex-1"
                      disabled={busy}
                      onClick={() =>
                        showPreview(b).then(() => setApplyOpen(true))
                      }
                    >
                      Apply
                    </button>
                    <button
                      className="btn-ghost btn-sm text-[var(--text-tertiary)] hover:!text-[var(--status-danger)]"
                      onClick={() => setDeleteTarget(b)}
                      aria-label={`Remove pack ${b.name}`}
                    >
                      <IconTrash size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Pack diff panel — compare an installed pack with the current look */}
      {diffTarget && (
        <Section
          title={`Compare "${diffTarget.name}" with current`}
          subtitle="Shared component types may differ in value; the rest exist on one side only."
          actions={
            <button className="btn-ghost btn-sm shrink-0" onClick={() => { setDiffTarget(null); setDiff(null); setDiffError(null); }}>
              Close
            </button>
          }
        >
          {diffBusy && (
            <div className="skeleton-pulse rounded-xl border border-[var(--border-default)] p-4 text-xs text-[var(--text-tertiary)]">
              Comparing…
            </div>
          )}
          {diffError && <InlineAlert kind="error">{diffError}</InlineAlert>}
          {diff && !diffBusy && (
            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  { key: "differs", label: "Differs", items: diff.differs },
                  { key: "only_current", label: "Only in current", items: diff.only_current },
                  { key: "only_pack", label: "Only in pack", items: diff.only_pack },
                ] as const
              ).map((group) => (
                <div key={group.key}>
                  <div className="mb-2 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                    {group.label} ({group.items.length})
                  </div>
                  {group.items.length === 0 ? (
                    <p className="text-xs text-[var(--text-tertiary)]">None — identical here.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {group.items.map((item) => (
                        <KindChip key={item} kind={item} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Preview Modal */}
      <Modal
        open={!!preview && !applyOpen}
        title={preview ? `Preview "${preview.bundle.name}"` : ""}
        onClose={() => setPreview(null)}
      >
        {preview && (
          <div className="space-y-4">
            {/* Pack header with gradient + real media preview (P5-2) */}
            <div
              className="overflow-hidden rounded-xl px-4 py-4"
              style={{ background: packGradient(preview.manifest) }}
            >
              {previewImg && (
                <TiltCard title={`${preview.manifest.name} preview`}>
                  <div className="mb-3 overflow-hidden rounded-lg border border-white/10">
                    <img src={previewImg} alt={`${preview.manifest.name} preview`} className="h-36 w-full object-cover" />
                  </div>
                </TiltCard>
              )}
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {preview.manifest.name}{" "}
                <span className="text-xs font-normal text-[var(--text-tertiary)]">
                  v{preview.manifest.version}
                </span>
              </div>
              <div className="text-2xs text-[var(--text-tertiary)]">
                by {preview.manifest.author}
                {preview.manifest.schema_version && preview.manifest.schema_version >= 2 && (
                  <span className="badge badge-neutral ml-2">manifest v{preview.manifest.schema_version}</span>
                )}
              </div>
              {preview.manifest.description && (
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {preview.manifest.description}
                </p>
              )}
            </div>

            {/* Component manifest */}
            <div>
              <div className="mb-2 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                What will change
              </div>
              <div className="space-y-1">
                {preview.manifest.components.length === 0 && (
                  <p className="text-xs text-[var(--text-tertiary)]">Nothing in this pack.</p>
                )}
                {preview.manifest.components.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg bg-[var(--surface-overlay)] px-3 py-2 text-xs text-[var(--text-secondary)]"
                  >
                    <span>{COMPONENT_ICONS[c.type] ?? "•"}</span>
                    <span>{componentLabel(c)}</span>
                  </div>
                ))}
              </div>
            </div>

            {preview.manifest.changelog && preview.manifest.changelog.length > 0 && (
              <div>
                <div className="mb-1.5 text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">What's new</div>
                <ul className="space-y-0.5 text-xs text-[var(--text-secondary)]">
                  {preview.manifest.changelog.map((line, i) => (
                    <li key={i}>· {line}</li>
                  ))}
                </ul>
              </div>
            )}
            {shareCode && (
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-overlay)] px-3 py-2 text-xs">
                <div className="text-2xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Share code (settings only)</div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="break-all font-mono text-[var(--accent-hex)]">{shareCode}</code>
                  <button
                    className="btn-ghost btn-sm shrink-0"
                    onClick={() => { navigator.clipboard.writeText(shareCode); toast("Code copied"); }}
                  >
                    <IconCopy size={11} /> Copy
                  </button>
                </div>
              </div>
            )}
            <p className="text-2xs text-[var(--text-tertiary)]">
              Applying records one combined undo entry — the entire look reverts from{" "}
              <b>History</b> in one click.
            </p>
          </div>
        )}
      </Modal>

      {/* Apply Confirmation Modal */}
      <Modal
        open={!!deleteTarget}
        title={`Remove "${deleteTarget?.name}"?`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteBundle(deleteTarget);
          setDeleteTarget(null);
        }}
        confirmLabel="Remove pack"
        danger
      >
        <p>
          This removes the pack from this PC. Already-applied changes are left untouched — you can still revert them
          from History.
        </p>
      </Modal>

      <Modal
        open={applyOpen && !!preview}
        title={`Apply "${preview?.bundle.name}"?`}
        onClose={() => setApplyOpen(false)}
        onConfirm={applyBundle}
        confirmLabel="Apply pack"
      >
        <p>
          This applies every component shown in the preview to your real Windows settings — accent, mode, wallpaper,
          and any taskbar / cursor / sound / lock-screen pieces it contains. The whole thing is recorded as a single
          reversible change, so you can revert it from History.
        </p>
      </Modal>
    </div>
  );
}

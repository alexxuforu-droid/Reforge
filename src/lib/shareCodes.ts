// Style share codes (S6.5/C4.1). A short, deterministic, offline code that
// encodes a style's look: wallpaper (or scene), accent, mode, transparency,
// variant axis, and scene speed/density. No cloud, no server — the code IS
// the style.
//
// Format: 10 Crockford base32 chars = 45 payload bits + 1 checksum char.
//   bits 0-7    wallpaper index (ALL_WALLPAPERS order, then KNOWN_SCENE_IDS)
//   bits 8-31   accent hex as 24-bit RGB
//   bit 32      mode (0 = dark, 1 = light)
//   bit 33      transparency (0 = off, 1 = on)
//   bits 34-35  variant axis (0 = natural, 1 = vivid, 2 = minimal)
//   bits 36-39  scene speed step (0.2 + n*0.2 → 0.2..3.2)
//   bits 40-43  scene density step (0.2 + n*0.12 → 0.2..2.0)
//   bit 44      version (always 0 for now)
//   char 10     checksum (sum of the 9 payload char indices mod 32) — catches
//               typos so a mangled code fails loudly instead of applying a
//               different look.

import type { StyleDef, WallpaperRef } from "../styles/types";
import { ALL_WALLPAPERS } from "../styles/wallpapers";
import { KNOWN_SCENE_IDS } from "../styles/scene_styles";
import { shade } from "../styles/variants";

/** Crockford base32 — no I/L/O/U so codes are easy to read and retype. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ALPHA_INDEX = new Map([...ALPHABET].map((c, i) => [c, i]));
export const CODE_LENGTH = 10;

const WALLPAPER_COUNT = ALL_WALLPAPERS.length; // 118
const SCENE_OFFSET = WALLPAPER_COUNT; // 118
const SCENE_COUNT = KNOWN_SCENE_IDS.length; // 48

function toBase32(v: bigint, chars: number): string {
  let out = "";
  for (let i = chars - 1; i >= 0; i--) {
    out += ALPHABET[Number((v >> BigInt(5 * i)) & 31n)];
  }
  return out;
}

function fromBase32(s: string): bigint | null {
  let v = 0n;
  for (const c of s) {
    const d = ALPHA_INDEX.get(c);
    if (d === undefined) return null;
    v = v * 32n + BigInt(d);
  }
  return v;
}

/** The index space: ALL_WALLPAPERS first (118), then KNOWN_SCENE_IDS (48). */
export function refIndex(ref: WallpaperRef): number | null {
  if (ref.type === "scene") {
    const i = KNOWN_SCENE_IDS.indexOf(ref.sceneId as (typeof KNOWN_SCENE_IDS)[number]);
    return i < 0 ? null : SCENE_OFFSET + i;
  }
  const i = ALL_WALLPAPERS.findIndex((w) => w.id === ref.id);
  return i < 0 ? null : i;
}

export function refFromIndex(idx: number): WallpaperRef | null {
  if (idx >= 0 && idx < WALLPAPER_COUNT) {
    const w = ALL_WALLPAPERS[idx];
    return { type: w.type, id: w.id };
  }
  if (idx >= SCENE_OFFSET && idx < SCENE_OFFSET + SCENE_COUNT) {
    return { type: "scene", sceneId: KNOWN_SCENE_IDS[idx - SCENE_OFFSET] };
  }
  return null;
}

const AXIS_BITS: Record<string, number> = { natural: 0, vivid: 1, minimal: 2 };
const AXIS_FROM_BITS = ["natural", "vivid", "minimal"] as const;
type ShareAxis = (typeof AXIS_FROM_BITS)[number];

const SPEED_STEP = 0.2;
const DENSITY_STEP = 0.12;

function speedToStep(speed: number): number {
  return Math.max(0, Math.min(15, Math.round((speed - 0.2) / SPEED_STEP)));
}
function densityToStep(density: number): number {
  return Math.max(0, Math.min(15, Math.round((density - 0.2) / DENSITY_STEP)));
}

export function hexToBits(hex: string): number {
  const h = hex.replace("#", "");
  return parseInt(h.slice(0, 2), 16) * 65536 + parseInt(h.slice(2, 4), 16) * 256 + parseInt(h.slice(4, 6), 16);
}
export function bitsToHex(v: number): string {
  return `#${((v & 0xffffff) | 0x1000000).toString(16).slice(1)}`;
}

/** Encode a style into a 10-char share code, or null if its ref can't resolve. */
export function encodeStyleCode(s: StyleDef): string | null {
  const idx = refIndex(s.wallpaper);
  if (idx === null) return null;
  const axis = AXIS_BITS[s.axis ?? "natural"] ?? 0;
  const speed = s.sceneTweak?.speed ?? 0.7;
  const density = s.sceneTweak?.density ?? 0.9;
  let v = 0n;
  v |= BigInt(idx & 0xff);
  v |= BigInt(hexToBits(s.accent_hex) & 0xffffff) << 8n; // bits 8-31
  v |= BigInt(s.mode === "light" ? 1 : 0) << 32n;
  v |= BigInt(s.transparency ? 1 : 0) << 33n;
  v |= BigInt(axis & 3) << 34n;
  v |= BigInt(speedToStep(speed)) << 36n;
  v |= BigInt(densityToStep(density)) << 40n;
  // bit 44 = version 0
  const payload = toBase32(v, 9);
  const checksum = [...payload].reduce((a, c) => a + (ALPHA_INDEX.get(c) ?? 0), 0) % 32;
  return payload + ALPHABET[checksum];
}

/** Decode a share code into a personal-tier StyleDef, or null if invalid. */
export function decodeStyleCode(code: string): StyleDef | null {
  const c = code.trim().toUpperCase();
  if (!/^[0-9A-Z]+$/.test(c) || c.length !== CODE_LENGTH) return null;
  const payload = c.slice(0, 9);
  const given = ALPHA_INDEX.get(c[9]);
  if (given === undefined) return null;
  const sum = [...payload].reduce((a, ch) => a + (ALPHA_INDEX.get(ch) ?? 0), 0) % 32;
  if (sum !== given) return null; // checksum mismatch — typo
  const v = fromBase32(payload);
  if (v === null) return null;
  if (((v >> 44n) & 1n) !== 0n) return null; // version must be 0
  const idx = Number(v & 255n);
  const ref = refFromIndex(idx);
  if (!ref) return null;
  const accent = bitsToHex(Number((v >> 8n) & 0xffffffn));
  const mode: "dark" | "light" = ((v >> 32n) & 1n) === 1n ? "light" : "dark";
  const transparency = ((v >> 33n) & 1n) === 1n;
  const axis: ShareAxis = AXIS_FROM_BITS[Number((v >> 34n) & 3n)] ?? "natural";
  const speed = 0.2 + Number((v >> 36n) & 15n) * SPEED_STEP;
  const density = 0.2 + Number((v >> 40n) & 15n) * DENSITY_STEP;

  const base = ref.type === "scene" ? niceName(ref.sceneId) : ALL_WALLPAPERS[idx]?.name ?? "Shared look";
  const category = ref.type === "scene" ? "Scenes" : ALL_WALLPAPERS[idx]?.category ?? "Personal";
  const quiz: StyleDef["quiz"] = { [mode]: 1, calm: 1 };
  if (axis === "vivid") quiz.vivid = 2;
  if (axis === "minimal") quiz.minimal = 2;

  return {
    id: `share-${c}`,
    name: `${base} · shared`,
    tagline: "A shared look, imported from a code",
    description: `Imported from share code ${c} — ${mode} mode, ${accent} accent, ${
      ref.type === "scene" ? "an animated scene" : "a static or live wallpaper"
    }. Fully offline: the code is the style.`,
    category,
    mood: "calm",
    mode,
    accent_hex: accent,
    gradient: mode === "dark" ? [shade(accent, -60), shade(accent, 10)] : [shade(accent, 40), shade(accent, -20)],
    wallpaper: ref,
    sceneTweak: { speed, density },
    transparency,
    taskbar: { size: "medium", alignment: "center" },
    cursor: "aero",
    lock_screen: { mode: "spotlight" },
    widgets: ["clock"],
    tags: ["shared", "imported", axis, mode, "generated"],
    quiz,
    generated: true,
    axis,
    tier: "personal",
  };
}

function niceName(id: string): string {
  return id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Human-readable validation message for the import UI. */
export function shareCodeError(code: string): string | null {
  const c = code.trim().toUpperCase();
  if (c.length === 0) return "Paste a share code first.";
  if (c.length !== CODE_LENGTH) return `Codes are ${CODE_LENGTH} characters — got ${c.length}.`;
  if (!/^[0-9A-Z]+$/.test(c)) return "Codes only use digits and A–Z (no I, L, O, U).";
  return decodeStyleCode(c) ? null : "That code didn't check out — check for typos.";
}

// ---------------------------------------------------------------------------
// Pack share codes (P5-3) — a longer code that carries a pack's *declarative*
// look: accent, mode, taskbar, and an animated scene. Media files (wallpaper
// images, video, sound files) can't fit in a code — those travel in the pack
// file itself; the code shares the look's settings.
//
// Format: 20 Crockford base32 chars = 95 payload bits + 1 checksum char.
//   bits 0-3     version (1)
//   bits 4-27    accent 24-bit RGB
//   bit 28       mode (0 dark, 1 light)
//   bits 29-30   taskbar size (0 small, 1 medium, 2 large)
//   bit 31       taskbar alignment (0 left, 1 center)
//   bit 32       taskbar autohide
//   bits 33-36   scene kind index (SCENE_KINDS)
//   bits 37-40   scene speed step (0.2 + n*0.2)
//   bits 41-44   scene density step (0.2 + n*0.12)
//   bits 45-92   scene colors as 3 × 16-bit RGB565
//   char 20      checksum
// ---------------------------------------------------------------------------

export const PACK_CODE_LENGTH = 20;

const SCENE_KINDS = [
  "particles", "waves", "geometric", "parallax", "aurora", "stars", "embers",
  "rain", "fireflies", "snowfall-wind", "bokeh", "smoke", "waves-3d",
] as const;

function to565(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) >> 3;
  const g = parseInt(h.slice(2, 4), 16) >> 2;
  const b = parseInt(h.slice(4, 6), 16) >> 3;
  return (r << 11) | (g << 5) | b;
}

function from565(v: number): string {
  const r = (((v >> 11) & 31) << 3) | (((v >> 11) & 31) >> 2);
  const g = (((v >> 5) & 63) << 2) | (((v >> 5) & 63) >> 4);
  const b = ((v & 31) << 3) | ((v & 31) >> 2);
  return `#${((r << 16) | (g << 8) | b | 0x1000000).toString(16).slice(1)}`;
}

/** Encode a pack's declarative components into a 20-char share code, or null
 *  if it has no scene (the code's core) or an unknown scene kind. */
export function encodePackCode(m: {
  components: { type: string; hex?: string; mode?: string; size?: string; alignment?: string; autohide?: boolean; kind?: string; speed?: number; density?: number; colors?: string[] }[];
}): string | null {
  const accent = m.components.find((c) => c.type === "accent")?.hex;
  const modeC = m.components.find((c) => c.type === "theme_mode")?.mode;
  const tb = m.components.find((c) => c.type === "taskbar");
  const scene = m.components.find((c) => c.type === "scene");
  if (!accent || !scene?.kind) return null;
  const kindIdx = SCENE_KINDS.indexOf(scene.kind as (typeof SCENE_KINDS)[number]);
  if (kindIdx < 0) return null;
  const colors = (scene.colors ?? []).slice(0, 3);
  while (colors.length < 3) colors.push("#000000");

  let v = 0n;
  v |= 1n; // version
  v |= BigInt(hexToBits(accent) & 0xffffff) << 4n;
  v |= BigInt(modeC === "light" ? 1 : 0) << 28n;
  const sizeBits = tb?.size === "small" ? 0 : tb?.size === "large" ? 2 : 1;
  v |= BigInt(sizeBits & 3) << 29n;
  v |= BigInt(tb?.alignment === "left" ? 0 : 1) << 31n;
  v |= BigInt(tb?.autohide ? 1 : 0) << 32n;
  v |= BigInt(kindIdx & 15) << 33n;
  v |= BigInt(speedToStep(scene.speed ?? 1)) << 37n;
  v |= BigInt(densityToStep(scene.density ?? 1)) << 41n;
  v |= BigInt(to565(colors[0]) & 0xffff) << 45n;
  v |= BigInt(to565(colors[1]) & 0xffff) << 61n;
  v |= BigInt(to565(colors[2]) & 0xffff) << 77n;

  const payload = toBase32(v, 19);
  const checksum = [...payload].reduce((a, c) => a + (ALPHA_INDEX.get(c) ?? 0), 0) % 32;
  return payload + ALPHABET[checksum];
}

/** Decode a pack share code into the declarative components (Rust
 *  BundleComponent serde shapes) ready for marketplace_import_components. */
export function decodePackCode(code: string): {
  type: string; hex?: string; mode?: string; size?: string; alignment?: string; autohide?: boolean; kind?: string; speed?: number; density?: number; colors?: string[]; id?: string;
}[] | null {
  const c = code.trim().toUpperCase();
  if (!/^[0-9A-Z]+$/.test(c) || c.length !== PACK_CODE_LENGTH) return null;
  const payload = c.slice(0, 19);
  const given = ALPHA_INDEX.get(c[19]);
  if (given === undefined) return null;
  const sum = [...payload].reduce((a, ch) => a + (ALPHA_INDEX.get(ch) ?? 0), 0) % 32;
  if (sum !== given) return null;
  const v = fromBase32(payload);
  if (v === null) return null;
  if ((v & 15n) !== 1n) return null; // version must be 1
  const accent = bitsToHex(Number((v >> 4n) & 0xffffffn));
  const mode = ((v >> 28n) & 1n) === 1n ? "light" : "dark";
  const size = (["small", "medium", "large"] as const)[Number((v >> 29n) & 3n)] ?? "medium";
  const alignment = ((v >> 31n) & 1n) === 0n ? "left" : "center";
  const autohide = ((v >> 32n) & 1n) === 1n;
  const kind = SCENE_KINDS[Number((v >> 33n) & 15n)];
  if (!kind) return null;
  const speed = 0.2 + Number((v >> 37n) & 15n) * SPEED_STEP;
  const density = 0.2 + Number((v >> 41n) & 15n) * DENSITY_STEP;
  const colors = [0, 1, 2].map((i) => from565(Number((v >> BigInt(45 + i * 16)) & 0xffffn)));
  return [
    { type: "accent", hex: accent },
    { type: "theme_mode", mode },
    { type: "taskbar", size, alignment, autohide },
    { type: "scene", id: `share-${c}`, kind, speed, density, colors },
  ];
}

/** Human-readable validation message for the pack-code import UI. */
export function packCodeError(code: string): string | null {
  const c = code.trim().toUpperCase();
  if (c.length === 0) return "Paste a pack share code first.";
  if (c.length !== PACK_CODE_LENGTH) return `Pack codes are ${PACK_CODE_LENGTH} characters — got ${c.length}.`;
  if (!/^[0-9A-Z]+$/.test(c)) return "Codes only use digits and A–Z (no I, L, O, U).";
  return decodePackCode(c) ? null : "That code didn't check out — check for typos.";
}

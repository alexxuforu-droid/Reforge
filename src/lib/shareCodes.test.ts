// S6.5 — style share codes. The code must be deterministic (encode(decode(c))
// === c), cover every wallpaper/scene, reject typos via the checksum, and
// import into a valid personal-tier style that resolves and applies.
import { describe, expect, it } from "vitest";
import { ALL_STYLES } from "../styles/index";
import {
  CODE_LENGTH,
  PACK_CODE_LENGTH,
  decodePackCode,
  decodeStyleCode,
  encodePackCode,
  encodeStyleCode,
  packCodeError,
  refFromIndex,
  refIndex,
  shareCodeError,
} from "./shareCodes";
import { ALL_WALLPAPERS } from "../styles/wallpapers";
import { KNOWN_SCENE_IDS } from "../styles/scene_styles";

function pick(refType: "scene" | "static" | "live"): (typeof ALL_STYLES)[number] {
  const s = ALL_STYLES.find((x) =>
    refType === "scene"
      ? x.wallpaper.type === "scene"
      : x.wallpaper.type === refType,
  );
  if (!s) throw new Error(`no ${refType} style`);
  return s;
}

describe("style share codes (S6.5)", () => {
  it("encodes every style to a 10-char code (8–12 spec) and round-trips", () => {
    for (const s of ALL_STYLES) {
      const code = encodeStyleCode(s);
      expect(code, s.id).toBeTruthy();
      expect(code!.length, s.id).toBe(CODE_LENGTH);
      const back = decodeStyleCode(code!);
      expect(back, s.id).not.toBeNull();
      // Determinism: re-encoding the decoded style yields the same code.
      expect(encodeStyleCode(back!), `${s.id} round-trip`).toBe(code);
    }
  });

  it("round-trips the encoded fields exactly", () => {
    for (const s of [pick("scene"), pick("static"), pick("live")]) {
      const back = decodeStyleCode(encodeStyleCode(s)!);
      expect(back!.accent_hex.toLowerCase(), s.id).toBe(s.accent_hex.toLowerCase());
      expect(back!.mode, s.id).toBe(s.mode);
      expect(back!.transparency, s.id).toBe(s.transparency);
      expect(back!.axis, s.id).toBe(s.axis ?? "natural");
      expect(refIndex(back!.wallpaper), s.id).toBe(refIndex(s.wallpaper));
    }
  });

  it("covers the whole index space (all wallpapers + all scenes)", () => {
    for (let i = 0; i < ALL_WALLPAPERS.length; i++) {
      const ref = refFromIndex(i)!;
      expect(refIndex(ref)).toBe(i);
    }
    for (let i = 0; i < KNOWN_SCENE_IDS.length; i++) {
      const ref = refFromIndex(ALL_WALLPAPERS.length + i)!;
      expect(refIndex(ref)).toBe(ALL_WALLPAPERS.length + i);
    }
  });

  it("rejects typos, wrong lengths, and bad characters", () => {
    const good = encodeStyleCode(pick("static"))!;
    // Flip one char in the payload → checksum mismatch.
    const flipped = good.slice(0, 2) + (good[2] === "0" ? "1" : "0") + good.slice(3);
    expect(decodeStyleCode(flipped)).toBeNull();
    expect(decodeStyleCode(good.slice(0, 8))).toBeNull();
    expect(decodeStyleCode(good.slice(0, 9) + good[0])).toBeNull(); // bad checksum
    expect(decodeStyleCode(good.replace(/[0-9A-Z]/, "I"))).toBeNull(); // I not in alphabet
    expect(shareCodeError("")).toContain("Paste");
    expect(shareCodeError("abc")).toContain("10 characters");
    expect(shareCodeError(good)).toBeNull();
  });

  it("imports to a valid personal-tier style that resolves", () => {
    const s = pick("scene");
    const back = decodeStyleCode(encodeStyleCode(s)!)!;
    expect(back.tier).toBe("personal");
    expect(back.id).toMatch(/^share-/);
    const w = back.wallpaper;
    if (w.type === "scene") {
      expect(KNOWN_SCENE_IDS).toContain(w.sceneId);
    } else {
      expect(ALL_WALLPAPERS.some((x) => x.id === w.id)).toBe(true);
    }
    const st = pick("static");
    const backSt = decodeStyleCode(encodeStyleCode(st)!)!;
    const ws = backSt.wallpaper;
    if (ws.type !== "scene") {
      expect(ALL_WALLPAPERS.some((x) => x.id === ws.id)).toBe(true);
    }
  });
});

describe("pack share codes (P5-3)", () => {
  const pack = (over: Record<string, unknown> = {}) => ({
    components: [
      { type: "accent", hex: "#6D7CFF" },
      { type: "theme_mode", mode: "dark" },
      { type: "taskbar", size: "small", alignment: "left", autohide: true },
      {
        type: "scene",
        id: "scene-1",
        kind: "aurora",
        speed: 1.2,
        density: 1.4, // on the 0.12 grid (0.2 + n*0.12)
        colors: ["#123456", "#ABCDEF", "#FF8800"],
      },
    ],
    ...over,
  });

  it("round-trips a declarative pack through a 20-char code", () => {
    const code = encodePackCode(pack())!;
    expect(code).toHaveLength(PACK_CODE_LENGTH);
    const back = decodePackCode(code)!;
    expect(back).not.toBeNull();
    // accent is exact (24-bit); scene kind/speed/density are exact after
    // stepping; colors are RGB565-quantized, so compare against the code's own
    // quantized values via re-encode.
    const accent = back.find((c) => c.type === "accent");
    expect(accent?.hex?.toLowerCase()).toBe("#6d7cff");
    const mode = back.find((c) => c.type === "theme_mode");
    expect(mode?.mode).toBe("dark");
    const tb = back.find((c) => c.type === "taskbar");
    expect(tb?.size).toBe("small");
    expect(tb?.alignment).toBe("left");
    expect(tb?.autohide).toBe(true);
    const scene = back.find((c) => c.type === "scene");
    expect(scene?.kind).toBe("aurora");
    expect(scene?.speed).toBe(1.2);
    expect(scene?.density).toBe(1.4);
    expect(encodePackCode({ components: back })).toBe(code); // stable
  });

  it("rejects a mutated character via the checksum", () => {
    const code = encodePackCode(pack())!;
    const bad = (code[0] === "0" ? "1" : "0") + code.slice(1);
    expect(decodePackCode(bad)).toBeNull();
    expect(packCodeError(bad)).not.toBeNull();
  });

  it("rejects wrong length and junk input", () => {
    expect(decodePackCode("SHORT")).toBeNull();
    expect(decodePackCode("OOOOOOOOOOOOOOOOOOOO")).toBeNull(); // O is not in the alphabet
    expect(packCodeError("")).not.toBeNull();
  });

  it("returns null when the pack has no scene to encode", () => {
    expect(encodePackCode({ components: [{ type: "accent", hex: "#123456" }] })).toBeNull();
    expect(encodePackCode(pack({ components: [{ type: "scene", kind: "unknown-kind" }] }))).toBeNull();
  });
});

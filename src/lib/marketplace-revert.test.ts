// Pack apply/revert parity (Rust undo.rs "marketplace_apply").
// Applying a pack snapshots the pre-apply look into the undo entry's before
// composite; reverting restores accent/mode/wallpaper and unmarks the pack.
import { describe, expect, it, vi, afterEach } from "vitest";

const STORE_KEY = "reforge-mock-v1";

async function freshMock() {
  vi.resetModules();
  return import("./mock");
}

afterEach(() => {
  localStorage.removeItem(STORE_KEY);
  vi.resetModules();
});

describe("marketplace apply/revert parity", () => {
  it("snapshots the pre-apply look and restores it on revert", async () => {
    const m = await freshMock();
    const before = await m.mockCall<{ accent_hex: string; mode: string }>("get_theme_state", {});
    await m.mockCall("marketplace_apply_bundle", { bundle_id: "amber-retro" });
    const applied = await m.mockCall<{ accent_hex: string }>("get_theme_state", {});
    expect(applied.accent_hex).toBe("#F59E0B");
    const log = await m.mockCall<{ id: string; kind: string; data: { before: { accent: string } } }[]>("get_undo_log", {});
    const entry = log.find((e) => e.kind === "marketplace_apply")!;
    expect(entry.data.before.accent).toBe(before.accent_hex);
    await m.mockCall("revert_entry", { id: entry.id });
    const restored = await m.mockCall<{ accent_hex: string; mode: string }>("get_theme_state", {});
    expect(restored.accent_hex).toBe(before.accent_hex);
    expect(restored.mode).toBe(before.mode);
  });
});

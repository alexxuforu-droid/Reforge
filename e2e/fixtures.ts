import { test as base, expect, type Page } from "@playwright/test";
import type { ThemeState, UndoEntry, BundleInfo, BundleManifest } from "../src/lib/types";

export type PreviewState = {
  theme: ThemeState;
  wallpaper: { current: string };
  undo: UndoEntry[];
  bundles: BundleInfo[];
  manifests: [string, BundleManifest][];
  snapshots: { id: string; state: { theme: ThemeState } }[];
  junk: { id: string; size: number; file_count: number; admin_required: boolean }[];
  freedSoFar: number;
  scanInProgress: boolean;
  updateConfig: { check_on_startup: boolean };
  automation: { weekly_junk: boolean; monthly_dupes: boolean };
};

export const test = base.extend({
  page: async ({ page, context, baseURL }, use) => {
    const origin = new URL(baseURL!).origin;
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return url.origin === origin || ["data:", "blob:"].includes(url.protocol)
        ? route.continue()
        : route.abort("blockedbyclient");
    });
    await context.addInitScript(() => {
      localStorage.setItem("reforge-wizard-seen-v1", "1");
      if ("__TAURI_INTERNALS__" in window) throw new Error("E2E requires browser preview, never Tauri");
      let clipboard = "";
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (value: string) => { clipboard = value; },
          readText: async () => clipboard,
        },
      });
    });
    await use(page);
  },
});

export { expect };

export async function openApp(page: Page, seed?: Record<string, unknown>) {
  if (seed) {
    await page.context().addInitScript((data) => {
      if (!localStorage.getItem("reforge-mock-v1")) localStorage.setItem("reforge-mock-v1", JSON.stringify(data));
    }, seed);
  }
  await page.goto("/");
  await expect(page.getByText("Preview · Reforge v0.1.0", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => "__TAURI_INTERNALS__" in window)).toBe(false);
  await expect.poll(async () => (await state(page))?.theme).toBeTruthy();
}

export async function state(page: Page): Promise<PreviewState> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("reforge-mock-v1") || "null"));
}

export async function navigate(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name, exact: true }).click();
}

export function packCard(page: Page, name: string) {
  return page.locator("div.group").filter({ has: page.getByTitle(name, { exact: true }) });
}

export async function revertHistory(page: Page, description: string) {
  await navigate(page, "History");
  await page.getByRole("textbox", { name: "Search history descriptions" }).fill(description);
  await expect(page.getByTitle(description, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Revert", exact: true }).click();
  await expect(page.getByText("reverted", { exact: true })).toBeVisible();
  await expect.poll(async () => (await state(page)).undo.find((entry) => entry.description === description)?.undone).toBe(true);
}

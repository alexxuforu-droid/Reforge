import { test, expect, openApp, navigate, state, revertHistory, packCard } from "./fixtures";

const quizAnswers = [
  "Bright daylight", "Ocean blues", "Focused and quiet", "Clean, minimal, zen",
  "One perfect photograph", "Completely still", "Deep teal", "Nature documentaries",
  "Keep it still", "Serene", "A white studio", "None — clean desktop", "Crisp and clean",
  "Small, tucked left", "Muted and earthy", "No RGB at all", "Sun coming through the window",
  "I get things done",
];

const customTheme = { accent_hex: "#123456", mode: "light", transparency: false, color_prevalence: true };

test("duplicates scan stages copies to trash and emptying is confirm-gated", async ({ page }) => {
  await openApp(page);
  await navigate(page, "Organize");
  await page.getByRole("button", { name: "Duplicates", exact: true }).click();
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /IMG_2041\.JPG/ })).toBeVisible();
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Remove selected", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Remove duplicates?");
  await dialog.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /IMG_2041\.JPG/ })).toBeHidden();
  await expect(page.getByText(/Staging trash:/)).toBeVisible();
  await expect.poll(async () => (await state(page)).undo[0]).toMatchObject({ kind: "duplicates_removed", revertible: true });
  await page.getByRole("button", { name: "Empty trash", exact: true }).click();
  const emptyDialog = page.getByRole("dialog");
  await expect(emptyDialog).toContainText("Empty staging trash?");
  await emptyDialog.getByRole("button", { name: "Empty trash", exact: true }).click();
  await expect(page.getByText(/Staging trash:/)).toBeHidden();
  await expect.poll(async () => (await state(page)).undo[0]).toMatchObject({ kind: "trash_emptied", revertible: false });
});

test("guided makeover applies a look and History restores the previous look", async ({ page }) => {
  await openApp(page);
  const before = await state(page);
  await navigate(page, "Makeover session");
  await page.getByRole("button", { name: "Take a snapshot", exact: true }).click();
  await expect(page.getByRole("button", { name: "Clean & continue →", exact: true })).toBeEnabled();
  await expect.poll(async () => (await state(page)).snapshots.length).toBe(1);
  await page.getByRole("button", { name: "Clean & continue →", exact: true }).click();
  for (const answer of quizAnswers) {
    await page.getByRole("button", { name: answer, exact: false }).click();
  }
  await expect(page.getByRole("heading", { name: "Your top 3 looks", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Apply", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Finish →", exact: true })).toBeVisible();
  await expect.poll(async () => (await state(page)).undo.filter((entry) => entry.kind === "style_applied").length).toBe(1);
  const applied = await state(page);
  expect(applied.theme).not.toEqual(before.theme);
  const entry = applied.undo.find((item) => item.kind === "style_applied")!;
  expect(entry).toMatchObject({ revertible: true, undone: false });
  await page.getByRole("button", { name: "Finish →", exact: true }).click();
  await expect(page.getByText("Snapshot active", { exact: true })).toBeVisible();
  await revertHistory(page, entry.description);
  await expect.poll(async () => (await state(page)).theme).toEqual(before.theme);
  expect((await state(page)).wallpaper).toEqual(before.wallpaper);
});

test("junk scan, confirm clean, and verify only selected categories are removed", async ({ page }) => {
  await openApp(page);
  const before = await state(page);
  await navigate(page, "Tune-up");
  await page.getByRole("button", { name: "Scan now", exact: true }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(8);
  await expect(page.getByRole("checkbox", { name: /User temp files/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /Windows temp/ })).not.toBeChecked();
  await page.getByRole("button", { name: /^Clean selected/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Clean 6 items?");
  expect((await state(page)).junk).toEqual(before.junk);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(8);
  await page.getByRole("button", { name: /^Clean selected/ }).click();
  await dialog.getByRole("button", { name: "Clean selected", exact: true }).click();
  await expect(page.getByText("Run a scan to see what can be reclaimed.", { exact: true })).toBeVisible();
  const eligible = before.junk.filter((item) => !item.admin_required);
  await expect.poll(async () => (await state(page)).freedSoFar).toBe(eligible.reduce((sum, item) => sum + item.size, 0));
  expect((await state(page)).undo[0]).toMatchObject({ kind: "junk_clean", revertible: false, data: { deleted: eligible.reduce((sum, item) => sum + item.file_count, 0) } });
  await page.getByRole("button", { name: "Scan now", exact: true }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(2);
  await expect(page.getByTitle("User temp files", { exact: true })).toHaveCount(0);
  expect((await state(page)).junk).toEqual(before.junk.filter((item) => item.admin_required));
});

test("pack apply records one undo entry and History reverts the whole look", async ({ page }) => {
  await openApp(page);
  const before = await state(page);
  await navigate(page, "Marketplace");
  const card = packCard(page, "Amber Retro");
  await card.getByRole("button", { name: "Apply", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText('Apply "Amber Retro"?');
  await dialog.getByRole("button", { name: "Apply pack", exact: true }).click();
  await expect.poll(async () => (await state(page)).undo[0]).toMatchObject({ kind: "marketplace_apply", revertible: true });
  expect((await state(page)).theme).not.toEqual(before.theme);
  await revertHistory(page, "Applied pack: Amber Retro");
  await expect.poll(async () => (await state(page)).theme).toEqual(before.theme);
});

test("pack share code round-trips from export to import", async ({ page }) => {
  await openApp(page);
  await navigate(page, "Marketplace");
  await packCard(page, "Amber Retro").getByTitle("Copy a share code for this pack's look (settings only)").click();
  await expect(page.getByText("Pack code copied — paste it to a friend")).toBeVisible({ timeout: 5000 });
  const code = await page.evaluate(() => navigator.clipboard.readText());
  expect(code).toMatch(/^[0-9A-Z]{20}$/);
  await page.getByPlaceholder("20-character pack code (digits + A–Z)").fill(code);
  await page.getByPlaceholder("Pack name", { exact: true }).fill("Round Trip");
  await page.getByRole("button", { name: "Import code", exact: true }).click();
  await expect(page.getByTitle("Round Trip", { exact: true })).toBeVisible();
  await expect.poll(async () => (await state(page)).bundles.some((b) => b.name === "Round Trip")).toBe(true);
});

test("update check surfaces an available update and downloads it verified", async ({ page }) => {
  await openApp(page, {
    mockUpdateResult: {
      state: "update-available", current: "1.0.0", latest: "1.1.0",
      url: "https://reforge.app/releases/1.1.0.exe", sha256: "abc123",
      notes: ["New looks"], message: "",
    },
  });
  await navigate(page, "Settings");
  await page.getByRole("button", { name: "Check for updates", exact: true }).click();
  await expect(page.getByText("Reforge 1.1.0 is available (you're on 1.0.0)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Download", exact: true }).click();
  await expect(page.getByText(/Verified · ready to install/)).toBeVisible();
});

test("security quick scan runs with live progress and completes", async ({ page }) => {
  await openApp(page);
  await navigate(page, "Security");
  await page.getByRole("button", { name: "Quick Scan", exact: true }).click();
  await expect(page.getByText(/Scan running in the background/)).toBeVisible();
  await expect(page.getByText(/Scan running in the background/)).toBeHidden({ timeout: 20000 });
});

test("settings automation persists across reload", async ({ page }) => {
  await openApp(page);
  await navigate(page, "Settings");
  const toggle = page.getByRole("switch", { name: "Weekly junk cleanup", exact: true });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await page.reload();
  await expect.poll(async () => (await state(page))?.theme).toBeTruthy();
  await navigate(page, "Settings");
  await expect(page.getByRole("switch", { name: "Weekly junk cleanup", exact: true })).toHaveAttribute("aria-checked", "false");
  await page.getByRole("switch", { name: "Weekly junk cleanup", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Weekly junk cleanup", exact: true })).toHaveAttribute("aria-checked", "true");
});

test("command palette navigates to a view by keyboard", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByPlaceholder("Find a setting or run an action…")).toBeVisible();
  await page.getByPlaceholder("Find a setting or run an action…").fill("Performance");
  await page.locator("div.fixed.inset-0 button", { hasText: "Performance" }).first().click();
  await expect(page.getByRole("heading", { name: "Performance", exact: true })).toBeVisible();
});

test("factory fresh restores the pre-makeover theme", async ({ page }) => {
  await openApp(page);
  const before = await state(page);
  await navigate(page, "Marketplace");
  const card = packCard(page, "Studio Blue");
  await card.getByRole("button", { name: "Apply", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Apply pack", exact: true }).click();
  await expect.poll(async () => (await state(page)).undo[0]).toMatchObject({ kind: "marketplace_apply" });
  await navigate(page, "History");
  await page.getByRole("button", { name: "Revert everything", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Revert your PC to pre-makeover state?");
  await dialog.getByRole("button", { name: "Yes, revert everything", exact: true }).click();
  await expect.poll(async () => (await state(page)).theme).toEqual(before.theme);
});

test("history filter narrows timeline", async ({ page }) => {
  await openApp(page);
  await navigate(page, "Marketplace");
  const card = packCard(page, "Amber Retro");
  await card.getByRole("button", { name: "Apply", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText('Apply "Amber Retro"?');
  await dialog.getByRole("button", { name: "Apply pack", exact: true }).click();
  await expect.poll(async () => (await state(page)).undo[0]).toMatchObject({ kind: "marketplace_apply", revertible: true });
  await navigate(page, "History");
  await expect(page.getByRole("listitem", { name: "Applied pack: Amber Retro" })).toBeVisible();
  // a non-matching kind hides the pack row and shows the empty-filter state
  // NOTE (diagnosis): pack apply logs a single composite `marketplace_apply`
  // entry — marketplace.rs apply_bundle_inner (single log_entry at the end;
  // per-component applies use *_raw helpers that log nothing) and the mock
  // agrees (share.ts pushes one entry). History.tsx filters by exact kind
  // equality (History.tsx:82, unit-proven by s3-history.test.tsx), so neither
  // hypothesized bug (substring match / extra `wallpaper` entry) exists in
  // code. "cursors" is still the safer hide-step kind: it unambiguously
  // matches nothing in this log and sits near the top of the ~90-option kind
  // dropdown (vs "wallpaper" 5th-from-last), minimizing option-click risk.
  await page.getByRole("button", { name: "Filter by change kind" }).click();
  await page.getByRole("option", { name: "cursors", exact: true }).click();
  // fail fast with a clear message if the option click ever misses — otherwise
  // the toBeHidden below times out confusingly with the row still visible
  await expect(page.getByRole("button", { name: "Filter by change kind" })).toContainText("cursors");
  await expect(page.getByRole("listitem", { name: "Applied pack: Amber Retro" })).toBeHidden();
  await expect(page.getByText("No changes match the current filters.", { exact: true })).toBeVisible();
  // the matching kind brings the row back
  await page.getByRole("button", { name: "Filter by change kind" }).click();
  await page.getByRole("option", { name: "marketplace apply", exact: true }).click();
  await expect(page.getByRole("listitem", { name: "Applied pack: Amber Retro" })).toBeVisible();
});

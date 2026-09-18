import { test, expect, openApp, navigate, state, revertHistory } from "./fixtures";

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
  await navigate(page, "Makeover");
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

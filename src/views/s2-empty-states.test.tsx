// S2.4 — empty-state pass verification.
// Renders Makeover (the view that owns the S2.4 gaps: imported video wallpapers,
// classic packs, widgets) with the backend mocked to return ZERO data, and
// asserts every list shows an honest empty state — never a raw "undefined" or a
// blank panel. Also renders History and Marketplace (the other S2.4-named views).
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Makeover from "./Makeover";
import History from "./History";
import Marketplace from "./Marketplace";
import Organize from "./Organize";

const { callMock, callWithTimeoutMock } = vi.hoisted(() => ({
  callMock: vi.fn(),
  callWithTimeoutMock: vi.fn(),
}));

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    call: callMock,
    callWithTimeout: callWithTimeoutMock,
    errorCopy: (e: unknown) => (e instanceof Error ? e.message : String(e)),
    swallow: () => {},
    onEvent: () => () => {},
    // api.ts re-exports these from format.ts — views import them from api.
    fmt: actual.fmt,
    fmtAge: actual.fmtAge,
    fmtDate: actual.fmtDate,
  };
});

/** Default zero-data backend. Getters that expect an object return null; list
 *  getters return [] — every view must degrade to an honest empty state. */
function zeroDataCall(cmd: string): unknown {
  switch (cmd) {
    // Object/state getters: return null (views guard with ?./?? []).
    case "get_theme_state":
      return { mode: "dark", accent_hex: "#0067C0", transparency: "mica", taskbar: "default", widgets: "default" };
    case "get_capability_matrix":
      return { taskbar_reposition: true, widgets: true, video_wallpaper: true, rgb: false, blue_light: true, power_plans: true, lock_screen: true, display_profiles: true, accessibility: false, gaming_mode: true, sound_schemes: true };
    case "get_applied_style":
    case "get_wallpapers": // WallpaperState object (monitors/wallpapers arrays nested)
    case "get_wallpaper_engine_state":
    case "get_wallpaper_slideshow":
    case "shell_get_taskbar_state":
    case "media_get_transcode_status":
    case "get_current_scheme":
    case "get_cursor_state":
    case "get_lock_screen_state":
    case "get_system_info":
    case "get_health_score":
    case "get_build_info":
    case "scan_junk":
    case "scan_duplicates":
      return null;
    default:
      // Everything else is a list getter — the zero-data case this test exists
      // for. Returning [] lets every list view render its honest empty state.
      return [];
  }
}

beforeEach(() => {
  callMock.mockReset();
  callWithTimeoutMock.mockReset();
  callWithTimeoutMock.mockResolvedValue(null);
  callMock.mockImplementation(async (cmd: string) => zeroDataCall(cmd));
});

describe("Marketplace featured looks", () => {
  it("browses installed packs using local arrow keys without hiding the full list", async () => {
    callMock.mockImplementation(async (cmd: string) => cmd === "marketplace_list_bundles"
      ? ["Ocean", "Forest"].map((name) => ({ id: name, name, version: "1", author: "Local", description: `${name} look`, component_count: 2, applied_count: 0 }))
      : zeroDataCall(cmd));
    render(<Marketplace />);
    const carousel = await screen.findByRole("region", { name: "Featured looks" });
    expect(within(carousel).getByText("Ocean")).toBeInTheDocument();
    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    expect(within(carousel).getByText("Forest")).toBeInTheDocument();
    expect(screen.getAllByText("Ocean")).toHaveLength(1);
    fireEvent.keyDown(carousel, { key: "Home" });
    expect(within(carousel).getByText("Ocean")).toBeInTheDocument();
    fireEvent.click(within(carousel).getByRole("button", { name: "Next look" }));
    expect(within(carousel).getByText("Forest")).toBeInTheDocument();
    expect(callMock).not.toHaveBeenCalledWith("marketplace_apply", expect.anything());
  });
});

describe("History keyboard list", () => {
  const entries = [
    { id: "e1", ts: Date.now(), kind: "accent", description: "Accent changed", revertible: true, undone: false, data: {} },
    { id: "e2", ts: Date.now(), kind: "mode", description: "Mode changed", revertible: true, undone: false, data: {} },
  ];

  it("arrow keys move between rows and Enter reverts the focused row", async () => {
    callMock.mockImplementation(async (cmd: string) => cmd === "get_undo_log" ? entries : zeroDataCall(cmd));
    render(<History />);
    const list = await screen.findByRole("list");
    (list as HTMLElement).focus();
    fireEvent.keyDown(list, { key: "ArrowDown" });
    const items = within(list as HTMLElement).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    // focus never leaves the list while navigating it
    expect((list as HTMLElement).contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    await waitFor(() => expect(callMock).toHaveBeenCalledWith("revert_entry", { id: "e2" }));
  });

  it("history arrow keys are scoped to the list and never trap global keys", async () => {
    callMock.mockImplementation(async (cmd: string) => cmd === "get_undo_log" ? entries : zeroDataCall(cmd));
    render(<History />);
    const list = await screen.findByRole("list");
    const before = document.activeElement;
    // arrows outside the list do nothing global: focus stays where it was
    fireEvent.keyDown(document.body, { key: "ArrowDown" });
    expect(document.activeElement).toBe(before);
    expect((list as HTMLElement).contains(document.activeElement)).toBe(false);
  });
});

describe("Organize smart-folder disclosure", () => {
  const folders = [
    { id: "sf1", name: "Invoices", root: "C:\\Docs", extensions: ["pdf"], min_age_days: null, created_at: 1 },
  ];
  const hits = [
    { path: "C:\\Docs\\a.pdf", size: 10, modified: 1 },
    { path: "C:\\Docs\\b.pdf", size: 20, modified: 2 },
  ];

  it("expands a folder row to preview its hits inline", async () => {
    callMock.mockImplementation(async (cmd: string) =>
      cmd === "list_smart_folders" ? folders
      : cmd === "run_smart_folder" ? hits
      : zeroDataCall(cmd));
    render(<Organize />);
    const run = await screen.findByRole("button", { name: "Run Invoices" });
    expect(run).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(run);
    await waitFor(() => expect(run).toHaveAttribute("aria-expanded", "true"));
    expect(screen.getByText(/2 files?/)).toBeInTheDocument();
    expect(screen.getByTitle("C:\\Docs\\a.pdf")).toBeInTheDocument();
    fireEvent.click(run);
    await waitFor(() => expect(run).toHaveAttribute("aria-expanded", "false"));
  });
});

describe("S2.4 zero-data empty states", () => {
  it("Makeover shows empty states for video wallpapers, classic packs, and widgets — no raw undefined", async () => {
    const { container } = render(<Makeover />);
    await waitFor(
      () => expect(screen.getByText(/No imported videos yet/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(screen.getByText(/No packs installed yet/i)).toBeInTheDocument();
    expect(screen.getByText(/No widgets yet/i)).toBeInTheDocument();
    // The whole view must render without a literal "undefined" leaking into text.
    expect(container.textContent).not.toContain("undefined");
  });

  it("History shows an empty state when nothing has been logged", async () => {
    render(<History />);
    await waitFor(
      () => expect(screen.getByText(/Nothing logged yet/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it("Marketplace shows an empty state when no packs are installed", async () => {
    render(<Marketplace />);
    await waitFor(
      () => expect(screen.getByText(/No packs installed yet/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });
});

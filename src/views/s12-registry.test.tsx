// Task 6 — Advanced settings registry table (read-only allowlist view).
// Covers the populated table (four allowlisted values, table semantics with
// i18n headers) and the `read_registry_value` mock boundary: allowlisted
// pairs resolve, arbitrary paths reject like the Rust AppError::Invalid.
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ToastHost } from "../components/ui";
import Settings from "./Settings";
import type { RegistryValue } from "../lib/types";

const STORE_KEY = "reforge-mock-v1";

afterEach(() => {
  localStorage.removeItem(STORE_KEY);
  vi.resetModules();
});

function withToasts(node: React.ReactNode) {
  return render(
    <>
      <ToastHost />
      {node}
    </>,
  );
}

describe("Advanced registry table (read-only)", () => {
  it("renders the four allowlisted values in an accessible table", { timeout: 120_000 }, async () => {
    const { container } = withToasts(<Settings />);
    const table = await waitFor(
      () => {
        const el = container.querySelector('div[role="region"] table');
        if (!el) throw new Error("registry table not rendered yet");
        return el;
      },
      { timeout: 15000 },
    );
    for (const name of ["AppsUseLightTheme", "ColorPrevalence", "TaskbarAl", "TaskbarSi"]) {
      expect(table.textContent).toContain(name);
    }
    expect(table.querySelectorAll("thead th")).toHaveLength(2);
    expect(table.querySelectorAll("tbody tr")).toHaveLength(4);
    // row headers carry the full path for disambiguation
    const firstRowHeader = table.querySelector("tbody tr th");
    expect(firstRowHeader?.getAttribute("title")).toContain("Personalize");
  });

  it("read_registry_value mock resolves allowlisted pairs and rejects the rest", { timeout: 60_000 }, async () => {
    const m = await import("../lib/mock");
    const ok = await m.mockCall<RegistryValue>("read_registry_value", {
      path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
      name: "AppsUseLightTheme",
    });
    expect(ok.value).toBe("0");
    expect(ok.kind).toBe("DWORD");
    await expect(
      m.mockCall("read_registry_value", { path: "HKLM\\SOFTWARE\\Evil", name: "x" }),
    ).rejects.toThrow("allowlist");
  });
});

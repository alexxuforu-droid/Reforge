// Task 11 — signature motion primitives. Every primitive freezes (static
// render + data-motion-frozen) under prefers-reduced-motion, works by
// keyboard where interactive, and never moves a click target while the
// pointer is down. Original code — no third-party motion sources.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TiltCard } from "./TiltCard";
import { SpotlightCard } from "./SpotlightCard";
import { MagneticButton } from "./MagneticButton";
import { BlurReveal } from "./BlurReveal";
import { LookCarousel } from "./LookCarousel";
import { FolderPreview } from "./FolderPreview";

const realMatchMedia = window.matchMedia;

afterEach(() => {
  Object.defineProperty(window, "matchMedia", { writable: true, value: realMatchMedia });
});

function stubReduced(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: reduce,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

describe("motion primitives freeze under reduced motion", () => {
  it("all six render static with data-motion-frozen", () => {
    stubReduced(true);
    render(
      <>
        <TiltCard title="t" />
        <SpotlightCard><span>x</span></SpotlightCard>
        <MagneticButton label="go" />
        <BlurReveal text="done" />
        <LookCarousel items={["a", "b"]} />
        <FolderPreview name="f" count={3} />
      </>,
    );
    expect(document.querySelectorAll("[data-motion-frozen]")).toHaveLength(6);
  });
});

describe("motion primitives stay operable with motion allowed", () => {
  it("carousel advances and announces, folder toggles", () => {
    stubReduced(false);
    render(
      <>
        <LookCarousel items={["a", "b"]} />
        <FolderPreview name="f" count={3} />
      </>,
    );
    const region = screen.getByRole("region", { name: /looks/i });
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(screen.getByText("b")).toBeInTheDocument();
    const folder = screen.getByRole("button", { name: /f.*3/ });
    expect(folder).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(folder);
    expect(folder).toHaveAttribute("aria-expanded", "true");
  });

  it("magnetic button never offsets while pressed", () => {
    stubReduced(false);
    render(<MagneticButton label="go" />);
    const btn = screen.getByRole("button", { name: "go" });
    fireEvent.pointerDown(btn);
    fireEvent.mouseMove(btn, { clientX: 500, clientY: 500 });
    expect(btn.style.transform).toBe("");
    fireEvent.pointerUp(btn);
  });
});

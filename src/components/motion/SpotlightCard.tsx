import { useState, type ReactNode } from "react";
import { useReducedMotion } from "./useMotionPrefs";

/** Cursor-following accent glow inside cards. Frozen renders children with
 *  no overlay; keyboard focus gets the same glow via :focus-within in CSS. */
export function SpotlightCard({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [on, setOn] = useState(false);

  if (reduced) {
    return <div data-motion-frozen className="spotlight-card">{children}</div>;
  }

  return (
    <div
      className="spotlight-card"
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPos({
          x: Math.round(((e.clientX - rect.left) / rect.width) * 100),
          y: Math.round(((e.clientY - rect.top) / rect.height) * 100),
        });
        setOn(true);
      }}
      onPointerLeave={() => setOn(false)}
      style={on ? { ["--spot-x" as string]: `${pos.x}%`, ["--spot-y" as string]: `${pos.y}%` } : undefined}
    >
      {children}
    </div>
  );
}

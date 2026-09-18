import { useRef, useState, type ReactNode } from "react";
import { useFinePointer, useReducedMotion } from "./useMotionPrefs";

const MAX_DEG = 6;

/** Subtle pointer tilt for preview artwork. Frozen (static) when reduced
 *  motion is on or there is no fine pointer; keyboard users get the same
 *  content with zero motion. */
export function TiltCard({ title, children }: { title: string; children?: ReactNode }) {
  const reduced = useReducedMotion();
  const fine = useFinePointer();
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  if (reduced || !fine) {
    return (
      <div data-motion-frozen className="overflow-hidden rounded-xl">
        {title && <span className="sr-only">{title}</span>}
        {children}
      </div>
    );
  }

  const onMove = (e: React.PointerEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -(py * MAX_DEG * 2), y: px * MAX_DEG * 2 });
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      className="overflow-hidden rounded-xl transition-transform duration-100"
      style={{ transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
    >
      {children}
    </div>
  );
}

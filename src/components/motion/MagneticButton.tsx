import { useRef, useState } from "react";
import { useFinePointer, useReducedMotion } from "./useMotionPrefs";

const MAX_PX = 2;

/** A button that leans ≤2px toward the cursor on fine pointers. Never
 *  offsets while pressed (the click target stays put); frozen renders a
 *  plain button. */
export function MagneticButton({ label, onClick, disabled, testId }: { label: string; onClick?: () => void; disabled?: boolean; testId?: string }) {
  const reduced = useReducedMotion();
  const fine = useFinePointer();
  const ref = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [pressed, setPressed] = useState(false);

  if (reduced || !fine) {
    return (
      <button data-motion-frozen type="button" className="btn-primary btn-sm" onClick={onClick} disabled={disabled} data-testid={testId}>
        {label}
      </button>
    );
  }

  const onMove = (e: React.MouseEvent) => {
    if (pressed) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    setOffset({ x: Math.round((dx / len) * Math.min(MAX_PX, len / 40)), y: Math.round((dy / len) * Math.min(MAX_PX, len / 40)) });
  };

  return (
    <button
      ref={ref}
      type="button"
      className="btn-primary btn-sm"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      onMouseMove={onMove}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
      onPointerDown={() => {
        setPressed(true);
        setOffset({ x: 0, y: 0 });
      }}
      onPointerUp={() => setPressed(false)}
      style={offset.x === 0 && offset.y === 0 ? undefined : { transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      {label}
    </button>
  );
}

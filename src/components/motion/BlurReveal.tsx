import { useReducedMotion } from "./useMotionPrefs";

/** One-shot blur-to-sharp text reveal (completion lines, headlines).
 *  Frozen renders plain text; honors the global reduced-motion kill-switch
 *  via the shared `animate-blur-in` token. */
export function BlurReveal({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) {
    return (
      <span data-motion-frozen className={className}>
        {text}
      </span>
    );
  }
  return (
    <span className={`animate-blur-in${className ? ` ${className}` : ""}`} aria-live="polite">
      {text}
    </span>
  );
}

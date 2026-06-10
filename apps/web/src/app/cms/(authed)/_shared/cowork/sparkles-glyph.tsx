/**
 * The handoff's exact `sparkles` glyph (a sharp 4-point star + a small spark) —
 * the design's Cowork/AI mark. lucide-react's `Sparkles` is a different (rounded,
 * 3-point) icon, so we use the handoff SVG verbatim for pixel fidelity.
 * Drop-in for `<Sparkles size={n} />`.
 */
export function SparklesGlyph({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M5 19l.6 1.7L7.5 21l-1.9.6L5 23l-.6-1.4L2.5 21l1.9-.7z" />
    </svg>
  )
}

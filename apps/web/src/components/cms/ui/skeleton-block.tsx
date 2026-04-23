interface SkeletonBlockProps {
  className?: string
  width?: string
  height?: string
}

export function SkeletonBlock({ className = '', width, height }: SkeletonBlockProps) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-cms-surface via-cms-surface-hover to-cms-surface bg-[length:200%_100%] ${className}`}
      style={{ width, height }}
      aria-busy="true"
    />
  )
}

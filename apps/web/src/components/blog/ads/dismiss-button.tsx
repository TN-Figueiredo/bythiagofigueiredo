'use client'

type DismissButtonProps = {
  onClick: () => void
  label?: string
  color?: string
}

/**
 * Shared dismiss button used across all ad slots.
 * Renders a small x with hover opacity transition.
 */
export function DismissButton({ onClick, label, color }: DismissButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label || 'Dismiss'}
      className="cursor-pointer border-none bg-transparent p-1 leading-none transition-opacity duration-150 hover:opacity-100"
      style={{
        color: color || 'var(--pb-muted)',
        fontSize: 14,
        opacity: 0.55,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '1'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '0.55'
      }}
    >
      ×
    </button>
  )
}

'use client'

export interface DotsProps {
  total: number
  done: number
  color?: string
}

export function Dots({ total, done, color = 'var(--cms-accent)' }: DotsProps) {
  if (!Number.isFinite(total) || total <= 0) return null

  const filled = Math.min(done, total)

  return (
    <div
      role="meter"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
      className="flex gap-1 flex-wrap"
    >
      {Array.from({ length: total }, (_, i) => {
        const isFilled = i < filled
        return (
          <span
            key={i}
            data-dot
            className="inline-block size-2 rounded-full"
            style={{
              backgroundColor: isFilled ? color : 'var(--cms-surface-3)',
            }}
          />
        )
      })}
    </div>
  )
}

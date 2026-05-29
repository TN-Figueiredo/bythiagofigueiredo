'use client'

import type { DisplayLabel } from '@/lib/youtube/ab-types'

export interface ABBATimelineProps {
  /** The rotation sequence of variant labels */
  seq: DisplayLabel[]
  /** Total number of cycles */
  total: number
  /** Number of completed cycles */
  done: number
  /** Color map from variant label to hex color */
  colors: Record<string, string>
  /** Variant label for the next cycle */
  nextVariant?: string
}

export function ABBATimeline({ seq, total, done, colors, nextVariant }: ABBATimelineProps) {
  // Find the index of the first pending block that matches nextVariant
  const nextIndex = nextVariant !== undefined
    ? seq.findIndex((label, i) => i >= done && label === nextVariant)
    : -1

  const blocks = seq.map((label, i) => {
    const isDone = i < done
    const isNext = i === nextIndex
    const color = colors[label] ?? '#8A8F98'

    const style: React.CSSProperties = isDone
      ? { backgroundColor: color }
      : { backgroundColor: color, opacity: 0.4 }

    if (isNext) {
      style.border = '2px dashed currentColor'
    }

    return (
      <div
        key={i}
        data-block
        {...(isNext ? { 'data-next': '' } : {})}
        style={style}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-bold text-white"
      >
        {label}
      </div>
    )
  })

  const useScroll = total >= 50

  return (
    <div className="flex flex-col gap-2">
      {useScroll ? (
        <div data-scroll className="overflow-x-auto">
          <div className="flex flex-row gap-1">{blocks}</div>
        </div>
      ) : (
        <div className="flex flex-row flex-wrap gap-1">{blocks}</div>
      )}
      <p className="text-xs text-muted-foreground">
        {done}/{total} cycles
      </p>
    </div>
  )
}

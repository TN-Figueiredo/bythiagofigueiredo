// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/wave-decor.tsx
'use client'

import { memo, useMemo } from 'react'
import { pRand } from './utils'

interface WaveDecorProps {
  width: number
  height: number
  color: string
  seed?: number
}

function WaveDecorRaw({ width, height, seed = 0 }: WaveDecorProps) {
  const bars = useMemo(() => {
    const bw = 2
    const gap = 1
    const step = bw + gap
    const n = Math.max(1, Math.floor(width / step))
    const result: Array<{ x: number; y: number; h: number }> = []
    for (let i = 0; i < n; i++) {
      const r = pRand(i + seed * 7.3)
      const h = r * 0.55 + 0.25
      result.push({ x: i * step, y: height * (1 - h) / 2, h: height * h })
    }
    return result
  }, [width, height, seed])

  return (
    <svg
      width={width}
      height={height}
      className="absolute left-0 top-0 pointer-events-none"
      style={{ opacity: 0.18 }}
      aria-hidden
    >
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={2} height={b.h} fill="#fff" />
      ))}
    </svg>
  )
}

export const WaveDecor = memo(WaveDecorRaw)
WaveDecor.displayName = 'WaveDecor'

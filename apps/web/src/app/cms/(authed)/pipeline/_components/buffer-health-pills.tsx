'use client'

import { gemMix } from '@/lib/pipeline/gem-design'
import type { FormatCoverage } from '@/lib/pipeline/scan-buffer-depth'

interface BufferHealthPillsProps {
  formats: Record<string, FormatCoverage>
  overallHealth: 'green' | 'yellow' | 'red'
}

const FORMAT_LABELS: Record<string, string> = {
  video: 'Video',
  blog_post: 'Blog',
  newsletter: 'Newsletter',
}

const HEALTH_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  green: {
    bg: gemMix('--gem-done', 12),
    text: 'var(--gem-done)',
    border: gemMix('--gem-done', 25),
  },
  yellow: {
    bg: gemMix('--gem-warn', 12),
    text: 'var(--gem-warn)',
    border: gemMix('--gem-warn', 25),
  },
  red: {
    bg: gemMix('--gem-danger', 12),
    text: 'var(--gem-danger)',
    border: gemMix('--gem-danger', 25),
  },
}

export function BufferHealthPills({ formats, overallHealth }: BufferHealthPillsProps) {
  const entries = Object.entries(formats).filter(([, c]) => c.totalSlots > 0)

  if (entries.length === 0) return null

  return (
    <div
      className="flex items-center gap-2 flex-wrap"
      role="status"
      aria-label={`Buffer depth: ${overallHealth}`}
    >
      <span
        className="text-[10px] font-medium uppercase tracking-wider"
        style={{ color: 'var(--gem-dim)' }}
      >
        Buffer
      </span>
      {entries.map(([format, coverage]) => {
        const colors = HEALTH_COLORS[coverage.health] ?? HEALTH_COLORS['red']!
        const label = FORMAT_LABELS[format] ?? format

        return (
          <span
            key={format}
            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border"
            style={{
              background: colors.bg,
              color: colors.text,
              borderColor: colors.border,
            }}
            title={`${label}: ${coverage.filledSlots}/${coverage.totalSlots} slots filled (${coverage.coveragePercent}%)`}
            aria-label={`${label}: ${coverage.filledSlots} de ${coverage.totalSlots} slots preenchidos`}
          >
            <span>{label}</span>
            <span aria-hidden="true">
              {coverage.filledSlots}/{coverage.totalSlots}
            </span>
          </span>
        )
      })}
    </div>
  )
}

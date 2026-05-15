'use client'

import Link from 'next/link'
import { getFormatIcon } from '@/lib/pipeline/gem-design'

interface OriginCardProps {
  pipelineItem: { id: string; code: string; format: string; stage: string; priority: number } | null
}

export function OriginCard({ pipelineItem }: OriginCardProps) {
  if (!pipelineItem) return null

  const formatIcon = getFormatIcon(pipelineItem.format)

  return (
    <Link
      href={`/cms/pipeline/${pipelineItem.format}/${pipelineItem.id}`}
      className="block rounded-lg border p-3 transition-colors hover:border-[var(--gem-accent)]"
      style={{ background: 'var(--gem-surface, #0d1118)', borderColor: 'var(--gem-border, #1a2030)' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">{formatIcon.icon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-mono" style={{ color: 'var(--gem-accent, #818cf8)' }}>
            ← {pipelineItem.code}
          </span>
          <p className="text-[10px]" style={{ color: 'var(--gem-dim, #3d4654)' }}>
            Pipeline · {pipelineItem.stage}
          </p>
        </div>
      </div>
    </Link>
  )
}

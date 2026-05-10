'use client'

import Link from 'next/link'
import { WORKFLOWS } from '@/lib/pipeline/workflows'
import { GemCard, type GemCardItem } from './gem-card'
import { PipelineFilterBar } from './pipeline-filter-bar'
import type { Format } from '@/lib/pipeline/schemas'
import { useSearchParams } from 'next/navigation'

interface PipelineBoardProps {
  format: Format
  items: GemCardItem[]
  collections: Array<{ code: string; name: string }>
}

export function PipelineBoard({ format, items, collections }: PipelineBoardProps) {
  const stages = WORKFLOWS[format]
  const searchParams = useSearchParams()

  const collectionFilter = searchParams.get('collection')
  const langFilter = searchParams.get('lang')
  const priorityFilter = searchParams.get('priority')

  const filtered = items.filter((item) => {
    if (collectionFilter && item.collection_code !== collectionFilter) return false
    if (langFilter && item.language !== langFilter) return false
    if (priorityFilter && item.priority !== Number(priorityFilter)) return false
    return true
  })

  const itemsByStage = stages.reduce<Record<string, GemCardItem[]>>((acc, stage) => {
    acc[stage.stage] = filtered.filter((i) => i.stage === stage.stage)
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <PipelineFilterBar collections={collections} />
        <Link
          href={`/cms/pipeline/${format}?action=create`}
          className="text-xs px-3 py-1.5 rounded-lg shrink-0 transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'var(--gem-accent)', color: 'white' }}
        >
          + New item
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[calc(100vh-14rem)]">
        {stages.map((stage) => (
          <div key={stage.stage} className="flex-shrink-0 w-72">
            <div className="sticky top-0 pb-2 z-10" style={{ backgroundColor: 'var(--gem-well)' }}>
              <div className="flex items-center justify-between px-2 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--gem-surface)', borderLeft: '3px solid var(--gem-accent)' }}>
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--gem-muted)' }}>{stage.label_pt}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--gem-border)', color: 'var(--gem-dim)' }}>
                  {itemsByStage[stage.stage]?.length ?? 0}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              {itemsByStage[stage.stage]?.map((item) => (
                <GemCard key={item.id} item={item} />
              ))}
              {(itemsByStage[stage.stage]?.length ?? 0) === 0 && (
                <p className="text-[10px] text-center py-8" style={{ color: 'var(--gem-faint)' }}>Nenhum em {stage.label_pt}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

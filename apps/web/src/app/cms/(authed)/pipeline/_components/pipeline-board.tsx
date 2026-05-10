'use client'

import { WORKFLOWS } from '@/lib/pipeline/workflows'
import { getFormatColor } from '@/lib/pipeline/colors'
import { PipelineCard } from './pipeline-card'
import type { Format } from '@/lib/pipeline/schemas'

interface BoardItem {
  id: string
  code: string
  title_pt: string | null
  title_en: string | null
  stage: string
  priority: number
  language: string
  tags: string[]
  production_checklist: Array<{ label: string; done: boolean }>
  version: number
  format: string
  collectionCode: string | null
  collectionName: string | null
  membershipRole: string | null
}

interface PipelineBoardProps {
  format: Format
  items: BoardItem[]
}

export function PipelineBoard({ format, items }: PipelineBoardProps) {
  const stages = WORKFLOWS[format]
  const colors = getFormatColor(format)

  const itemsByStage = stages.reduce<Record<string, BoardItem[]>>((acc, stage) => {
    acc[stage.stage] = items.filter((i) => i.stage === stage.stage)
    return acc
  }, {})

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[calc(100vh-12rem)]">
      {stages.map((stage) => (
        <div key={stage.stage} className="flex-shrink-0 w-64">
          <div className="sticky top-0 bg-slate-900 pb-2 z-10">
            <div
              className="flex items-center justify-between px-2 py-1.5 rounded-lg"
              style={{ backgroundColor: colors.bg, borderLeft: `3px solid ${colors.accent}` }}
            >
              <span className="text-sm font-medium" style={{ color: colors.text }}>{stage.label_pt}</span>
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: colors.border, color: colors.text }}
              >
                {itemsByStage[stage.stage]?.length ?? 0}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {itemsByStage[stage.stage]?.map((item) => (
              <PipelineCard
                key={item.id}
                id={item.id}
                code={item.code}
                title={item.title_pt || item.title_en || 'Untitled'}
                priority={item.priority}
                language={item.language}
                tags={item.tags}
                checklist={item.production_checklist}
                version={item.version}
                collectionCode={item.collectionCode}
                collectionName={item.collectionName}
                membershipRole={item.membershipRole}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

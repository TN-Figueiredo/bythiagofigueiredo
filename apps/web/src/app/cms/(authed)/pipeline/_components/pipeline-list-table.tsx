'use client'

import Link from 'next/link'
import { getFormatIcon, getPriorityConfig, getLangConfig, getChecklistProgress } from '@/lib/pipeline/gem-design'
import { GemVvsRing } from './gem-vvs-ring'

interface ListItem {
  id: string
  code: string
  title_pt: string | null
  title_en: string | null
  format: string
  stage: string
  priority: number
  language: string
  updated_at: string
  production_checklist: Array<{ label: string; done: boolean }>
  validation_score: number
}

export function PipelineListTable({ items }: { items: ListItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: 'var(--gem-border)' }}>
            <th className="pb-2 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>Code</th>
            <th className="pb-2 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>Title</th>
            <th className="pb-2 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>Format</th>
            <th className="pb-2 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>Stage</th>
            <th className="pb-2 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>Priority</th>
            <th className="pb-2 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>Lang</th>
            <th className="pb-2 text-center text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>VVS</th>
            <th className="pb-2 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>Checklist</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const formatIcon = getFormatIcon(item.format)
            const priority = getPriorityConfig(item.priority)
            const lang = getLangConfig(item.language)
            const checklist = getChecklistProgress(item.production_checklist)
            return (
              <tr key={item.id} className="border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor: 'var(--gem-border)' }}>
                <td className="py-2.5"><Link href={`/cms/pipeline/items/${item.id}`} className="font-mono text-[10px] hover:underline" style={{ color: priority.accent }}>{item.code}</Link></td>
                <td className="py-2.5"><span className="text-xs" style={{ color: 'var(--gem-text)' }}>{item.title_pt || item.title_en || '—'}</span></td>
                <td className="py-2.5"><span className="text-xs">{formatIcon.icon}</span></td>
                <td className="py-2.5"><span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--gem-well)', color: 'var(--gem-muted)' }}>{item.stage}</span></td>
                <td className="py-2.5"><span className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: priority.accentDim, color: priority.accent }}>{priority.label}</span></td>
                <td className="py-2.5"><span className={`text-[10px] px-1 py-0.5 rounded ${lang.className}`}>{lang.label}</span></td>
                <td className="py-2.5 text-center"><GemVvsRing score={item.validation_score} size={20} /></td>
                <td className="py-2.5"><div className="flex gap-0.5 w-16">{checklist.segments.map((done, i) => (<div key={i} className="h-1 flex-1 rounded-sm" style={{ backgroundColor: done ? 'var(--gem-done)' : 'var(--gem-well)' }} />))}</div></td>
              </tr>
            )
          })}
          {items.length === 0 && (<tr><td colSpan={8} className="py-8 text-center text-xs" style={{ color: 'var(--gem-faint)' }}>No items found</td></tr>)}
        </tbody>
      </table>
    </div>
  )
}

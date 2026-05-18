'use client'

import { useState, useMemo } from 'react'
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

type SortKey = 'code' | 'priority' | 'stage' | 'updated_at' | 'validation_score'
type SortDir = 'asc' | 'desc'

export function PipelineListTable({ items }: { items: ListItem[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('priority')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'code': cmp = a.code.localeCompare(b.code); break
        case 'priority': cmp = a.priority - b.priority; break
        case 'stage': cmp = a.stage.localeCompare(b.stage); break
        case 'updated_at': cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(); break
        case 'validation_score': cmp = a.validation_score - b.validation_score; break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [items, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function SortHeader({ k, label, align }: { k: SortKey; label: string; align?: 'center' }) {
    const active = sortKey === k
    return (
      <th scope="col" tabIndex={0} className={`pb-2 text-${align ?? 'left'} text-[10px] uppercase tracking-wider font-medium cursor-pointer select-none hover:opacity-80`} style={{ color: active ? 'var(--gem-text)' : 'var(--gem-dim)' }} onClick={() => toggleSort(k)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort(k) } }} aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        {label}{active && (sortDir === 'asc' ? ' ↑' : ' ↓')}
      </th>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" role="grid">
        <thead>
          <tr className="border-b" style={{ borderColor: 'var(--gem-border)' }}>
            <SortHeader k="code" label="Code" />
            <th scope="col" className="pb-2 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>Title</th>
            <th scope="col" className="pb-2 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>Format</th>
            <SortHeader k="stage" label="Stage" />
            <SortHeader k="priority" label="Priority" />
            <th scope="col" className="pb-2 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>Lang</th>
            <SortHeader k="validation_score" label="VVS" align="center" />
            <th scope="col" className="pb-2 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gem-dim)' }}>Checklist</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => {
            const formatIcon = getFormatIcon(item.format)
            const priority = getPriorityConfig(item.priority)
            const lang = getLangConfig(item.language)
            const checklist = getChecklistProgress(item.production_checklist)
            return (
              <tr key={item.id} className="border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor: 'var(--gem-border)' }}>
                <td className="py-2.5">
                  <Link href={`/cms/pipeline/items/${item.id}`} className="font-mono text-[10px] hover:underline" style={{ color: priority.accent }}>{item.code}</Link>
                </td>
                <td className="py-2.5">
                  <span className="text-xs" style={{ color: 'var(--gem-text)' }}>{item.title_pt || item.title_en || '—'}</span>
                </td>
                <td className="py-2.5">
                  <span className="text-xs" title={formatIcon.label}>{formatIcon.icon}</span>
                </td>
                <td className="py-2.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--gem-well)', color: 'var(--gem-muted)' }}>{item.stage}</span>
                </td>
                <td className="py-2.5">
                  <span className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: priority.accentDim, color: priority.accent }}>{priority.label}</span>
                </td>
                <td className="py-2.5">
                  <span className={`text-[10px] px-1 py-0.5 rounded ${lang.className}`}>{lang.label}</span>
                </td>
                <td className="py-2.5 text-center">
                  <GemVvsRing score={item.validation_score} size={20} />
                </td>
                <td className="py-2.5">
                  <div className="flex gap-0.5 w-16">
                    {checklist.segments.map((done, i) => (
                      <div key={i} className="h-1 flex-1 rounded-sm" style={{ backgroundColor: done ? 'var(--gem-done)' : 'var(--gem-well)' }} />
                    ))}
                  </div>
                </td>
              </tr>
            )
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-xs" style={{ color: 'var(--gem-faint)' }}>No items found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

'use client'

import { useState } from 'react'

interface BacklogItem { id: string; title: string; type: 'post' | 'newsletter'; status: string; locale?: string }
interface CadenceRow { label: string; schedule: string; color: string }
interface WeekSummaryRow { label: string; value: number | string; accent?: string }

interface BacklogPanelProps {
  items: BacklogItem[]; cadence: CadenceRow[]; weekSummary: WeekSummaryRow[]
  onScheduleItem?: (item: BacklogItem) => void; onEditCadence?: () => void
}

const SLOT_COLORS = {
  post: 'var(--cms-accent, #6366f1)',
  newsletter: 'var(--cms-green, #22c55e)',
  campaign: 'var(--cms-amber, #f59e0b)',
} as const

const TYPE_DOT: Record<string, string> = { post: SLOT_COLORS.post, newsletter: SLOT_COLORS.newsletter }
const STATUS_COLORS: Record<string, string> = { ready: SLOT_COLORS.post, draft: SLOT_COLORS.campaign, queued: 'var(--cms-purple, #8b5cf6)' }

export function BacklogPanel({ items, cadence, weekSummary, onScheduleItem, onEditCadence }: BacklogPanelProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  return (
    <aside className="w-full flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
      {/* Backlog section */}
      <div className="rounded-[10px] border p-3"
        style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--cms-text-dim, #52525b)' }}>Backlog</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-md"
            style={{ background: `var(--cms-accent-subtle, color-mix(in srgb, ${SLOT_COLORS.post} 12%, transparent))`, color: SLOT_COLORS.post }}>
            {items.length} ready</span>
        </div>
        {items.length === 0 ? (
          <p className="text-[11px] text-center py-3" style={{ color: 'var(--cms-text-dim, #52525b)' }}>No items in backlog</p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id} draggable onDragStart={() => setDraggingId(item.id)} onDragEnd={() => setDraggingId(null)}
                onClick={() => onScheduleItem?.(item)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing transition-colors group"
                style={{ background: draggingId === item.id ? 'var(--cms-surface-hover, #1f2330)' : 'transparent', opacity: draggingId === item.id ? 0.6 : 1 }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TYPE_DOT[item.type] ?? 'var(--cms-text-dim)' }} />
                <span className="flex-1 text-[12px] truncate" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{item.title}</span>
                <span className="text-[10px] px-1 rounded shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: STATUS_COLORS[item.status] ? `color-mix(in srgb, ${STATUS_COLORS[item.status]} 15%, transparent)` : 'var(--cms-border)',
                    color: STATUS_COLORS[item.status] ?? 'var(--cms-text-dim)' }}>{item.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Publishing cadence */}
      <div className="rounded-[10px] border p-3"
        style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider block mb-2"
          style={{ color: 'var(--cms-text-dim, #52525b)' }}>Publishing Cadence</span>
        {cadence.length === 0 ? (
          <p className="text-[11px] py-2" style={{ color: 'var(--cms-text-dim)' }}>No cadence configured</p>
        ) : (
          <ul className="space-y-1.5 mb-3">
            {cadence.map((row, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: row.color }} />
                <span className="flex-1 text-[11px]" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{row.label}</span>
                <span className="text-[10px]" style={{ color: 'var(--cms-text-dim, #52525b)' }}>{row.schedule}</span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={onEditCadence}
          className="w-full text-center text-[11px] py-1 rounded-md border transition-colors hover:text-[var(--cms-accent,#6366f1)] hover:border-[var(--cms-accent,#6366f1)]"
          style={{ borderColor: 'var(--cms-border, #2a2d3a)', color: 'var(--cms-text-muted, #71717a)' }}>Edit cadence</button>
      </div>

      {/* This Week summary */}
      <div className="rounded-[10px] border p-3"
        style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider block mb-2"
          style={{ color: 'var(--cms-text-dim, #52525b)' }}>This Week</span>
        <ul className="space-y-1.5">
          {weekSummary.map((row, i) => (
            <li key={i} className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: 'var(--cms-text-muted, #71717a)' }}>{row.label}</span>
              <span className="text-[12px] font-medium tabular-nums" style={{ color: row.accent ?? 'var(--cms-text, #e4e4e7)' }}>{row.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

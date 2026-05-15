'use client'

import { POST_TABS, type PostTab, type SectionStatus } from '@/lib/posts/types'
import { usePostEditor } from '../post-editor-context'

interface SectionsPanelProps {
  tabStatuses: Record<PostTab, SectionStatus>
}

const STATUS_COLORS: Record<SectionStatus, string> = {
  done: 'var(--gem-done, #22c55e)',
  warn: 'var(--gem-warn, #f59e0b)',
  empty: 'transparent',
}

export function SectionsPanel({ tabStatuses }: SectionsPanelProps) {
  const { dispatch } = usePostEditor()

  return (
    <div
      className="rounded-lg border p-3"
      style={{ background: 'var(--gem-surface, #0d1118)', borderColor: 'var(--gem-border, #1a2030)' }}
    >
      <h3 className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--gem-dim, #3d4654)' }}>
        Seções
      </h3>
      <div className="space-y-1.5">
        {POST_TABS.map(({ tab, labelPt }) => {
          const status = tabStatuses[tab]
          return (
            <button
              key={tab}
              type="button"
              onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab })}
              className="w-full flex items-center justify-between text-[11px] py-0.5 transition-colors hover:opacity-80"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    background: STATUS_COLORS[status],
                    border: status === 'empty' ? '1px solid var(--gem-dim, #3d4654)' : 'none',
                  }}
                />
                <span style={{ color: status !== 'empty' ? 'var(--gem-muted, #8b949e)' : 'var(--gem-dim, #3d4654)' }}>
                  {labelPt}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

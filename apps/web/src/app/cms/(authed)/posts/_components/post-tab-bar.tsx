'use client'

import { POST_TABS, type PostTab, type SectionStatus } from '@/lib/posts/types'
import { usePostEditor } from './post-editor-context'

interface PostTabBarProps {
  tabStatuses: Record<PostTab, SectionStatus>
  availableLocales: string[]
}

const DOT_COLORS: Record<SectionStatus, string> = {
  done: 'var(--gem-done, #22c55e)',
  warn: 'var(--gem-warn, #f59e0b)',
  empty: 'transparent',
}

export function PostTabBar({ tabStatuses, availableLocales }: PostTabBarProps) {
  const { state, dispatch } = usePostEditor()

  return (
    <div
      className="flex items-end justify-between"
      style={{ borderBottom: '1px solid var(--gem-border, #1a2030)' }}
    >
      <div className="flex overflow-x-auto" role="tablist" aria-label="Post sections" style={{ scrollbarWidth: 'none' }}>
        {POST_TABS.map(({ tab, labelPt }) => {
          const isActive = state.activeTab === tab
          const status = tabStatuses[tab]
          const isDirty = state.dirty[tab]

          return (
            <button
              key={tab}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab}`}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium whitespace-nowrap select-none transition-colors"
              style={{
                color: isActive ? 'var(--gem-text, #e2e8f0)' : 'var(--gem-dim, #3d4654)',
                borderBottom: isActive ? '2px solid var(--gem-accent, #818cf8)' : '2px solid transparent',
                cursor: 'pointer',
              }}
              onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab })}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  background: isDirty ? 'var(--gem-warn, #f59e0b)' : DOT_COLORS[status],
                  border: status === 'empty' && !isDirty ? '1px solid var(--gem-dim, #3d4654)' : 'none',
                }}
              />
              {labelPt}
            </button>
          )
        })}
      </div>

      {availableLocales.length > 1 && (
        <div className="flex mb-2 rounded overflow-hidden" style={{ border: '1px solid var(--gem-border, #1a2030)' }}>
          {availableLocales.map(locale => {
            const label = locale === 'pt-br' ? 'PT' : 'EN'
            const isActive = state.activeLocale === locale

            return (
              <button
                key={locale}
                className="px-2.5 py-0.5 text-[10px] font-bold tracking-wider transition-colors"
                style={{
                  background: isActive ? 'var(--gem-accent, #818cf8)' : 'transparent',
                  color: isActive ? 'white' : 'var(--gem-dim, #3d4654)',
                }}
                onClick={() => dispatch({ type: 'SET_LOCALE', locale })}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { memo, useRef, useCallback, type ReactNode } from 'react'
import { ListChecks, CalendarDays, Activity } from 'lucide-react'
import { gemMix } from '@/lib/pipeline/gem-design'

export type TabId = 'queue' | 'grid' | 'health'

interface TabDef {
  id: TabId
  label: string
  icon: typeof ListChecks
}

const TABS: TabDef[] = [
  { id: 'queue', label: 'Fila', icon: ListChecks },
  { id: 'grid', label: 'Grade', icon: CalendarDays },
  { id: 'health', label: 'Saúde', icon: Activity },
]

interface PipelineTabsProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  children: Record<TabId, ReactNode>
}

export const PipelineTabs = memo(function PipelineTabs({
  activeTab,
  onTabChange,
  children,
}: PipelineTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const idx = TABS.findIndex(t => t.id === activeTab)
    let next = idx
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else return
    e.preventDefault()
    onTabChange(TABS[next]!.id)
    tabRefs.current[next]?.focus()
  }, [activeTab, onTabChange])

  return (
    <div>
      <div
        role="tablist"
        aria-label="Seções do pipeline"
        className="flex gap-0.5 p-0.5 rounded-lg mb-4"
        style={{ background: gemMix('--gem-well', 60) }}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              id={tab.id}
              ref={(el) => { tabRefs.current[TABS.indexOf(tab)] = el }}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium min-h-[44px] motion-safe:transition-all focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none ${
                isActive ? 'shadow-sm' : 'hover:opacity-80'
              }`}
              style={{
                background: isActive ? 'var(--gem-surface)' : 'transparent',
                color: isActive ? 'var(--gem-text)' : 'var(--gem-dim)',
              }}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={handleKeyDown}
            >
              <Icon size={14} aria-hidden="true" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={activeTab}
      >
        {children[activeTab]}
      </div>
    </div>
  )
})

'use client'

import Link from 'next/link'

export type TabId = 'tree' | 'links' | 'analytics'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'tree', label: 'Linktree' },
  { id: 'links', label: 'Short links' },
  { id: 'analytics', label: 'Analytics' },
]

interface TabBarProps {
  activeTab: TabId
}

export function TabBar({ activeTab }: TabBarProps) {
  return (
    <div role="tablist" aria-label="Secoes de links" className="flex gap-0 border-b border-border">
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <Link
            key={tab.id}
            href={`/cms/links?tab=${tab.id}`}
            role="tab"
            aria-selected={isActive}
            className={[
              'relative px-4 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </Link>
        )
      })}
    </div>
  )
}

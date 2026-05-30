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
    <div role="tablist" aria-label="Secoes de links" className="flex border-b border-[var(--line)]" style={{ gap: 26 }}>
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <Link
            key={tab.id}
            href={`/cms/links?tab=${tab.id}`}
            role="tab"
            aria-selected={isActive}
            className="relative cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-inset"
            style={{
              padding: '0 1px 13px',
              fontSize: 14,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--ink)' : 'var(--ink-dim)',
            }}
          >
            {tab.label}
            {isActive && (
              <div
                className="absolute left-0 right-0"
                style={{ bottom: -1, height: 2, background: 'var(--accent)', borderRadius: 2 }}
              />
            )}
          </Link>
        )
      })}
    </div>
  )
}

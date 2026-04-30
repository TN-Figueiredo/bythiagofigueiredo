'use client'

import { type ReactNode, useCallback, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BarChart3, Kanban, CalendarDays, Workflow, Users, Plus, Settings, Bell } from 'lucide-react'
import Link from 'next/link'
import type { NewsletterHubSharedData, TabId } from './hub-types'
import { TypeFilterChips } from '../_shared/type-filter-chips'
import { useAutoRefresh } from './use-auto-refresh'
import { useHubShortcuts } from './use-hub-shortcuts'

const TABS: Array<{ id: TabId; icon: typeof BarChart3 }> = [
  { id: 'overview', icon: BarChart3 },
  { id: 'editorial', icon: Kanban },
  { id: 'schedule', icon: CalendarDays },
  { id: 'automations', icon: Workflow },
  { id: 'audience', icon: Users },
]

interface HubClientProps {
  sharedData: NewsletterHubSharedData
  defaultTab: TabId
  children: ReactNode
  tabLabels: Record<TabId, string>
  allTypesLabel: string
}

export function HubClient({ sharedData, defaultTab, children, tabLabels, allTypesLabel }: HubClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const activeTab = (searchParams.get('tab') as TabId) || defaultTab
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)

  const { refreshNow } = useAutoRefresh()

  const switchTab = useCallback((tab: TabId) => {
    startTransition(() => {
      router.push(`/cms/newsletters?tab=${tab}`, { scroll: false })
    })
  }, [router, startTransition])

  useHubShortcuts({
    onNewEdition: () => router.push('/cms/newsletters/new'),
    onSwitchTab: switchTab,
  })

  return (
    <div className="flex min-h-screen flex-col bg-[#030712]">
      {/* Header */}
      <div className="flex items-center justify-between px-7 pt-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-100">Newsletters</h1>
          <button onClick={refreshNow} className="flex items-center gap-1 text-[9px] text-gray-600 hover:text-gray-400">
            <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-green-500" />
            Updated just now
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/cms/newsletters/new"
            className="flex items-center gap-1 rounded-lg bg-indigo-500 px-3.5 py-[7px] text-[11px] font-semibold text-white hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            <Plus className="h-3.5 w-3.5" /> New Edition
          </Link>
          <Link href="/cms/newsletters/settings" aria-label="Newsletter settings" className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700 hover:text-gray-200">
            <Settings className="h-4 w-4" />
          </Link>
          <button aria-label="Notifications" className="relative flex h-8 w-8 items-center justify-center rounded-md border border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700 hover:text-gray-200">
            <Bell className="h-4 w-4" />
            {sharedData.tabBadges.automations > 0 && (
              <span className="absolute right-[5px] top-[5px] h-1.5 w-1.5 rounded-full border-[1.5px] border-[#030712] bg-red-500" />
            )}
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="mt-2 flex border-b border-gray-800 px-7" role="tablist" aria-label="Newsletter hub tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const badge = tab.id === 'editorial' ? sharedData.tabBadges.editorial : tab.id === 'automations' ? sharedData.tabBadges.automations : 0
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => switchTab(tab.id)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tabLabels[tab.id]}
              {badge > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${
                  tab.id === 'automations' ? 'bg-red-500/20 text-red-400' : 'bg-indigo-500/20 text-indigo-400'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Type Filter Chips */}
      <div className="px-7 pt-3">
        <TypeFilterChips
          types={sharedData.types}
          selectedTypeId={selectedTypeId}
          onSelect={setSelectedTypeId}
          allLabel={allTypesLabel}
        />
      </div>

      {/* Tab Content */}
      <div id={`tabpanel-${activeTab}`} role="tabpanel" className="flex-1 px-7 pt-4 pb-16">
        {children}
      </div>
    </div>
  )
}

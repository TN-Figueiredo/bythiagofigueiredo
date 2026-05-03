'use client'

import { type ReactNode, useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { BarChart3, Kanban, CalendarDays, Workflow, Users, Plus, Bell, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { NewsletterHubSharedData, TabId } from './hub-types'
import { TypeFilterChips } from '../_shared/type-filter-chips'
import { TypeDrawer } from '../_components/type-drawer'
import type { NewsletterHubStrings } from '../_i18n/types'
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
  editLabel: string
  locale: 'en' | 'pt-BR'
  drawerStrings: NewsletterHubStrings['typeDrawer']
  commonStrings?: NewsletterHubStrings['common']
  actionStrings?: NewsletterHubStrings['actions']
}

export function HubClient({ sharedData, defaultTab, children, tabLabels, allTypesLabel, editLabel, locale, drawerStrings, commonStrings, actionStrings }: HubClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const activeTab = (searchParams.get('tab') as TabId) || defaultTab
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [drawerTypeId, setDrawerTypeId] = useState<string | null>(null)
  const [creatingEdition, setCreatingEdition] = useState(false)

  const handleAddType = useCallback(() => {
    setDrawerMode('create')
    setDrawerTypeId(null)
    setDrawerOpen(true)
  }, [])

  const handleEditType = useCallback((typeId: string) => {
    setDrawerMode('edit')
    setDrawerTypeId(typeId)
    setDrawerOpen(true)
  }, [])

  const handleCloseDrawer = useCallback(() => setDrawerOpen(false), [])

  const existingBadges = useMemo(
    () => [...new Set(sharedData.types.map(t => t.badge).filter((b): b is string => !!b))],
    [sharedData.types],
  )

  const { refreshNow } = useAutoRefresh()

  const switchTab = useCallback((tab: TabId) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === 'overview') params.delete('tab')
      else params.set('tab', tab)
      if (selectedTypeId) params.set('type', selectedTypeId)
      else params.delete('type')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }, [router, pathname, searchParams, startTransition, selectedTypeId])

  const handleTypeSelect = useCallback((typeId: string | null) => {
    setSelectedTypeId(typeId)
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (typeId) params.set('type', typeId)
      else params.delete('type')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }, [router, pathname, searchParams, startTransition])

  useHubShortcuts({
    onNewEdition: () => router.push('/cms/newsletters/new'),
    onSwitchTab: switchTab,
  })

  return (
    <div className="flex min-h-screen flex-col bg-[#030712]">
      <div className="flex items-center justify-between px-4 pt-3 md:px-7">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-100">{commonStrings?.newsletters ?? 'Newsletters'}</h1>
          <button onClick={refreshNow} className="flex items-center gap-1 text-[9px] text-gray-600 hover:text-gray-400">
            <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-green-500" />
            <span aria-live="polite">{commonStrings?.updatedJustNow ?? 'Updated just now'}</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (creatingEdition) return
              setCreatingEdition(true)
              const href = selectedTypeId ? `/cms/newsletters/new?type=${selectedTypeId}` : '/cms/newsletters/new'
              router.push(href)
            }}
            disabled={creatingEdition}
            className="flex items-center gap-1 rounded-lg bg-indigo-500 px-3.5 py-[7px] text-[11px] font-semibold text-white hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:opacity-70"
          >
            {creatingEdition
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Plus className="h-3.5 w-3.5" />
            }
            {actionStrings?.newEdition ?? 'New Edition'}
          </button>
          <button aria-label="Notifications" className="relative flex h-8 w-8 items-center justify-center rounded-md border border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700 hover:text-gray-200">
            <Bell className="h-4 w-4" />
            {sharedData.tabBadges.automations > 0 && (
              <span className="absolute right-[5px] top-[5px] h-1.5 w-1.5 rounded-full border-[1.5px] border-[#030712] bg-red-500" />
            )}
          </button>
        </div>
      </div>

      <div className="mt-2 flex overflow-x-auto border-b border-gray-800 px-4 md:px-7" role="tablist" aria-label="Newsletter hub tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const badge = tab.id === 'editorial' ? sharedData.tabBadges.editorial : tab.id === 'automations' ? sharedData.tabBadges.automations : tab.id === 'schedule' ? sharedData.tabBadges.schedule : 0
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => switchTab(tab.id)}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tabLabels[tab.id]}
              {badge > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${
                  tab.id === 'automations' || tab.id === 'schedule' ? 'bg-red-500/20 text-red-400' : 'bg-indigo-500/20 text-indigo-400'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="px-4 pt-3 md:px-7">
        <TypeFilterChips
          types={sharedData.types}
          selectedTypeId={selectedTypeId}
          onSelect={handleTypeSelect}
          onAdd={handleAddType}
          onEdit={handleEditType}
          allLabel={allTypesLabel}
          editLabel={editLabel}
        />
      </div>

      <div id={`tabpanel-${activeTab}`} role="tabpanel" className="flex-1 px-4 pt-4 pb-16 md:px-7">
        {children}
      </div>
      <TypeDrawer
        open={drawerOpen}
        mode={drawerMode}
        typeId={drawerTypeId}
        onClose={handleCloseDrawer}
        locale={locale}
        strings={drawerStrings}
        existingBadges={existingBadges}
      />
    </div>
  )
}

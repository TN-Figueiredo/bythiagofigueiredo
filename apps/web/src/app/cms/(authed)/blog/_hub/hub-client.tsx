'use client'

import { type ReactNode, useCallback, useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { BarChart3, Kanban, CalendarDays, TrendingUp, Plus, Bell, Loader2 } from 'lucide-react'
import type { BlogHubSharedData, BlogTabId } from './hub-types'
import { TagFilterChips } from '../_shared/tag-filter-chips'
import { LocaleFilterChips } from '../_shared/locale-filter-chips'
import { TagDrawer } from '../_components/tag-drawer'
import type { BlogHubStrings } from '../_i18n/types'
import { useAutoRefresh } from './use-auto-refresh'
import { useHubShortcuts } from './use-hub-shortcuts'

const TABS: Array<{ id: BlogTabId; icon: typeof BarChart3 }> = [
  { id: 'overview', icon: BarChart3 },
  { id: 'editorial', icon: Kanban },
  { id: 'schedule', icon: CalendarDays },
  { id: 'analytics', icon: TrendingUp },
]

interface HubClientProps {
  sharedData: BlogHubSharedData
  defaultTab: BlogTabId
  children: ReactNode
  tabLabels: Record<BlogTabId, string>
  allTagsLabel: string
  allLocalesLabel: string
  editLabel: string
  locale: 'en' | 'pt-BR'
  drawerStrings: BlogHubStrings['tagDrawer']
  commonStrings?: BlogHubStrings['common']
  actionStrings?: BlogHubStrings['actions']
}

export function HubClient({
  sharedData,
  defaultTab,
  children,
  tabLabels,
  allTagsLabel,
  allLocalesLabel,
  editLabel,
  locale,
  drawerStrings,
  commonStrings,
  actionStrings,
}: HubClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const activeTab = (searchParams.get('tab') as BlogTabId) || defaultTab
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [selectedLocale, setSelectedLocale] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [drawerTagId, setDrawerTagId] = useState<string | null>(null)
  const [creatingPost, setCreatingPost] = useState(false)

  const handleAddTag = useCallback(() => {
    setDrawerMode('create')
    setDrawerTagId(null)
    setDrawerOpen(true)
  }, [])

  const handleEditTag = useCallback((tagId: string) => {
    setDrawerMode('edit')
    setDrawerTagId(tagId)
    setDrawerOpen(true)
  }, [])

  const handleCloseDrawer = useCallback(() => setDrawerOpen(false), [])

  const { refreshNow } = useAutoRefresh()

  const switchTab = useCallback(
    (tab: BlogTabId) => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (tab === 'overview') params.delete('tab')
        else params.set('tab', tab)
        if (selectedTagId) params.set('tag', selectedTagId)
        else params.delete('tag')
        if (selectedLocale) params.set('locale', selectedLocale)
        else params.delete('locale')
        const qs = params.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [router, pathname, searchParams, startTransition, selectedTagId, selectedLocale],
  )

  const handleTagSelect = useCallback(
    (tagId: string | null) => {
      setSelectedTagId(tagId)
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (tagId) params.set('tag', tagId)
        else params.delete('tag')
        const qs = params.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [router, pathname, searchParams, startTransition],
  )

  const handleLocaleSelect = useCallback(
    (loc: string | null) => {
      setSelectedLocale(loc)
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (loc) params.set('locale', loc)
        else params.delete('locale')
        const qs = params.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [router, pathname, searchParams, startTransition],
  )

  useHubShortcuts({
    onNewPost: () => router.push('/cms/blog/new'),
    onSwitchTab: switchTab,
  })

  const newPostHref = (() => {
    const params = new URLSearchParams()
    if (selectedTagId) params.set('tag', selectedTagId)
    if (selectedLocale) params.set('locale', selectedLocale)
    const qs = params.toString()
    return qs ? `/cms/blog/new?${qs}` : '/cms/blog/new'
  })()

  return (
    <div className="flex min-h-screen flex-col bg-[#030712]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 md:px-7">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-100">{commonStrings?.posts ?? 'Blog'}</h1>
          <button
            onClick={refreshNow}
            className="flex items-center gap-1 text-[9px] text-gray-600 hover:text-gray-400"
          >
            <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-green-500" />
            <span aria-live="polite">{commonStrings?.updatedJustNow ?? 'Updated just now'}</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (creatingPost) return
              setCreatingPost(true)
              router.push(newPostHref)
            }}
            disabled={creatingPost}
            className="flex items-center gap-1 rounded-lg bg-indigo-500 px-3.5 py-[7px] text-[11px] font-semibold text-white hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:opacity-70"
          >
            {creatingPost ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {actionStrings?.newPost ?? 'New Post'}
          </button>
          <button
            aria-label="Notifications"
            className="relative flex h-8 w-8 items-center justify-center rounded-md border border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700 hover:text-gray-200"
          >
            <Bell className="h-4 w-4" />
            {sharedData.tabBadges.editorial > 0 && (
              <span className="absolute right-[5px] top-[5px] h-1.5 w-1.5 rounded-full border-[1.5px] border-[#030712] bg-red-500" />
            )}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="mt-2 flex overflow-x-auto border-b border-gray-800 px-4 md:px-7"
        role="tablist"
        aria-label="Blog hub tabs"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const badge = tab.id === 'editorial' ? sharedData.tabBadges.editorial : 0
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => switchTab(tab.id)}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tabLabels[tab.id]}
              {badge > 0 && (
                <span className="ml-1 rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[8px] font-semibold text-indigo-400">
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-4 pt-3 md:px-7">
        <TagFilterChips
          tags={sharedData.tags}
          selectedTagId={selectedTagId}
          onSelect={handleTagSelect}
          onAdd={handleAddTag}
          onEdit={handleEditTag}
          allLabel={allTagsLabel}
          editLabel={editLabel}
        />
        {sharedData.supportedLocales.length > 1 && (
          <LocaleFilterChips
            locales={sharedData.supportedLocales}
            selectedLocale={selectedLocale}
            onSelect={handleLocaleSelect}
            allLabel={allLocalesLabel}
          />
        )}
      </div>

      {/* Tab panel */}
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        className="flex-1 px-4 pt-4 pb-16 md:px-7"
      >
        {children}
      </div>

      <TagDrawer
        open={drawerOpen}
        mode={drawerMode}
        tagId={drawerTagId}
        tags={sharedData.tags}
        usedColors={sharedData.tags.map((t) => ({ color: t.color, entityName: t.name }))}
        onClose={handleCloseDrawer}
        locale={locale}
        strings={drawerStrings}
      />
    </div>
  )
}

'use client'

import { useCallback, useDeferredValue, useMemo, useState, useTransition } from 'react'
import { Kanban, Plus } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import type { EditorialTabData, PostCard } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { VelocityStrip } from './velocity-strip'
import { KanbanBoard } from './kanban-board'
import { EmptyState } from '../../_shared/empty-state'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'
import { movePost, deleteHubPost, reassignTag, addLocale, duplicatePost, createPost } from '../../actions'

interface EditorialTabProps {
  data: EditorialTabData
  strings?: BlogHubStrings
  siteId?: string
  tagId?: string | null
  locale?: string | null
  supportedLocales?: string[]
}

export function EditorialTab({ data, strings, tagId, locale, supportedLocales }: EditorialTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const deferredQuery = useDeferredValue(searchQuery)
  const [, startTransition] = useTransition()
  const [optimisticIdeas, setOptimisticIdeas] = useState<PostCard[]>([])
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set())

  // Merge server posts with optimistic ideas (filter out any that the server already returned)
  const serverIds = new Set(data.posts.map((p) => p.id))
  const pendingIdeas = optimisticIdeas.filter((o) => !serverIds.has(o.id))
  const allPosts = [...pendingIdeas, ...data.posts]

  const tagFiltered = tagId
    ? allPosts.filter((p) => p.tagId === tagId)
    : allPosts

  const localeFiltered = locale
    ? tagFiltered.filter((p) => p.locales.includes(locale))
    : tagFiltered

  const filtered = deferredQuery
    ? localeFiltered.filter((p) =>
        p.title.toLowerCase().includes(deferredQuery.toLowerCase()),
      )
    : localeFiltered

  const newPostHref = useMemo(() => {
    const params = new URLSearchParams()
    if (tagId) params.set('tag', tagId)
    if (locale) params.set('locale', locale)
    const qs = params.toString()
    return qs ? `/cms/blog/new?${qs}` : '/cms/blog/new'
  }, [tagId, locale])

  const handleMovePost = async (postId: string, newStatus: string, scheduledFor?: string) => {
    startTransition(async () => {
      const result = await movePost(postId, newStatus, scheduledFor)
      if (!result.ok) {
        toast.error(strings?.common.couldntMove ?? "Couldn't move")
      }
    })
  }

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm(strings?.editorial.confirmDelete ?? 'Are you sure you want to delete this post?')) return
    startTransition(async () => {
      const result = await deleteHubPost(postId)
      if (result.ok) {
        toast.success(strings?.editorial.deleted ?? 'Deleted')
      } else {
        toast.error(strings?.editorial.deleteFailed ?? "Couldn't delete")
      }
    })
  }

  const handleReassignTag = async (postId: string, newTagId: string | null) => {
    startTransition(async () => {
      const result = await reassignTag(postId, newTagId)
      if (result.ok) {
        toast.success(strings?.editorial.reassigned ?? 'Tag changed')
      } else {
        toast.error(strings?.common.couldntMove ?? "Couldn't update")
      }
    })
  }

  const handleAddLocale = async (postId: string, loc: string) => {
    startTransition(async () => {
      await addLocale(postId, loc)
    })
  }

  const handleDuplicate = async (postId: string) => {
    startTransition(async () => {
      await duplicatePost(postId)
    })
  }

  const handleQuickAdd = useCallback(async (title: string) => {
    const tempId = `optimistic-${crypto.randomUUID()}`
    const now = new Date().toISOString()
    const optimisticCard: PostCard = {
      id: tempId,
      displayId: 'NEW',
      title,
      status: 'idea',
      tagId: tagId ?? null,
      tagName: null,
      tagColor: null,
      locales: [locale ?? 'en'],
      readingTimeMin: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      scheduledFor: null,
      slotDate: null,
      snippet: null,
    }

    // Insert optimistic card immediately
    setOptimisticIdeas((prev) => [optimisticCard, ...prev])

    try {
      const result = await createPost({
        title,
        locale: locale ?? 'en',
        tagId: tagId ?? null,
        status: 'idea',
      })

      if (result.ok) {
        // Remove the optimistic card (server revalidation will bring the real one)
        setOptimisticIdeas((prev) => prev.filter((c) => c.id !== tempId))
        // Mark the real postId as recently confirmed for the green flash
        setConfirmedIds((prev) => new Set(prev).add(result.postId))
        setTimeout(() => {
          setConfirmedIds((prev) => {
            const next = new Set(prev)
            next.delete(result.postId)
            return next
          })
        }, 1500)
        toast.success(strings?.editorial.ideaCreated ?? 'Idea created')
      } else {
        // Remove optimistic card on server error
        setOptimisticIdeas((prev) => prev.filter((c) => c.id !== tempId))
        toast.error(strings?.editorial.ideaFailed ?? "Couldn't create idea")
      }
    } catch {
      // Remove optimistic card on network/unexpected error
      setOptimisticIdeas((prev) => prev.filter((c) => c.id !== tempId))
      toast.error(strings?.editorial.ideaFailed ?? "Couldn't create idea")
    }
  }, [locale, tagId, strings])

  if (data.posts.length === 0) {
    return (
      <EmptyState
        icon={<Kanban className="h-8 w-8" />}
        heading={strings?.empty.startWriting ?? 'Start writing your first post'}
        description={strings?.empty.addIdea ?? 'Add your first idea to get started'}
        action={
          <Link
            href={newPostHref}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600"
          >
            <Plus className="mr-1 inline h-3.5 w-3.5" />
            {strings?.actions.newPost ?? 'New Post'}
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionErrorBoundary sectionName="Velocity metrics">
        <VelocityStrip velocity={data.velocity} strings={strings} />
      </SectionErrorBoundary>

      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder={strings?.editorial.searchPosts ?? 'Search posts…'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={strings?.editorial.searchPosts ?? 'Search posts'}
          className="w-64 rounded-md border border-gray-800 bg-gray-900 px-3 py-1.5 text-[11px] text-gray-300 placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <SectionErrorBoundary sectionName="Kanban board">
        <KanbanBoard
          posts={filtered}
          confirmedIds={confirmedIds}
          onMovePost={handleMovePost}
          onDeletePost={handleDeletePost}
          onReassignTag={handleReassignTag}
          onAddLocale={handleAddLocale}
          onDuplicate={handleDuplicate}
          onQuickAdd={handleQuickAdd}
          strings={strings}
          supportedLocales={supportedLocales}
        />
      </SectionErrorBoundary>
    </div>
  )
}

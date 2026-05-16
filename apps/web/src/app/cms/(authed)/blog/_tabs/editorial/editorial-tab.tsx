'use client'

import { useCallback, useDeferredValue, useMemo, useRef, useState, useTransition } from 'react'
import { Kanban, Plus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { EditorialTabData, BlogTag, PipelineCardItem } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { UnifiedBoard } from './unified-board'
import { EmptyState } from '../../_shared/empty-state'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'
import { ConfirmDialog } from './confirm-dialog'
import { movePost, deleteHubPost, duplicatePost, createPostFromPipeline, returnToPipeline, bulkPublish, bulkArchive, bulkDelete } from '../../actions'
import { movePipelineItemToStage } from '../../../pipeline/actions'

interface EditorialTabProps {
  data: EditorialTabData
  pipelineData: PipelineCardItem[]
  strings?: BlogHubStrings
  siteId: string
  tagId?: string | null
  locale?: string | null
  supportedLocales?: string[]
  siteTimezone?: string
  tags?: BlogTag[]
  defaultLocale?: string
}

export function EditorialTab({
  data,
  pipelineData = [],
  strings,
  siteId,
  tagId,
  locale,
  supportedLocales = [],
  siteTimezone = 'America/Sao_Paulo',
  tags,
  defaultLocale = 'pt-BR',
}: EditorialTabProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const deferredQuery = useDeferredValue(searchQuery)
  const [, startTransition] = useTransition()
  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null)
  const deleteTriggerRef = useRef<string | null>(null)

  const tagFiltered = tagId
    ? data.posts.filter((p) => p.tagId === tagId)
    : data.posts

  const localeFiltered = locale
    ? tagFiltered.filter((p) => p.locales.includes(locale))
    : tagFiltered

  const filteredPosts = deferredQuery
    ? localeFiltered.filter((p) =>
        p.title.toLowerCase().includes(deferredQuery.toLowerCase()),
      )
    : localeFiltered

  const filteredPipeline = deferredQuery
    ? pipelineData.filter((p) => {
        const q = deferredQuery.toLowerCase()
        return (
          (p.title_pt?.toLowerCase().includes(q) ?? false) ||
          (p.title_en?.toLowerCase().includes(q) ?? false) ||
          p.code.toLowerCase().includes(q)
        )
      })
    : pipelineData

  const pipelineProvenanceMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of pipelineData) {
      if (item.blog_post_id) {
        map.set(item.blog_post_id, item.code)
      }
    }
    return map
  }, [pipelineData])

  const handleMovePost = useCallback(
    async (postId: string, newStatus: string, scheduledFor?: string) => {
      const previousStatus = data.posts.find((p) => p.id === postId)?.status
      startTransition(async () => {
        const result = await movePost(postId, newStatus, scheduledFor)
        if (result.ok) {
          router.refresh()
          toast.success(strings?.common?.moved ?? 'Moved', {
            action: previousStatus
              ? {
                  label: strings?.common?.undo ?? 'Undo',
                  onClick: () => {
                    startTransition(async () => {
                      const revert = await movePost(postId, previousStatus)
                      if (revert.ok) {
                        router.refresh()
                      } else {
                        toast.error(strings?.common?.couldntMove ?? "Couldn't move")
                        router.refresh()
                      }
                    })
                  },
                }
              : undefined,
          })
        } else {
          toast.error(strings?.common?.couldntMove ?? "Couldn't move")
          router.refresh()
        }
      })
    },
    [data.posts, router, startTransition, strings],
  )

  const handleDeletePost = useCallback(
    (postId: string) => {
      deleteTriggerRef.current = postId
      setDeleteConfirmPostId(postId)
    },
    [],
  )

  const handleDeleteConfirm = useCallback(() => {
    const postId = deleteTriggerRef.current
    setDeleteConfirmPostId(null)
    if (!postId) return
    startTransition(async () => {
      const result = await deleteHubPost(postId)
      if (result.ok) {
        toast.success(strings?.editorial?.deleted ?? 'Deleted')
        router.refresh()
      } else {
        toast.error(strings?.editorial?.deleteFailed ?? "Couldn't delete")
      }
    })
  }, [router, startTransition, strings])

  const handleDeleteCancel = useCallback(() => {
    deleteTriggerRef.current = null
    setDeleteConfirmPostId(null)
  }, [])

  const handleDuplicate = useCallback(
    async (postId: string) => {
      startTransition(async () => {
        const result = await duplicatePost(postId)
        if (result?.ok) {
          toast.success(strings?.editorial?.duplicate ?? 'Duplicated')
          router.refresh()
        } else {
          toast.error(strings?.common?.couldntMove ?? "Couldn't duplicate")
        }
      })
    },
    [router, startTransition, strings],
  )

  const handleMovePipelineItem = useCallback(
    async (id: string, version: number, stage: string) => {
      startTransition(async () => {
        const result = await movePipelineItemToStage(id, version, stage)
        if (!result.ok) {
          toast.error(strings?.common?.couldntMove ?? "Couldn't move")
          router.refresh()
        } else {
          router.refresh()
        }
      })
    },
    [router, startTransition, strings],
  )

  const handlePromote = useCallback(
    async (
      sid: string,
      pipelineItemId: string,
      loc: string,
      scheduledFor?: string,
    ): Promise<{ ok: boolean; postId?: string }> => {
      const result = await createPostFromPipeline(sid, pipelineItemId, loc, scheduledFor)
      if (result.ok) {
        router.refresh()
      }
      return result
    },
    [router],
  )

  const handleReturnToPipeline = useCallback(
    async (postId: string) => {
      const result = await returnToPipeline(postId)
      if (result.ok) {
        router.refresh()
      } else {
        throw new Error(result.error ?? 'return_to_pipeline_failed')
      }
    },
    [router],
  )

  const handleBulkPublish = useCallback(
    async (postIds: string[]) => {
      startTransition(async () => {
        const result = await bulkPublish(postIds)
        if (result.ok) {
          const tpl = strings?.bulk?.bulkPublished ?? '{count} published'
          toast.success(tpl.replace('{count}', String(result.count)))
          router.refresh()
        } else {
          toast.error(strings?.common?.couldntMove ?? "Couldn't publish")
        }
      })
    },
    [router, startTransition, strings],
  )

  const handleBulkArchive = useCallback(
    async (postIds: string[]) => {
      startTransition(async () => {
        const result = await bulkArchive(postIds)
        if (result.ok) {
          const tpl = strings?.bulk?.bulkArchived ?? '{count} archived'
          toast.success(tpl.replace('{count}', String(result.count)))
          router.refresh()
        } else {
          toast.error(strings?.common?.couldntMove ?? "Couldn't archive")
        }
      })
    },
    [router, startTransition, strings],
  )

  const handleBulkDelete = useCallback(
    async (postIds: string[]) => {
      startTransition(async () => {
        const result = await bulkDelete(postIds)
        if (result.ok) {
          const tpl = strings?.bulk?.bulkDeleted ?? '{count} deleted'
          toast.success(tpl.replace('{count}', String(result.count)))
          router.refresh()
        } else {
          toast.error(strings?.common?.couldntMove ?? "Couldn't delete")
        }
      })
    },
    [router, startTransition, strings],
  )

  if (data.posts.length === 0 && pipelineData.length === 0) {
    return (
      <EmptyState
        icon={<Kanban className="h-8 w-8" />}
        heading={strings?.empty?.noPosts ?? 'No posts ready'}
        description={strings?.empty?.startWriting ?? 'When posts are ready in the Pipeline, they will appear here'}
        action={
          <Link
            href="/cms/blog"
            className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600"
          >
            <Plus className="mr-1 inline h-3.5 w-3.5" />
            {strings?.actions?.newIdea ?? 'Go to Pipeline'}
          </Link>
        }
      />
    )
  }

  const totalItems = data.velocity.totalPosts + pipelineData.length

  const hasNoFilterResults =
    filteredPosts.length === 0 &&
    filteredPipeline.length === 0 &&
    (data.posts.length > 0 || pipelineData.length > 0)

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Key metrics" className="flex flex-wrap items-center gap-y-1 rounded-lg border border-indigo-500/8 bg-indigo-500/3 px-3 py-2">
        <div className="flex items-center gap-1 border-r border-gray-800 px-2.5">
          <span className="text-[9px] text-gray-500">{strings?.editorial?.kpiTotal ?? 'Total'}</span>
          <span className="text-[11px] font-semibold text-gray-300">{totalItems}</span>
        </div>
        <div className="flex items-center gap-1 border-r border-gray-800 px-2.5">
          <span className="text-[9px] text-gray-500">{strings?.pipeline?.inPipeline ?? 'Pipeline'}</span>
          <span className="text-[11px] font-semibold text-amber-400">{pipelineData.length}</span>
        </div>
        <div className="flex items-center gap-1 border-r border-gray-800 px-2.5">
          <span className="text-[9px] text-gray-500">{strings?.editorial?.kpiPublished ?? 'Published'}</span>
          <span className="text-[11px] font-semibold text-gray-300">{data.velocity.publishedCount}</span>
        </div>
        <div className="flex items-center gap-1 border-r border-gray-800 px-2.5">
          <span className="text-[9px] text-gray-500">{strings?.editorial?.kpiThroughput ?? 'Throughput'}</span>
          <span className="text-[11px] font-semibold text-gray-300">{data.velocity.throughput}{strings?.editorial?.kpiThroughputUnit ?? '/mo'}</span>
        </div>
        <div className="flex items-center gap-1 border-r border-gray-800 px-2.5">
          <span className="text-[9px] text-gray-500">{strings?.editorial?.kpiIdeaToPub ?? 'Idea→Pub'}</span>
          <span className="text-[11px] font-semibold text-gray-300">
            {data.velocity.avgIdeaToPublished > 0 ? `${data.velocity.avgIdeaToPublished}d` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-1 px-2.5">
          <span className="text-[9px] text-gray-500">{strings?.editorial?.kpiBottleneck ?? 'Bottleneck'}</span>
          <span className="text-[11px] font-semibold text-gray-400">
            {data.velocity.bottleneck?.column ?? (strings?.editorial?.kpiNone ?? 'None')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder={strings?.editorial?.searchPosts ?? 'Search posts…'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={strings?.editorial?.searchPosts ?? 'Search posts'}
          className="w-64 rounded-md border border-gray-800 bg-gray-900 px-3 py-1.5 text-[11px] text-gray-300 placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {hasNoFilterResults && (
        <p className="text-center text-[11px] text-gray-600 py-4">
          {strings?.empty?.noData ?? 'No items found with current filters'}
        </p>
      )}

      <SectionErrorBoundary sectionName="Unified board">
        <UnifiedBoard
          pipelineItems={filteredPipeline}
          posts={filteredPosts}
          strings={strings}
          tags={tags}
          supportedLocales={supportedLocales}
          defaultLocale={defaultLocale}
          siteTimezone={siteTimezone}
          siteId={siteId}
          onMovePipelineItem={handleMovePipelineItem}
          onMovePost={handleMovePost}
          onDeletePost={handleDeletePost}
          onDuplicate={handleDuplicate}
          onPromote={handlePromote}
          onReturnToPipeline={handleReturnToPipeline}
          onBulkPublish={handleBulkPublish}
          onBulkArchive={handleBulkArchive}
          onBulkDelete={handleBulkDelete}
          pipelineProvenanceMap={pipelineProvenanceMap}
        />
      </SectionErrorBoundary>

      {deleteConfirmPostId !== null && (
        <ConfirmDialog
          title={strings?.deletePost?.dialogTitle ?? 'Delete post?'}
          message={strings?.editorial?.confirmDelete ?? 'Are you sure you want to delete this post?'}
          confirmLabel={strings?.confirmDialog?.confirmDelete ?? 'Delete'}
          cancelLabel={strings?.confirmDialog?.cancel ?? 'Cancel'}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          variant="danger"
        />
      )}
    </div>
  )
}

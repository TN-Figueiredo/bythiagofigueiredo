'use client'

import { useCallback, useDeferredValue, useState, useTransition } from 'react'
import { Kanban, Plus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { EditorialTabData, BlogTag, PipelineCardItem } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { UnifiedBoard } from './unified-board'
import { EmptyState } from '../../_shared/empty-state'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'
import { AutoShareDialog } from '../../../_shared/social/auto-share-dialog'
import { createPostFromPipeline, bulkPublish, bulkArchive, bulkDelete } from '../../actions'
import { movePipelineItemToStage } from '../../../pipeline/actions'
import type { Provider } from '@tn-figueiredo/social'

interface AutoShareState {
  postId: string
  title: string
  excerpt: string | null
  coverImage: string | null
}

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
  connectedPlatforms?: Provider[]
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
  connectedPlatforms = [],
}: EditorialTabProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const deferredQuery = useDeferredValue(searchQuery)
  const [, startTransition] = useTransition()
  const [autoShareState, setAutoShareState] = useState<AutoShareState | null>(null)

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

  const handleMovePipelineItem = useCallback(
    async (id: string, version: number, stage: string): Promise<boolean> => {
      const result = await movePipelineItemToStage(id, version, stage)
      startTransition(() => {
        router.refresh()
      })
      if (!result.ok) {
        return false
      }
      return true
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
          strings={strings}
          supportedLocales={supportedLocales}
          defaultLocale={defaultLocale}
          siteTimezone={siteTimezone}
          siteId={siteId}
          onMovePipelineItem={handleMovePipelineItem}
          onPromote={handlePromote}
          onBulkPublish={handleBulkPublish}
          onBulkArchive={handleBulkArchive}
          onBulkDelete={handleBulkDelete}
        />
      </SectionErrorBoundary>

      {autoShareState && (
        <AutoShareDialog
          open
          onClose={() => setAutoShareState(null)}
          contentType="blog"
          contentId={autoShareState.postId}
          contentTitle={autoShareState.title}
          contentUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/blog`}
          contentExcerpt={autoShareState.excerpt}
          contentImage={autoShareState.coverImage}
          availablePlatforms={connectedPlatforms}
          defaultPlatforms={connectedPlatforms}
          onShareNow={async (payload) => {
            setAutoShareState(null)
            try {
              const { createFromContentAction } = await import('@/lib/social/actions/content')
              const result = await createFromContentAction({
                contentType: 'blog',
                contentId: autoShareState.postId,
                config: {
                  enabled: true,
                  platforms: payload.platforms,
                  captions: Object.fromEntries(
                    payload.platforms.map((p) => [p, { default: payload.caption }]),
                  ),
                  hashtags: [],
                  image_source: 'cover_image',
                  ig_template: 'minimal',
                  formats: {},
                },
                origin: 'publish_modal',
              })
              if (result.ok) {
                const platformNames = payload.platforms
                  .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                  .join(', ')
                toast.success(`Shared to ${platformNames}`)
              } else {
                toast.error(result.error)
              }
            } catch {
              toast.error('Failed to create social post')
            }
          }}
          onCustomize={() => {
            const postId = autoShareState.postId
            setAutoShareState(null)
            router.push(`/cms/social/new?source=blog&id=${postId}`)
          }}
          strings={{
            autoShare: {
              title: defaultLocale === 'pt-BR' ? 'Compartilhar nas redes' : 'Share to Social',
              shareNow: defaultLocale === 'pt-BR' ? 'Compartilhar' : 'Share Now',
              customize: defaultLocale === 'pt-BR' ? 'Personalizar no Composer' : 'Customize in Composer',
              skip: defaultLocale === 'pt-BR' ? 'Pular' : 'Skip',
              captionLabel: defaultLocale === 'pt-BR' ? 'Legenda' : 'Caption preview',
              undoToast: defaultLocale === 'pt-BR' ? 'Compartilhado em {platforms}' : 'Shared to {platforms}',
              undoAction: defaultLocale === 'pt-BR' ? 'Desfazer' : 'Undo',
            },
          }}
        />
      )}
    </div>
  )
}

'use client'

import { useCallback, useDeferredValue, useMemo, useState, useTransition } from 'react'
import { Kanban, Plus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { EditorialTabData, PipelineCardItem } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { UnifiedBoard } from './unified-board'
import { EmptyState } from '../../_shared/empty-state'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'
import { AutoShareDialog } from '../../../_shared/social/auto-share-dialog'
import { createPostFromPipeline, bulkPublish, bulkArchive, bulkDelete } from '../../actions'
import { reorderPipelineItem } from '../../../pipeline/actions'
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
  locale?: string | null
  supportedLocales?: string[]
  siteTimezone?: string
  defaultLocale?: string
  connectedPlatforms?: Provider[]
}

export function EditorialTab({
  data,
  pipelineData = [],
  strings,
  siteId,
  locale,
  supportedLocales = [],
  siteTimezone = 'America/Sao_Paulo',
  defaultLocale = 'pt-BR',
  connectedPlatforms = [],
}: EditorialTabProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const deferredQuery = useDeferredValue(searchQuery)
  const [, startTransition] = useTransition()
  const [autoShareState, setAutoShareState] = useState<AutoShareState | null>(null)

  // Memoized so the reference stays stable across unrelated re-renders — the board
  // keeps a local drag copy that resyncs whenever this prop changes by reference.
  const filteredPipeline = useMemo(() => {
    const localeFiltered = locale
      ? pipelineData.filter((p) => {
          if (locale === 'pt-BR' || locale === 'pt') return !!p.title_pt
          if (locale === 'en') return !!p.title_en
          return p.language === locale
        })
      : pipelineData

    if (!deferredQuery) return localeFiltered
    const q = deferredQuery.toLowerCase()
    return localeFiltered.filter(
      (p) =>
        (p.title_pt?.toLowerCase().includes(q) ?? false) ||
        (p.title_en?.toLowerCase().includes(q) ?? false) ||
        p.code.toLowerCase().includes(q) ||
        (p.hook?.toLowerCase().includes(q) ?? false),
    )
  }, [pipelineData, locale, deferredQuery])

  // Single entry point for DnD persistence: both cross-lane stage moves and
  // within-lane reordering go through reorderPipelineItem (stage + sort_order).
  // The board reconciles version/order from the result — no router.refresh needed.
  const handleReorderPipelineItem = useCallback(
    (id: string, version: number, input: { stage?: string; sort_order: number }) =>
      reorderPipelineItem(id, version, input),
    [],
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
            href="/cms/pipeline/blog_post"
            className="rounded-lg bg-[#ff8240] px-4 py-2 text-xs font-semibold text-white hover:bg-[#ff9550]"
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
    filteredPipeline.length === 0 && pipelineData.length > 0

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
          <div className="text-2xl font-extrabold tabular-nums text-[#e8e6e3]">{totalItems}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-[#8a8782]">{strings?.editorial?.kpiTotal ?? 'Total'}</div>
        </div>
        <div className="rounded-xl border border-[rgba(255,130,64,0.25)] bg-[rgba(255,130,64,0.06)] px-4 py-3">
          <div className="text-2xl font-extrabold tabular-nums text-[#ff8240]">{pipelineData.length}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-[rgba(255,130,64,0.65)]">{strings?.pipeline?.inPipeline ?? 'Pipeline'}</div>
        </div>
        <div className="rounded-xl border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.05)] px-4 py-3">
          <div className="text-2xl font-extrabold tabular-nums text-[#22c55e]">{data.velocity.publishedCount}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-[rgba(34,197,94,0.6)]">{strings?.editorial?.kpiPublished ?? 'Published'}</div>
        </div>
        <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
          <div className="text-2xl font-extrabold tabular-nums text-[#e8e6e3]">
            {data.velocity.throughput}<span className="text-sm font-semibold text-[#8a8782]">{strings?.editorial?.kpiThroughputUnit ?? '/mo'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[#8a8782]">{strings?.editorial?.kpiThroughput ?? 'Throughput'}</span>
            {data.velocity.avgIdeaToPublished > 0 && (
              <span className="text-[10px] tabular-nums text-[#6b6863]" title="Average days from idea creation to publication">
                · {data.velocity.avgIdeaToPublished}d avg
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder={strings?.editorial?.searchPosts ?? 'Search posts…'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={strings?.editorial?.searchPosts ?? 'Search posts'}
          className="w-72 rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-3.5 py-2 text-xs text-gray-300 placeholder-gray-600 focus:border-[#ff8240] focus:outline-none focus:ring-1 focus:ring-[rgba(255,130,64,0.3)]"
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
          onReorderPipelineItem={handleReorderPipelineItem}
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

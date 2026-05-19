import { notFound } from 'next/navigation'
import Link from 'next/link'
import { z } from 'zod'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { saveStoryDraft, publishStoryNow, scheduleStory } from '@/lib/social/actions/story-publish'
import { getStoryInsights } from '@/lib/social/actions/story-metrics'
import { StoryPreview } from '../_components/story-preview'
import { StoryInsightsPanel } from '../_components/story-insights'
import { HighlightsTip } from '../_components/highlights-tip'
import { PublishDialogClient } from './_components/publish-dialog-client'
import type { CardComposition } from '@tn-figueiredo/links/qr'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function StoryDetailPage({ params }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })

  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('social_posts')
    .select(
      'id, story_slides, status, scheduled_at, published_at, source_content_type, source_content_id, created_at, site_id, content',
    )
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .not('story_slides', 'is', null)
    .single()

  if (error || !data) notFound()

  const post = data as {
    id: string
    story_slides: CardComposition[]
    status: string
    scheduled_at: string | null
    published_at: string | null
    source_content_type: string | null
    source_content_id: string | null
    created_at: string
    site_id: string
    content: Record<string, unknown>
  }

  const slides = (post.story_slides ?? []) as CardComposition[]
  const mediaUrls = (post.content?.media_urls as string[] | undefined) ?? undefined
  const caption = (post.content?.description as string | undefined) ?? undefined
  const isCompleted = post.status === 'completed'
  const isDraft = post.status === 'draft'

  const statusLabels: Record<string, string> = {
    draft: 'Rascunho',
    scheduled: 'Agendado',
    publishing: 'Publicando',
    completed: 'Publicado',
    failed: 'Erro',
    cancelled: 'Cancelado',
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '-'
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleSaveDraft = async (
    slides: unknown[],
    content?: { caption?: string },
  ) => {
    'use server'
    return saveStoryDraft(ctx.siteId, post.id, slides, content)
  }

  const handlePublishNow = async (
    slides: unknown[],
    content?: { caption?: string },
  ) => {
    'use server'
    return publishStoryNow(ctx.siteId, post.id, slides, content)
  }

  const handleSchedule = async (
    slides: unknown[],
    scheduledAt: string,
    content?: { caption?: string },
  ) => {
    'use server'
    return scheduleStory(ctx.siteId, post.id, slides, scheduledAt, content)
  }

  return (
    <>
      <CmsTopbar title="Detalhes da Story" />
      <div className="p-6 space-y-6 max-w-4xl">
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-cms-text">
              {post.source_content_type
                ? `Story — ${post.source_content_type}`
                : 'Story manual'}
            </h1>
            <p className="text-sm text-cms-text-muted">
              <span className="font-medium">Status:</span>{' '}
              {statusLabels[post.status] ?? post.status}
            </p>
            {post.published_at && (
              <p className="text-sm text-cms-text-muted">
                <span className="font-medium">Publicado em:</span>{' '}
                {formatDate(post.published_at)}
              </p>
            )}
            {post.scheduled_at && post.status === 'scheduled' && (
              <p className="text-sm text-cms-text-muted">
                <span className="font-medium">Agendado para:</span>{' '}
                {formatDate(post.scheduled_at)}
              </p>
            )}
            <p className="text-sm text-cms-text-muted">
              <span className="font-medium">Slides:</span> {slides.length}
            </p>
            <p className="text-sm text-cms-text-muted">
              <span className="font-medium">Criado em:</span>{' '}
              {formatDate(post.created_at)}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/cms/social/stories"
              className="rounded-md border border-cms-border px-3 py-1.5 text-sm text-cms-text-muted hover:border-cms-accent hover:text-cms-text transition-colors"
            >
              Voltar
            </Link>
            {isDraft && (
              <>
                <Link
                  href={`/cms/social/stories/${post.id}/edit`}
                  className="rounded-md border border-cms-border px-3 py-1.5 text-sm text-cms-text hover:border-cms-accent transition-colors"
                >
                  Editar
                </Link>
                <PublishDialogClient
                  slides={slides}
                  caption={caption}
                  onSaveDraft={handleSaveDraft}
                  onPublishNow={handlePublishNow}
                  onSchedule={handleSchedule}
                />
              </>
            )}
          </div>
        </div>

        {/* Story preview */}
        <section aria-label="Pré-visualização">
          <h2 className="text-sm font-semibold text-cms-text mb-3">Pré-visualização</h2>
          <StoryPreview slides={slides} mediaUrls={mediaUrls} caption={caption} />
        </section>

        {/* Insights — only for completed stories */}
        {isCompleted && (
          <section aria-label="Métricas">
            <h2 className="text-sm font-semibold text-cms-text mb-3">Métricas</h2>
            <StoryInsightsPanel siteId={ctx.siteId} postId={post.id} getInsights={getStoryInsights} />
          </section>
        )}

        {/* Highlights tip — only for completed stories */}
        {isCompleted && <HighlightsTip />}
      </div>
    </>
  )
}

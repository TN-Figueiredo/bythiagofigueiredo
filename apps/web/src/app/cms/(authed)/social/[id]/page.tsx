import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildShortUrl } from '@/lib/links/short-url'
import { getSocialPost, cancelSocialPost, deleteSocialPost, updateSocialPost, retrySocialDelivery, publishDraftPost } from '@/lib/social/actions'
import { getSocialStrings } from '../_i18n'
import { PostDetail } from '../_components/post-detail'
import { SourceCard } from './_components/source-card'
import { PipelineCompact } from './_components/pipeline-compact'
import { DeliveryHero } from './_components/delivery-hero'
import { PipelineContextPanel } from './_components/pipeline-context-panel'
import { ScrapeDetails } from './_components/scrape-details'
import { ShortLinkCard } from './_components/short-link-card'
import { UrlChain } from './_components/url-chain'
import { RawResponse } from './_components/raw-response'
import type { PipelineSnapshot, PipelineStep } from '@/lib/social/types'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

// ---------------------------------------------------------------------------
// Short link data fetched separately (not in getSocialPost to keep it lean)
// ---------------------------------------------------------------------------

interface ShortLinkData {
  shortUrl: string
  destinationUrl: string
  clicks: number
  uniqueVisitors: number
}

async function fetchShortLinkData(shortLinkId: string): Promise<ShortLinkData | null> {
  try {
    const supabase = getSupabaseServiceClient()

    const { data: link } = await supabase
      .from('tracked_links')
      .select('id, code, destination_url')
      .eq('id', shortLinkId)
      .maybeSingle()

    if (!link) return null

    // Sum clicks and unique visitors from daily metrics (last 90 days)
    const cutoff = new Date(Date.now() - 90 * 86400 * 1000).toISOString().slice(0, 10)
    const { data: metrics } = await supabase
      .from('link_daily_metrics')
      .select('clicks, unique_visitors')
      .eq('link_id', link.id)
      .gte('date', cutoff)

    const clicks = (metrics ?? []).reduce((sum, r) => sum + (r.clicks ?? 0), 0)
    const uniqueVisitors = (metrics ?? []).reduce((sum, r) => sum + (r.unique_visitors ?? 0), 0)

    return {
      shortUrl: buildShortUrl(link.code as string),
      destinationUrl: link.destination_url as string,
      clicks,
      uniqueVisitors,
    }
  } catch {
    return null
  }
}

export default async function SocialPostDetailPage({ params }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)
  const { id } = await params

  const result = await getSocialPost(id)
  if (!result.ok) notFound()

  const post = result.data as typeof result.data & {
    source_content_type?: string | null
    source_content_id?: string | null
    short_link_id?: string | null
    pipeline_steps?: PipelineStep[]
  }
  const hasSource = post.source_content_type && post.source_content_id
  const hasPipeline = Array.isArray(post.pipeline_steps) && post.pipeline_steps.length > 0

  // Derive delivery hero data from deliveries
  const deliveries = post.deliveries
  const publishedCount = deliveries.filter(d => d.status === 'published').length
  const totalCount = deliveries.length
  const deliveryPlatforms = [...new Set(deliveries.map(d => d.provider as string))]

  // DeliveryHero: show when there are deliveries (any terminal or active status)
  const heroStatuses = ['completed', 'partial_failure', 'publishing', 'failed']
  const showDeliveryHero = totalCount > 0 && heroStatuses.includes(post.status)

  // PipelineContextPanel: show when pipeline_snapshot exists
  const pipelineSnapshot = post.pipeline_snapshot as PipelineSnapshot | null

  // Short link data — fetch only when short_link_id is present
  const shortLinkData = post.short_link_id
    ? await fetchShortLinkData(post.short_link_id)
    : null

  // ScrapeDetails — extract from platform_prepare pipeline step data
  const prepareStep = post.pipeline_steps?.find(s => s.step === 'platform_prepare')
  const scrapeData = prepareStep?.data as
    | { tags?: number; latency_ms?: number; status?: number | string; error?: string }
    | undefined
  const showScrapeDetails =
    prepareStep !== undefined &&
    (prepareStep.status === 'completed' || prepareStep.status === 'warning') &&
    scrapeData !== undefined &&
    typeof scrapeData.latency_ms === 'number'

  // RawResponse — aggregate debug info from pipeline steps and deliveries
  const rawDebugData: Record<string, unknown> = {
    post_id: post.id,
    status: post.status,
    pipeline_steps: post.pipeline_steps ?? [],
    deliveries: deliveries.map(d => ({
      id: d.id,
      provider: d.provider,
      status: d.status,
      attempt: d.attempt,
      platform_post_id: d.platform_post_id,
      platform_url: d.platform_url,
      last_error: d.last_error,
      error_type: d.error_type,
      published_at: d.published_at,
    })),
  }

  return (
    <>
      <CmsTopbar title={t.detail.title} />
      <div className="p-6 space-y-4">
        {/* Delivery hero — top-level status overview */}
        {showDeliveryHero && (
          <DeliveryHero
            publishedCount={publishedCount}
            totalCount={totalCount}
            status={post.status}
            platforms={deliveryPlatforms}
          />
        )}

        {/* URL chain — shows short → destination redirect flow */}
        {shortLinkData && (
          <UrlChain
            shortUrl={shortLinkData.shortUrl}
            destinationUrl={shortLinkData.destinationUrl}
          />
        )}

        {(hasSource || hasPipeline || shortLinkData) && (
          <div className="flex flex-wrap items-start gap-4">
            {hasSource && (
              <SourceCard
                contentType={post.source_content_type!}
                contentId={post.source_content_id!}
                title={post.content.title ?? post.content.description ?? 'Conteúdo'}
              />
            )}
            {hasPipeline && (
              <PipelineCompact steps={post.pipeline_steps!} />
            )}
            {/* Short link card — shown alongside source/pipeline info */}
            {shortLinkData && (
              <ShortLinkCard
                shortUrl={shortLinkData.shortUrl}
                destinationUrl={shortLinkData.destinationUrl}
                clicks={shortLinkData.clicks}
                uniqueVisitors={shortLinkData.uniqueVisitors}
              />
            )}
          </div>
        )}

        <PostDetail
          post={post}
          strings={t}
          onCancel={cancelSocialPost}
          onDelete={deleteSocialPost}
          onUpdate={updateSocialPost}
          onRetryDelivery={retrySocialDelivery}
          onPublishDraft={publishDraftPost}
        />

        {/* Pipeline context panel — shows pipeline snapshot when post originated from pipeline */}
        {pipelineSnapshot && (
          <PipelineContextPanel snapshot={pipelineSnapshot} />
        )}

        {/* Scrape details — OG warm-up result from platform_prepare step */}
        {showScrapeDetails && (
          <ScrapeDetails
            endpoint={String((post.content as Record<string, unknown>).url ?? '')}
            status={typeof scrapeData!.status === 'number' ? scrapeData!.status : 200}
            latencyMs={scrapeData!.latency_ms!}
            timestamp={prepareStep!.at}
            pipelineSteps={post.pipeline_steps}
          />
        )}

        {/* Raw response — debug view of pipeline steps + delivery outcomes (collapsible) */}
        <RawResponse data={rawDebugData} />
      </div>
    </>
  )
}

import { getSiteContext } from '@/lib/cms/site-context'
import { getAbSiteSettings, getEligibleVideosForPicker, getAbDraftById } from '../queries'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { NewTestClient } from './client'
import * as Sentry from '@sentry/nextjs'
import { filtroBuscaVideo, resolverVideoPedido } from './resolver'
import type { CompetitorContext } from './client'

export const metadata = { title: 'Novo Teste: A/B Lab' }
export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{
    draft?: string
    videoId?: string
    ref?: string
    changeType?: string
    competitorThumb?: string
    competitorTitle?: string
  }>
}

export default async function NewAbTestPage({ searchParams }: Props) {
  const { siteId } = await getSiteContext()
  const params = await searchParams
  const draftId = params.draft

  const [settings, eligibleVideos, draftData] = await Promise.all([
    getAbSiteSettings(),
    getEligibleVideosForPicker(),
    draftId ? getAbDraftById(draftId) : Promise.resolve(null),
  ])

  // Chamadores mandam ora youtube_videos.id (uuid), ora o id do YouTube (Outliers).
  let idResolvido: string | null = null
  let falhou = false
  const pedido = params.videoId?.trim() || undefined
  const filtro = pedido ? filtroBuscaVideo(pedido) : null
  if (pedido && filtro && !eligibleVideos.some((v) => v.id === pedido)) {
    const { data, error } = await getSupabaseServiceClient()
      .from('youtube_videos')
      .select('id')
      .eq('site_id', siteId)
      .or(filtro)
      .limit(1)
      .maybeSingle()
    if (error) {
      falhou = true
      Sentry.captureException(error)
    }
    idResolvido = (data?.id as string | undefined) ?? null
  }
  const entrada = resolverVideoPedido(eligibleVideos, pedido, idResolvido, falhou)

  const competitorContext: CompetitorContext | undefined =
    params.ref === 'competitor'
      ? {
          changeType: (params.changeType as 'thumbnail' | 'title') ?? undefined,
          competitorThumb: params.competitorThumb ?? undefined,
          competitorTitle: params.competitorTitle ?? undefined,
        }
      : undefined

  return (
    <NewTestClient
      siteId={siteId}
      settings={settings}
      eligibleVideos={eligibleVideos}
      draftPrefill={draftData ?? undefined}
      competitorContext={competitorContext}
      initialVideoId={entrada.videoId ?? undefined}
      aviso={entrada.aviso ?? undefined}
    />
  )
}

import { getSiteContext } from '@/lib/cms/site-context'
import { getAbSiteSettings, getEligibleVideosForPicker, getAbDraftById } from '../queries'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { NewTestClient } from './client'
import { startAbTest, avisoDeVolumeDoTeste } from '../actions'
import { redirect } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { filtroBuscaVideo, resolverVideoPedido } from './resolver'
import type { CompetitorContext } from './client'
import { canalDaReferencia, lerParamsNovoTeste } from './params'
import { lerVideoForaDosCem } from './video-fora'
import { thumbDoVideoDeReferencia, thumbOriginalYtimg } from '@/lib/youtube/ab-referencia'
import { link } from '@/lib/youtube/observatorio/links'

export const metadata = { title: 'Novo Teste: A/B Lab' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // o Ativar roda startAbTest nesta rota (teto de 55 s), como em ab-lab/page.tsx

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function contextoDaReferencia(
  referencia: NonNullable<ReturnType<typeof lerParamsNovoTeste>['referencia']>,
  siteId: string,
): Promise<CompetitorContext> {
  const vazio: CompetitorContext = { ...referencia, thumb: null, titulo: null, canal: null, hrefOrigem: null, thumbSubstituta: null }
  if (!referencia.refVideoId) return vazio
  // Consulta escopada ao site: o cliente de serviço ignora RLS.
  const { data, error } = await getSupabaseServiceClient()
    .from('competitor_videos')
    .select('id, video_id, competitor_channels!inner(channel_name, site_id)')
    .eq('id', referencia.refVideoId)
    .eq('competitor_channels.site_id', siteId)
    .maybeSingle()
  if (error) {
    Sentry.captureMessage('ab-lab/new: falha ao ler o vídeo da referência', { level: 'warning', extra: { siteId, code: error.code } })
    return vazio
  }
  const achou = canalDaReferencia(data, siteId)
  if (!achou) return vazio
  return {
    ...referencia,
    thumb: thumbDoVideoDeReferencia(referencia.thumb, referencia.refVideoId, achou.ytId),
    canal: achou.canal,
    hrefOrigem: link.historico(referencia.refVideoId, referencia.refTroca ? { troca: referencia.refTroca } : undefined),
    thumbSubstituta: thumbOriginalYtimg(achou.ytId),
  }
}

export default async function NewAbTestPage({ searchParams }: Props) {
  const { siteId } = await getSiteContext()
  const params = lerParamsNovoTeste(await searchParams)
  const draftId = params.draft

  // A leitura do canal da referência vem DEPOIS da guarda de edição (getAbSiteSettings), não em paralelo com ela.
  // Reporter (sem edição) vai para /cms: a lista do A/B Lab também exige edição e cairia no error.tsx; autenticação segue o fluxo de antes.
  const settingsP = getAbSiteSettings()
  settingsP.catch(() => undefined)
  try {
    await settingsP
  } catch (e) {
    if (e instanceof Error && e.message === 'forbidden') redirect('/cms')
    throw e
  }
  const [settings, eligibleVideos, draftData, competitorContext] = await Promise.all([
    settingsP,
    getEligibleVideosForPicker(),
    draftId ? getAbDraftById(draftId) : Promise.resolve(null),
    params.referencia
      ? settingsP.then(() => contextoDaReferencia(params.referencia!, siteId))
      : Promise.resolve(undefined),
  ])

  // Chamadores mandam ora youtube_videos.id (uuid), ora o id do YouTube (Outliers).
  let idResolvido: string | null = null
  let falhou = false
  const pedido = params.videoId ?? undefined
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
  // Vídeo do site fora dos 100 mais recentes: entra na lista elegível (salvo Short, sem thumb HQ ou teste aberto, que mantêm o aviso).
  let elegiveis = eligibleVideos
  const alvoId = idResolvido ?? pedido
  if (alvoId && !falhou && !eligibleVideos.some((v) => v.id === alvoId)) {
    const extra = await lerVideoForaDosCem(getSupabaseServiceClient(), siteId, alvoId)
    if (extra) elegiveis = [...eligibleVideos, extra]
  }
  const entrada = resolverVideoPedido(elegiveis, pedido, idResolvido, falhou)

  return (
    <NewTestClient
      siteId={siteId}
      iniciarTeste={startAbTest}
      avisoDeVolume={avisoDeVolumeDoTeste}
      settings={settings}
      eligibleVideos={elegiveis}
      draftPrefill={draftData ?? undefined}
      competitorContext={competitorContext}
      tipoInicial={params.tipo}
      initialVideoId={entrada.videoId ?? undefined}
      aviso={entrada.aviso ?? undefined}
    />
  )
}

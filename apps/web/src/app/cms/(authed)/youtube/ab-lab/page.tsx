import { Suspense } from 'react'
import { getSiteContext } from '@/lib/cms/site-context'
import {
  getAbTestsForSite,
  getAbSiteSettings,
  getChannelLearnings,
  getSuggestedVideos,
  getEligibleVideosForPicker,
  toCardView,
  toDraftList,
  computeDashboardStats,
} from './queries'
import { AbLabDashboard } from './_components/ab-lab-dashboard'
import { ListaCaminhoServidor } from './_components/caminho-nativo/lista-caminho-servidor'
import { ListaEsqueleto } from './_components/caminho-nativo/lista-esqueleto'
import { ListaErro } from './_components/caminho-nativo/lista-erro'
import { videoDaUrl } from './video-param'
import { startAbTest } from './actions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerPausasYoutube } from '@/lib/youtube/teste-youtube/nativo/pausa-borda'

export const metadata = { title: 'A/B Lab' }

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // F-D3: settleOnAir (teto de 55 s) corre dentro das ações desta página

export default async function AbLabPage({ searchParams }: { searchParams: Promise<{ video?: string | string[] }> }) {
  const { siteId } = await getSiteContext()
  // O formato é conferido antes de qualquer leitura; a lista em si é lida pelo filho assíncrono, dentro do Suspense.
  const videoInicial = videoDaUrl((await searchParams).video)

  const [tests, settings, channelLearnings, suggested, eligibleVideos] = await Promise.all([
    getAbTestsForSite(),
    getAbSiteSettings(),
    getChannelLearnings(siteId),
    getSuggestedVideos(siteId),
    getEligibleVideosForPicker(),
  ])

  const stats = computeDashboardStats(tests.active, tests.completed)
  const cards = tests.active.map(toCardView)
  const completedCards = tests.completed.map(toCardView)
  // Pausados por teste do YouTube: a frase do card segue o registro (T10); sem isso o card mostraria só a nota crua.
  const pausas = await lerPausasYoutube(getSupabaseServiceClient(), siteId, tests.paused)
  const pausedCards = tests.paused.map((t) => {
    const card = toCardView(t)
    const pausa = pausas.get(t.id)
    return pausa ? { ...card, pausaYoutube: pausa } : card
  })
  const drafts = toDraftList(tests.draft)

  return (
    <AbLabDashboard
      siteId={siteId}
      stats={stats}
      cards={cards}
      drafts={drafts}
      completed={completedCards}
      paused={pausedCards}
      learnings={channelLearnings?.combined ?? null}
      channelLearnings={channelLearnings}
      suggested={suggested}
      settings={settings}
      eligibleVideos={eligibleVideos}
      iniciarTeste={startAbTest}
      listaSlot={
        <ListaErro key="lista-caminho">
          <Suspense fallback={<ListaEsqueleto />}>
            <ListaCaminhoServidor siteId={siteId} videoInicial={videoInicial} />
          </Suspense>
        </ListaErro>
      }
    />
  )
}

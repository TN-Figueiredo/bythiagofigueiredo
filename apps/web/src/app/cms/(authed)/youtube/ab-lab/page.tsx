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
  const pausedCards = tests.paused.map(toCardView)
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
      listaSlot={
        <ListaErro>
          <Suspense fallback={<ListaEsqueleto />}>
            <ListaCaminhoServidor siteId={siteId} videoInicial={videoInicial} />
          </Suspense>
        </ListaErro>
      }
    />
  )
}

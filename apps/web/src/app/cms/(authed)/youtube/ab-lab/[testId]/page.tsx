import { AvisoDePagina } from '../_components/acoes-de-saida'
import { getTestResults, toDetailView } from '../queries'
import { ActiveDetail } from '../_components/active-detail'
import { WinnerDetail } from '../_components/winner-detail'
import { PlayoffDetail } from '../_components/playoff-detail'
import { EarlyDetail } from '../_components/early-detail'
import { notFound } from 'next/navigation'
import { endAbTest, pauseAbTest, retryRestore, dismissRestore } from '../actions'
import * as Sentry from '@sentry/nextjs'
import { FaixaComAcoes } from '../_components/faixa-com-acoes'
import { carregarDadosDaFaixa } from '../_components/faixa-dados'
import { AtualizarEnquantoEmAndamento } from '../_components/atualizar-enquanto-em-andamento'
import { isEarly } from '../_components/is-early'
import { faixaDaPagina } from '../_components/faixa-da-pagina'
import type { Metadata } from 'next'
import type { AbTestDetailView, AbTestActiveView } from '@/lib/youtube/ab-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // F-D3: settleOnAir (teto de 55 s) corre dentro das ações desta página

// ---------------------------------------------------------------------------
// generateMetadata — show video title in the browser tab
// ---------------------------------------------------------------------------

const FALLBACK_TITLE: Metadata = { title: 'Teste A/B — YouTube' }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ testId: string }>
}): Promise<Metadata> {
  const { testId } = await params

  // Mock IDs (dev only) — skip DB query
  if (testId.startsWith('mock-')) return FALLBACK_TITLE

  try {
    const results = await getTestResults(testId)
    if (!results) return FALLBACK_TITLE

    const videoTitle = (results.test.original_title ?? results.test.name).replace(
      /^Test:\s*/i,
      '',
    )
    return { title: `${videoTitle} — A/B Lab` }
  } catch {
    return FALLBACK_TITLE
  }
}

async function getMockMap(): Promise<Record<string, AbTestDetailView>> {
  if (process.env.NODE_ENV !== 'development') return {}
  const { MOCK_ACTIVE, MOCK_WINNER, MOCK_PLAYOFF, MOCK_EARLY } = await import('../_components/mock-views')
  return {
    'mock-active-1': MOCK_ACTIVE,
    'mock-active-2': MOCK_ACTIVE,
    'mock-completed-1': MOCK_WINNER,
    'mock-completed-2': MOCK_WINNER,
    'mock-completed-3': MOCK_PLAYOFF,
    'mock-draft-1': MOCK_ACTIVE,
    'mock-early-1': MOCK_EARLY,
  }
}

function renderView(view: AbTestDetailView) {
  if (view.status !== 'completed') {
    const id = (view as AbTestActiveView).id
    if (isEarly(view)) return <EarlyDetail view={view} encerrar={endAbTest.bind(null, id)} pausar={pauseAbTest.bind(null, id)} />
    return <ActiveDetail view={view as AbTestActiveView} encerrar={endAbTest.bind(null, id)} pausar={pauseAbTest.bind(null, id)} />
  }
  if (view.outcome === 'winner') return <WinnerDetail view={view} />
  return <PlayoffDetail view={view} />
}

export default async function AbTestDetailPage({
  params,
}: {
  params: Promise<{ testId: string }>
}) {
  const { testId } = await params

  const mockMap = await getMockMap()
  const mockView = mockMap[testId]
  if (mockView) return <><AvisoDePagina testId={testId} />{renderView(mockView)}</>

  const results = await getTestResults(testId)
  if (!results) notFound()

  const view = await toDetailView(results)
  const dados = await carregarDadosDaFaixa(results.test, view.restoreStatus)
  const { faixa, faixaTentando, emAndamentoDesde, ilegivel } = faixaDaPagina(view, results.test.restore_status, new Date(), dados)
  if (ilegivel) Sentry.captureMessage('restore_status ilegível', { extra: { testId } })
  return (
    <>
      {faixa ? (
        <FaixaComAcoes
          testId={testId} faixa={faixa} faixaTentando={faixaTentando} seqVisto={view.restoreSeq}
          tentar={retryRestore.bind(null, testId)} dispensar={dismissRestore.bind(null, testId)}
        />
      ) : null}
      {emAndamentoDesde ? <AtualizarEnquantoEmAndamento emAndamentoDesde={emAndamentoDesde} /> : null}
      <AvisoDePagina testId={testId} />
      {renderView(view)}
    </>
  )
}

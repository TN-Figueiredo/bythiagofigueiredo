import { AvisoDePagina } from '../_components/acoes-de-saida'
import { getTestResults, toDetailView } from '../queries'
import { ActiveDetail } from '../_components/active-detail'
import { WinnerDetail } from '../_components/winner-detail'
import { PlayoffDetail } from '../_components/playoff-detail'
import { ConcluidoV2Detail } from '../_components/concluido-v2-detail'
import { EarlyDetail } from '../_components/early-detail'
import { notFound } from 'next/navigation'
import { endAbTest, pauseAbTest, resumeAbTest, retryRestore, dismissRestore } from '../actions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerPausasYoutube } from '@/lib/youtube/teste-youtube/nativo/pausa-borda'
import * as Sentry from '@sentry/nextjs'
import { FalhaDeLeitura } from '../_components/falha-de-leitura'
import { horaDaFalha } from '../_components/hora-da-falha'
import { FaixaComAcoes } from '../_components/faixa-com-acoes'
import { carregarDadosDaFaixa } from '../_components/faixa-dados'
import { AtualizarEnquantoEmAndamento } from '../_components/atualizar-enquanto-em-andamento'
import { isEarly } from '../_components/is-early'
import { faixaDaPagina } from '../_components/faixa-da-pagina'
import '../_components/ab-pagina.css'
import type { Metadata } from 'next'
import type { AbTestDetailView, AbTestActiveView } from '@/lib/youtube/ab-types'
import type { TelaV2 } from '@/lib/youtube/ab-gravacao/tela-v2'

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

function Pagina({ children }: { children: React.ReactNode }) {
  return <div className="ab-pagina"><div className="ab-coluna">{children}</div></div>
}

function renderView(view: AbTestDetailView, { escrevendo }: { escrevendo: boolean }) {
  if (view.status !== 'completed') {
    const id = (view as AbTestActiveView).id
    if (isEarly(view) && (view as AbTestActiveView).v2?.fase !== 'ativo') return <EarlyDetail view={view} encerrar={endAbTest.bind(null, id)} pausar={pauseAbTest.bind(null, id)} retomar={resumeAbTest.bind(null, id)} escrevendo={escrevendo} />
    return <ActiveDetail view={view as AbTestActiveView} encerrar={endAbTest.bind(null, id)} pausar={pauseAbTest.bind(null, id)} retomar={resumeAbTest.bind(null, id)} escrevendo={escrevendo} />
  }
  // Concluído v2 "da regra" (D-T12-2): a tela v2 (T12). Encerrado à mão no ativo segue nos detalhes de sempre.
  if (view.v2?.fase === 'concluido') {
    return <ConcluidoV2Detail view={view as AbTestDetailView & { v2: Extract<TelaV2, { fase: 'concluido' }> }} />
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
  if (mockView) return <Pagina><AvisoDePagina testId={testId} />{renderView(mockView, { escrevendo: false })}</Pagina>

  // O Next apaga a mensagem de erro de Server Component em produção: a falha de leitura do placar (D-F3-5)
  // é tratada aqui, no servidor, para a cópia do M4 chegar à tela.
  let results: Awaited<ReturnType<typeof getTestResults>>
  try {
    results = await getTestResults(testId)
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('ab_lab_leitura')) {
      Sentry.captureException(e)
      return <Pagina><FalhaDeLeitura falhouAs={horaDaFalha(new Date())} /></Pagina>
    }
    throw e
  }
  if (!results) notFound()

  const viewBase = await toDetailView(results)
  // Pausa por teste do YouTube (T10): o "Retomar" da tela segue o registro aberto; a leitura fecha em falha.
  const pausa = (await lerPausasYoutube(getSupabaseServiceClient(), results.test.site_id, [results.test])).get(testId)
  const view = pausa && viewBase.status !== 'completed' ? { ...viewBase, pausaYoutube: pausa } : viewBase
  const dados = await carregarDadosDaFaixa(results.test, view.restoreStatus)
  const { faixa, faixaTentando, emAndamentoDesde, ilegivel, escrevendo } = faixaDaPagina(view, results.test.restore_status, new Date(), dados)
  if (ilegivel) Sentry.captureMessage('restore_status ilegível', { extra: { testId } })
  return (
    <Pagina>
      {faixa ? (
        <FaixaComAcoes
          testId={testId} faixa={faixa} faixaTentando={faixaTentando} seqVisto={view.restoreSeq}
          tentar={retryRestore.bind(null, testId)} dispensar={dismissRestore.bind(null, testId)}
        />
      ) : null}
      {emAndamentoDesde ? <AtualizarEnquantoEmAndamento emAndamentoDesde={emAndamentoDesde} /> : null}
      <AvisoDePagina testId={testId} />
      {renderView(view, { escrevendo })}
    </Pagina>
  )
}

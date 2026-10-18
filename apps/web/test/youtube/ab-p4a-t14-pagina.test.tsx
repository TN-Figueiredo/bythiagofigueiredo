// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

const refresh = vi.fn()
const captureMessage = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => captureMessage(...a) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }), notFound: () => { throw new Error('notFound') } }))
const cadeia: Record<string, unknown> = {}
for (const m of ['select', 'eq', 'neq', 'not', 'is', 'in', 'gte', 'lt', 'order', 'limit', 'from']) cadeia[m] = vi.fn().mockReturnValue(cadeia)
cadeia.single = vi.fn().mockResolvedValue({ data: null, error: null })
cadeia.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => cadeia }))
const getTestResults = vi.fn()
vi.mock('@/app/cms/(authed)/youtube/ab-lab/queries', async orig => ({
  ...(await orig<typeof import('@/app/cms/(authed)/youtube/ab-lab/queries')>()),
  getTestResults: (...a: unknown[]) => getTestResults(...a),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/active-detail', () => ({ ActiveDetail: () => <div data-testid="detalhe" /> }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/early-detail', () => ({ EarlyDetail: () => <div data-testid="detalhe" /> }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/winner-detail', () => ({ WinnerDetail: () => <div data-testid="detalhe" /> }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/playoff-detail', () => ({ PlayoffDetail: () => <div data-testid="detalhe" /> }))

import AbTestDetailPage from '@/app/cms/(authed)/youtube/ab-lab/[testId]/page'
import { makeTestRow } from '../helpers/ab-fixtures'
import type { AbTestResults, VariantStats } from '@/lib/youtube/ab-types'

function stats(id: string, label: string, orig: boolean): VariantStats {
  return { variant_id: id, label, blob_url: null, title_text: null, metadata: {}, is_original: orig, total_impressions: 100, total_clicks: 5, avg_ctr: 0.05, cycles_completed: 1 }
}
const AGORA = Date.now()
const iso = (minAtras: number) => new Date(AGORA - minAtras * 60_000).toISOString()
function campo(p: Record<string, unknown>) {
  return { estado: 'ok', destino: 'original', em: iso(60), forcado: false, escreveu: true, erro: null, attempts: 1, ...p }
}

function resultados(status: 'active' | 'paused' | 'completed', restore: unknown): AbTestResults {
  return {
    test: makeTestRow({ status, youtube_video_id: 'yt-abc', restore_status: restore, winner_variant_id: status === 'completed' ? 'v-b' : null, completed_reason: status === 'completed' ? 'manual_winner' : null }),
    variants: [stats('v-a', 'original', true), stats('v-b', 'B', false)],
    confidence: 0.5, is_significant: false, suggested_winner_id: null,
    timeline: [], data_freshness: new Date().toISOString(),
  } as AbTestResults
}
async function abrir(r: AbTestResults) {
  getTestResults.mockResolvedValue(r)
  render(await AbTestDetailPage({ params: Promise.resolve({ testId: 't1' }) }))
}
const faixa = () => screen.queryByLabelText('Restauração do vídeo')

beforeEach(() => { vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); refresh.mockClear(); captureMessage.mockClear() })
afterEach(() => { cleanup(); vi.useRealTimers() })

const emAndamento = campo({ estado: 'em_andamento', em: iso(1), escreveu: null })
const falhou = campo({ estado: 'falhou', erro: { status: 403, reason: 'forbidden', chamada: 'videos.update' } })

describe('T14 ligação: faixa na página do teste', () => {
  it('nulo (mundo antigo): sem faixa, sem Sentry, detalhe presente', async () => {
    await abrir(resultados('completed', null))
    expect(faixa()).toBeNull()
    expect(captureMessage).not.toHaveBeenCalled()
    expect(screen.getByTestId('detalhe')).toBeTruthy()
  })
  it('ilegível: avisa o Sentry com o testId e mostra o aviso "não sabemos", nunca "voltou ao original"', async () => {
    await abrir(resultados('completed', { title: { estado: 'lixo' } }))
    expect(captureMessage).toHaveBeenCalledWith('restore_status ilegível', { extra: { testId: 't1' } })
    expect(faixa()).not.toBeNull()
    expect(document.body.textContent).toContain('Não sabemos se o vídeo voltou ao original.')
    expect(document.body.textContent).not.toMatch(/voltaram? ao original em/)
  })
  it('encerrado com falha: faixa de erro no topo, antes do detalhe', async () => {
    await abrir(resultados('completed', { title: falhou }))
    const f = faixa()!
    expect(f.textContent).toMatch(/O YouTube recusou em/)
    expect(f.compareDocumentPosition(screen.getByTestId('detalhe')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('pausado com falha também mostra a faixa', async () => {
    await abrir(resultados('paused', { title: falhou }))
    expect(faixa()).not.toBeNull()
  })
  it('encerrado, tudo ok: linha de resultado, sem banda', async () => {
    await abrir(resultados('completed', { title: campo({}) }))
    expect(document.body.textContent).toContain('O título voltou ao original em')
    expect(faixa()).toBeNull()
  })
  it('ativo com em_andamento: faixa e ilha (refresh a cada 10 s)', async () => {
    await abrir(resultados('active', { title: emAndamento }))
    expect(faixa()).not.toBeNull()
    vi.advanceTimersByTime(20_000)
    expect(refresh).toHaveBeenCalledTimes(2)
  })
  it('ativo sem em_andamento (retrato antigo com falha): sem faixa e sem ilha', async () => {
    await abrir(resultados('active', { title: falhou }))
    expect(faixa()).toBeNull()
    vi.advanceTimersByTime(60_000)
    expect(refresh).not.toHaveBeenCalled()
  })
  it('encerrado sem em_andamento: faixa, mas sem ilha', async () => {
    await abrir(resultados('completed', { title: falhou }))
    vi.advanceTimersByTime(60_000)
    expect(refresh).not.toHaveBeenCalled()
  })
  it('encerrado com em_andamento: faixa e ilha', async () => {
    await abrir(resultados('paused', { title: emAndamento }))
    vi.advanceTimersByTime(10_000)
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})

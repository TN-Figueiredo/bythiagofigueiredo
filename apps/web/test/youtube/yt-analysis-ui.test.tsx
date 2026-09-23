// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, within } from '@testing-library/react'

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock, push: vi.fn() }) }))

import {
  useAnalysisTask,
  YtAnalysisProgress,
  progressButtonLabel,
  POLL_MS,
  DONE_VISIBLE_MS,
} from '@/app/cms/(authed)/youtube/analytics/_components/yt-analysis-progress'
import { YtAnalysisHistory } from '@/app/cms/(authed)/youtube/analytics/_components/yt-analysis-history'
import { toHistoryEntry } from '@/lib/youtube/analysis-history'
import type { AnalysisTaskSnapshot } from '@/lib/youtube/analysis-progress'

const CH = '11111111-1111-4111-8111-111111111111'
const pending: AnalysisTaskSnapshot = {
  id: 't1', status: 'pending', requestedAt: '2026-09-23T10:34:12Z', startedAt: null, completedAt: null,
  failedAt: null, updatedAt: '2026-09-23T10:34:12Z', retryCount: 0, errorMessage: null,
}

function Harness({ initial, poll }: { initial: AnalysisTaskSnapshot | null; poll: (id: string) => Promise<AnalysisTaskSnapshot | null> }) {
  const p = useAnalysisTask(CH, initial, poll)
  const btn = progressButtonLabel(p.view, p.now)
  return (
    <div>
      <span data-testid="btn">{btn ? `${btn.text}${btn.small ? ` ${btn.small}` : ''}` : 'Pedir diagnostico'}</span>
      {p.view && p.now && p.task && (
        <YtAnalysisProgress view={p.view} now={p.now} channelName="tnFigueiredo"
          requestedAt={new Date(p.task.requestedAt)} retryCount={p.task.retryCount} />
      )}
    </div>
  )
}

describe('progress card, end to end through the hook', () => {
  beforeEach(() => {
    refreshMock.mockClear()
    vi.useFakeTimers({ now: new Date('2026-09-23T10:35:00Z'), toFake: ['Date', 'setInterval', 'setTimeout', 'clearInterval', 'clearTimeout'] })
  })
  afterEach(() => vi.useRealTimers())

  it('queued → running → published, refreshes the page once, then leaves on its own', async () => {
    const poll = vi.fn<(id: string) => Promise<AnalysisTaskSnapshot | null>>()
      .mockResolvedValueOnce({ ...pending, status: 'running', startedAt: '2026-09-23T10:40:03Z' })
      .mockResolvedValueOnce({ ...pending, status: 'completed', startedAt: '2026-09-23T10:40:03Z', completedAt: '2026-09-23T10:40:16Z' })

    render(<Harness initial={pending} poll={poll} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByText('Na fila. A forja pega na próxima olhada, às 07:40.')).toBeTruthy()
    expect(screen.getByTestId('btn').textContent).toBe('Na fila ~6 min')

    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS) })
    expect(poll).toHaveBeenCalledWith(CH)
    expect(screen.getByText(/A forja pegou o pedido às 07:40:03/)).toBeTruthy()
    expect(screen.getByTestId('btn').textContent).toBe('Forja trabalhando')
    expect(refreshMock).not.toHaveBeenCalled()

    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS) })
    expect(screen.getByText('Diagnóstico novo publicado às 07:40:16.')).toBeTruthy()
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('btn').textContent).toBe('Pedir diagnostico')

    // Polling stopped once the task closed.
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS * 2) })
    expect(poll).toHaveBeenCalledTimes(2)

    await act(async () => { await vi.advanceTimersByTimeAsync(DONE_VISIBLE_MS) })
    expect(screen.queryByText(/Diagnóstico novo publicado/)).toBeNull()
  })

  it('an old completion on page load is not announced as news', async () => {
    const done = { ...pending, status: 'completed' as const, completedAt: '2026-09-23T10:30:16Z' }
    render(<Harness initial={done} poll={vi.fn()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.queryByText(/publicado/)).toBeNull()
    expect(screen.getByTestId('btn').textContent).toBe('Pedir diagnostico')
  })

  it('a failed poll keeps the last state instead of blanking the card', async () => {
    const poll = vi.fn<(id: string) => Promise<AnalysisTaskSnapshot | null>>().mockRejectedValue(new Error('network'))
    render(<Harness initial={pending} poll={poll} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS) })
    expect(poll).toHaveBeenCalled()
    expect(screen.getByText('Na fila. A forja pega na próxima olhada, às 07:40.')).toBeTruthy()
  })

  it('a terminal failure names the reason and the attempt count', async () => {
    const failed = {
      ...pending, status: 'failed' as const, startedAt: '2026-09-23T10:40:03Z',
      failedAt: '2026-09-23T10:49:40Z', updatedAt: '2026-09-23T10:49:40Z', retryCount: 2, errorMessage: 'llama',
    }
    render(<Harness initial={failed} poll={vi.fn()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByText('A forja não conseguiu publicar: o modelo local não respondeu.')).toBeTruthy()
    expect(screen.getByText('3 de 3 tentativas')).toBeTruthy()
  })
})

describe('YtAnalysisHistory with the production rows of 23/09', () => {
  const rows = [
    {
      id: 'f2', source: 'forja', generated_at: '2026-09-23T10:30:16Z',
      coaching: { summary: 'Canal com 31 vídeos públicos no banco.', priorities: [] },
      patterns_detected: [
        { tipo: 'padrao', pattern_id: 'serie:zero-dez', category: 'series', confidence: 0.6, sample_size: 10,
          finding: 'f', serie: 'zero-dez', nome: '0–10', n: 11, ano: 2019, anos: { de: 2019, ate: 2019 },
          mediana: 91, mediana_coorte: 143.5, n_coorte: 10, razao: 0.6341463414634146, leitura: 'abaixo' },
        { tipo: 'examinada', serie: 'canada', nome: 'Canadá', n: 9, ano: 2017, anos: { de: 2017, ate: 2019 },
          mediana: 209, n_coorte: 0, leitura: 'sem_coorte', motivo: 'coorte_fina' },
      ],
    },
    { id: 'f1', source: 'forja', generated_at: '2026-09-22T20:10:42Z', coaching: { summary: 'Canal com 35 vídeos no banco.', priorities: [] }, patterns_detected: [] },
    {
      id: 'c1', source: 'cowork', generated_at: '2026-05-18T13:34:10Z',
      coaching: { summary: 'Canal micro.', priorities: [{ axis: 'reach', score: 3, diagnosis: 'd', action: 'Produzir 2-3 vídeos/mês' }] },
      patterns_detected: [{ finding: 'Tailândia 3.5x' }],
    },
  ].map(r => toHistoryEntry(r)!)

  it('lists newest first, the newest open and marked as the one on screen', () => {
    const { container } = render(<YtAnalysisHistory entries={rows} />)
    const items = container.querySelectorAll('details.hist-it')
    expect(items).toHaveLength(3)
    expect((items[0] as HTMLDetailsElement).open).toBe(true)
    expect((items[1] as HTMLDetailsElement).open).toBe(false)
    expect(within(items[0] as HTMLElement).getByText('EM EXIBIÇÃO')).toBeTruthy()
    expect(within(items[0] as HTMLElement).getByText('23/09 07:30')).toBeTruthy()
    expect(screen.getByText('3 · desde 18/05/2026')).toBeTruthy()
  })

  it('the series table prints the forja numbers, in Portuguese, without inventing a cohort', () => {
    const { container } = render(<YtAnalysisHistory entries={rows} />)
    const cells = [...container.querySelectorAll('.hist-tb tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent))
    expect(cells).toEqual([
      ['“0–10” · 2019', '11', '91', '143,5', '0,63×', 'abaixo da coorte'],
      ['“Canadá” · 2017–2019', '9', '209', '—', '—', 'sem coorte: nenhum outro vídeo maduro de 2017 fora da série'],
    ])
    expect(screen.getByText('1 série com efeito · 1 examinada sem veredito')).toBeTruthy()
  })

  it('the pre-map forja row says its numbers do not compare', () => {
    render(<YtAnalysisHistory entries={rows} />)
    expect(screen.getByText('sem séries: o mapa de séries ainda não existia')).toBeTruthy()
    expect(screen.getByText(/não são comparáveis/)).toBeTruthy()
  })

  it('the Cowork row counts its recommendations and says the cards come from it', () => {
    render(<YtAnalysisHistory entries={rows} />)
    expect(screen.getByText('1 recomendação · 1 padrão · os cards acima vêm daqui')).toBeTruthy()
    expect(screen.getByText('Produzir 2-3 vídeos/mês')).toBeTruthy()
  })

  it('nothing at all when there is no history', () => {
    const { container } = render(<YtAnalysisHistory entries={[]} />)
    expect(container.innerHTML).toBe('')
  })
})

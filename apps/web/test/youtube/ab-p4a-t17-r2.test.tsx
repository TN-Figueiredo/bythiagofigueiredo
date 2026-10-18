// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AbTestActiveView, DisplayLabel } from '@/lib/youtube/ab-types'
import type { OpcaoEncerrar, ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({
  YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => true,
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  forceRotate: vi.fn(), acknowledgeAbTestDrift: vi.fn(), resumeAbTest: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/use-poll-stats', () => ({
  usePollStats: vi.fn(() => ({ data: null, loading: false })),
}))

import { EarlyDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/early-detail'
import { ActiveDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-detail'
import { isEarly } from '@/app/cms/(authed)/youtube/ab-lab/_components/is-early'
import { cancelarFocoDaFaixa } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-end-test-dialog'
import { readFileSync } from 'node:fs'

function view(over: Partial<AbTestActiveView> = {}): AbTestActiveView {
  return {
    id: 'test-1', videoTitle: 'Vídeo', flag: 'thumbnail', status: 'active',
    variants: [
      { label: 'A', color: '#8A8F98', ctr: 0, impressions: 0, clicks: 0, pBest: 0 },
      { label: 'B', color: '#E8823C', ctr: 0, impressions: 0, clicks: 0, pBest: 0 },
    ],
    variantThumbs: [
      { label: 'A', color: '#8A8F98', thumbUrl: null, isOriginal: true },
      { label: 'B', color: '#E8823C', thumbUrl: null, isOriginal: false },
    ],
    variantDb: [
      { id: 'va', label: 'A', is_original: true, title_text: 'Original', blob_url: null, dimensions: '1280x720' },
      { id: 'vb', label: 'B', is_original: false, title_text: 'Título B', blob_url: null, dimensions: '1280x720' },
    ],
    confTrend: [], daily: { A: [], B: [] } as unknown as Record<DisplayLabel, number[]>,
    abbaSeq: [] as DisplayLabel[], cycles: { total: 6, done: 0 }, durationDays: 14, confidenceTarget: 0.95,
    totalRounds: 1, hasPlayoff: false, gates: [], activeNow: 'A', noArAgora: { label: 'A', desde: null },
    restoreSeq: 42,
    confirmedData: { confidence: 0, leader: 'A' as DisplayLabel, leaderColor: '#8A8F98', lift: 0 },
    ...over,
  } as unknown as AbTestActiveView
}

let encerrar: ReturnType<typeof vi.fn<(o: OpcaoEncerrar) => Promise<ResultadoAcaoSaida>>>
let pausar: ReturnType<typeof vi.fn<(s: number) => Promise<ResultadoAcaoSaida>>>
beforeEach(() => {
  encerrar = vi.fn(); pausar = vi.fn(); router.refresh.mockClear(); router.push.mockClear()
})
afterEach(() => { cleanup(); cancelarFocoDaFaixa() })

describe('D6: roteamento', () => {
  it('teste pausado no 1º dia NÃO é early (vai ao ActiveDetail, que tem Retomar)', () => {
    expect(isEarly(view({ status: 'paused' }))).toBe(false)
  })
  it('teste ativo sem ciclo fechado e sem confiança segue early', () => {
    expect(isEarly(view())).toBe(true)
  })
  it('a página usa isEarly do módulo e passa encerrar/pausar ao EarlyDetail', () => {
    const f = readFileSync('src/app/cms/(authed)/youtube/ab-lab/[testId]/page.tsx', 'utf8')
    expect(f).toMatch(/<EarlyDetail[^>]*encerrar=\{endAbTest\.bind[^>]*pausar=\{pauseAbTest\.bind/)
  })
})

describe('D6: EarlyDetail com Pausar e Encerrar', () => {
  it('mostra os dois botões; Pausar devolve o restoreSeq da tela (D3)', async () => {
    pausar.mockResolvedValue({ ok: true, resultado: 'feito', campos: {} })
    render(<EarlyDetail view={view()} encerrar={encerrar} pausar={pausar} />)
    expect(screen.getByRole('button', { name: /Encerrar/ })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /^Pausar/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Pausar teste' }))
    expect(pausar).toHaveBeenCalledWith(42)
  })
  it('Encerrar abre o diálogo, sem número de medição, e devolve seqVisto', async () => {
    encerrar.mockResolvedValue({ ok: true, resultado: 'feito', campos: {} })
    render(<EarlyDetail view={view()} encerrar={encerrar} pausar={pausar} />)
    await userEvent.click(screen.getByRole('button', { name: /^Encerrar$/ }))
    const dialogo = screen.getByRole('dialog')
    expect(dialogo.textContent).not.toMatch(/\d+(,\d+)?\s?%|CTR|0,0/)
    await userEvent.click(screen.getByLabelText('A (original)'))
    await userEvent.click(screen.getByRole('button', { name: /^Encerrar e ficar com/ }))
    expect(encerrar).toHaveBeenCalledWith({ destino: 'original', seqVisto: 42 })
  })
  it('encerrar recusado (mudou): frase e botão Recarregar; nada fecha', async () => {
    encerrar.mockResolvedValue({ ok: false, resultado: 'mudou', error: 'O teste mudou em outra aba. Reabra para decidir.' })
    render(<EarlyDetail view={view()} encerrar={encerrar} pausar={pausar} />)
    await userEvent.click(screen.getByRole('button', { name: /^Encerrar$/ }))
    await userEvent.click(screen.getByLabelText('A (original)'))
    await userEvent.click(screen.getByRole('button', { name: /^Encerrar e ficar com/ }))
    expect((await screen.findByRole('alert')).textContent).toContain('O teste mudou em outra aba.')
    expect(screen.getByRole('alert').textContent).toContain('Reabra para decidir.')
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeTruthy()
  })
  it('pausar recusado (mudou): frase e Recarregar no lugar do botão de confirmar', async () => {
    pausar.mockResolvedValue({ ok: false, resultado: 'mudou', error: 'O teste mudou em outra aba. Reabra para decidir.' })
    render(<EarlyDetail view={view()} encerrar={encerrar} pausar={pausar} />)
    await userEvent.click(screen.getByRole('button', { name: /^Pausar/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Pausar teste' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Reabra para decidir.')
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Pausar teste' })).toBeNull()
  })
})

describe('D6 menor: ActiveDetail', () => {
  it('com o teste já pausado não mostra Pausar, mantém Encerrar', () => {
    render(<ActiveDetail view={view({ status: 'paused' })} encerrar={encerrar} pausar={pausar} />)
    expect(screen.queryByRole('button', { name: /^Pausar/ })).toBeNull()
    expect(screen.getByRole('button', { name: /^Encerrar$/ })).toBeTruthy()
  })
  it('ativo mostra os dois', () => {
    render(<ActiveDetail view={view({ cycles: { total: 6, done: 2 } })} encerrar={encerrar} pausar={pausar} />)
    expect(screen.getByRole('button', { name: /^Pausar/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Encerrar$/ })).toBeTruthy()
  })
})

describe('B1/B2/C1/C2: CSS', () => {
  const dir = 'src/app/cms/(authed)/youtube/ab-lab/_components/'
  const dlg = readFileSync(dir + 'ab-end-test-dialog.css', 'utf8')
  const faixa = readFileSync(dir + 'faixa-restauracao.css', 'utf8')
  it('sem --color-cms-* com fallback escuro e sem color-mix', () => {
    for (const bruto of [dlg, faixa]) {
      const css = bruto.replace(/\/\*[\s\S]*?\*\//g, '')
      expect(css).not.toMatch(/var\(--color-cms-/)
      expect(css).not.toMatch(/color-mix/)
    }
  })
  it('scrim acima da barra inferior e com safe-area a ≤480 px', () => {
    expect(dlg).toMatch(/\.etd-scrim \{[^}]*z-index: 60/)
    expect(dlg).toMatch(/max-width: 480px\) \{ \.etd-scrim \{ padding-bottom: calc\(12px \+ env\(safe-area-inset-bottom\)\)/)
  })
  it('primário claro #FFF8F0 e muted legível na opção marcada', () => {
    expect(dlg).toMatch(/\[data-theme="light"\] \.etd-btn\.pri \{ color: #FFF8F0/)
    expect(dlg).toMatch(/\.etd-cmp \.mine h4[^{]*\{ color: var\(--etd-text\)/)
  })
})

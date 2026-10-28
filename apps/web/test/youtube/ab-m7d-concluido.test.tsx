// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'

const archive = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({
  YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({ archiveAbTest: archive }))
const admin = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => admin.value,
}))

import { WinnerDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/winner-detail'
import { ConcluidoV2Detail } from '@/app/cms/(authed)/youtube/ab-lab/_components/concluido-v2-detail'
import type { AbTestWinnerView, AbTestDetailView, LiveMonitor, FullChartVariant, VariantThumb, GateResult } from '@/lib/youtube/ab-types'

beforeEach(() => { archive.mockReset(); archive.mockResolvedValue({ ok: true }) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function makeVariant(label: 'A' | 'B' | 'C' | 'D', overrides?: Partial<FullChartVariant>): FullChartVariant {
  return {
    label,
    color: '#888',
    ctr: 5.0,
    impressions: 10000,
    clicks: 500,
    pBest: 0.5,
        ...overrides,
  }
}

function makeThumb(label: 'A' | 'B' | 'C' | 'D', isOriginal = false): VariantThumb {
  return { label, color: '#888', thumbUrl: null, isOriginal }
}

function makeGates(count: number, allPass = false): GateResult[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `Gate ${i + 1}`,
    passed: allPass || i < 3,
    value: `${i + 1}/${count}`,
  }))
}

function makeMonitor(overrides?: Partial<LiveMonitor>): LiveMonitor {
  return {
    liveCtr: 6.2,
    sparkline: [5.0, 5.5, 5.8, 6.0, 6.2],
    liftVsOriginal: 12.5,
    checkpoints: [
      { label: 'D+7', reached: true, date: '2026-05-01' },
      { label: 'D+14', reached: true, date: '2026-05-08' },
      { label: 'D+30', reached: false },
    ],
    ...overrides,
  }
}

function makeWinnerView(overrides?: Partial<AbTestWinnerView>): AbTestWinnerView {
  return {
    id: 'test-1',
    videoTitle: 'My Test Video',
    flag: 'thumbnail',
    status: 'completed',
    outcome: 'winner',
    winnerLabel: 'B',
    winnerColor: '#E8823C',
    lift: 15.3,
    confidence: 97.2,
    resultMeta: {
      ctrBefore: 4.5,
      ctrAfter: 5.2,
      totalImpressions: 50000,
      abbaCycles: 12,
      monthlyExtraClicks: 350,
    },
    variants: [
      makeVariant('A', { ctr: 4.5, pBest: 0.1, impressions: 25000, clicks: 1125 }),
      makeVariant('B', { ctr: 5.2, pBest: 0.9, impressions: 25000, clicks: 1300 }),
    ],
    variantThumbs: [makeThumb('A', true), makeThumb('B')],
    confTrend: [50, 65, 78, 85, 92, 97],
    daily: { A: [4.2, 4.5, 4.3, 4.6, 4.5, 4.4], B: [5.0, 5.1, 5.3, 5.1, 5.2, 5.2], C: [], D: [] },
    abbaSeq: ['A', 'B', 'B', 'A', 'A', 'B'],
    cycles: { total: 12, done: 12 },
    durationDays: 14,
    confidenceTarget: 0.95,
    totalRounds: 1,
    hasPlayoff: false,
    gates: makeGates(6, true),
    ...overrides,
  }
}


const W = (o: Partial<AbTestWinnerView> = {}) => makeWinnerView({ completedAt: '2026-10-24T12:00:00Z', ...o })

describe('M7d T7: WinnerDetail', () => {
  it('Ficou no ar: frase uma vez, "No ar agora" some, selo "No ar" na linha B', () => {
    const { container } = render(<WinnerDetail view={W({ noAr: { letra: 'B', original: false } })} />)
    const f = screen.getAllByTestId('ficou-no-ar')
    expect(f).toHaveLength(1)
    expect(f[0]!.textContent).toBe('O teste terminou em 24/10. Ficou no ar: a versão B.')
    expect(container.textContent).not.toContain('No ar agora')
    expect(screen.queryByTestId('winner-no-ar')).toBeNull()
    const linhaB = screen.getByRole('group', { name: 'Variante B' })
    expect(within(linhaB).getByText('No ar')).toBeTruthy()
    expect(within(screen.getByRole('group', { name: 'Variante A' })).queryByText('No ar')).toBeNull()
  })
  it('noAr.letra nulo: sem frase, sem selo, banner "No ar: não confirmado"', () => {
    render(<WinnerDetail view={W({ noAr: { letra: null, original: false } })} />)
    expect(screen.queryByTestId('ficou-no-ar')).toBeNull()
    expect(screen.queryByText('No ar')).toBeNull()
    expect(screen.getByTestId('winner-no-ar').textContent).toBe('No ar: não confirmado')
  })
  it('a fonte é o noAr, não o vencedor', () => {
    render(<WinnerDetail view={W({ winnerLabel: 'C', noAr: { letra: 'A', original: true } })} />)
    expect(screen.getByTestId('ficou-no-ar').textContent).toContain('a versão A.')
  })
  it('cabeçalho do Lab: selo Concluído em 24/10, sem ⓘ, Arquivar mantido, sem Duplicar nem Download', () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<WinnerDetail view={W({ noAr: { letra: 'B', original: false } })} />)
    expect(screen.getByTestId('selo-lab').textContent).toContain('Concluído em 24/10')
    expect(screen.queryByRole('button', { name: 'O que é este teste' })).toBeNull()
    expect(screen.queryByText('Duplicar')).toBeNull()
    expect(screen.queryByLabelText('Download')).toBeNull()
    const arq = screen.getByRole('button', { name: /Arquivar/ })
    expect(arq.className).toContain('min-h-[44px]')
    fireEvent.click(arq)
    expect(confirmar).toHaveBeenCalled()
    expect(archive).toHaveBeenCalledWith('test-1')
  })
})

describe('M7d T7: ConcluidoV2Detail', () => {
  it('não ganha a linha "Ficou no ar"; o "no ar" é o do desfecho', () => {
    const v = {
      id: 't1', videoTitle: 'Meu vídeo', flag: 'thumbnail', status: 'completed', outcome: 'winner', winnerLabel: 'B', winnerColor: '#888',
      lift: null, confidence: null, resultMeta: {}, variants: [], variantThumbs: [], totalRounds: 1, hasPlayoff: false, restoreSeq: 7,
      placar: null, faixa_dias: [], completedAt: '2026-10-24T12:00:00Z', noArAgora: null, activeNow: null, variantDb: [],
      v2: {
        fase: 'concluido', selo: { tipo: 'vence', provisorio: true, letra: 'B' },
        frase: { principal: 'B provavelmente vence.', apoio: 'x' }, prazo: { tipo: 'provisorio', ate: '04/11' }, noAr: { tipo: 'original' },
        aplicar: { variant_id: 'v-b', letra: 'B' }, voltar: false, aplicarDeNovo: null, bloqueio: null, n: 10, pisos: null, tentarDeNovo: false,
      },
    } as unknown as AbTestDetailView & { v2: never }
    render(<ConcluidoV2Detail view={v as never} />)
    expect(screen.queryByTestId('ficou-no-ar')).toBeNull()
    const tela = screen.getByTestId('tela-v2')
    expect(within(tela).queryAllByText(/no ar/i).length).toBeLessThanOrEqual(1)
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AbTestActiveView, DisplayLabel } from '@/lib/youtube/ab-types'

const siteAdmin = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => siteAdmin.value,
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }) }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  forceRotate: vi.fn(), acknowledgeAbTestDrift: vi.fn(), resumeAbTest: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/use-poll-stats', () => ({ usePollStats: vi.fn(() => ({ data: null, loading: false })) }))
vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({ YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</> }))

import { ActiveDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-detail'

afterEach(() => { cleanup(); vi.useRealTimers() })

function view(): AbTestActiveView {
  return {
    id: 'test-1', videoTitle: 'Vídeo X', flag: 'combo', status: 'active',
    variants: [
      { label: 'A', color: '#8A8F98', ctr: 0.05, impressions: 10000, clicks: 500, pBest: 0.3 },
      { label: 'B', color: '#E8823C', ctr: 0.07, impressions: 10000, clicks: 700, pBest: 0.7 },
    ],
    variantThumbs: [
      { label: 'A', color: '#8A8F98', thumbUrl: null, isOriginal: true },
      { label: 'B', color: '#E8823C', thumbUrl: 'https://example.com/b.jpg', isOriginal: false },
    ],
    variantDb: [
      { id: 'v1', label: 'A', is_original: true, blob_url: 'https://example.com/a.jpg', title_text: 'Título A', dimensions: '480x360' },
      { id: 'v2', label: 'B', is_original: false, blob_url: 'https://example.com/b.jpg', title_text: 'Título B', dimensions: null },
    ],
    noArAgora: { label: 'B', desde: '2026-10-07T08:00:00Z' },
    confTrend: [50, 65], daily: { A: [5], B: [6] } as Record<DisplayLabel, number[]>, abbaSeq: ['A', 'B'] as DisplayLabel[],
    cycles: { total: 6, done: 4 }, durationDays: 14, confidenceTarget: 0.95, totalRounds: 1, hasPlayoff: false, gates: [],
    confirmedData: { confidence: 88, leader: 'B' as DisplayLabel, leaderColor: '#E8823C', lift: 12.3 },
  } as unknown as AbTestActiveView
}

describe('ActiveDetail abre o diálogo novo com a ação por prop', () => {
  it('Encerrar abre o diálogo com o que está no ar e o aviso de baixa resolução; a ação vem da prop', async () => {
    const encerrar = vi.fn().mockResolvedValue({ ok: true, resultado: 'feito', campos: { thumbnail: { estado: 'falhou' } } })
    render(<ActiveDetail view={view()} encerrar={encerrar} pausar={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^Encerrar$/ }))
    expect(screen.getByRole('dialog', { name: 'Encerrar teste' })).toBeTruthy()
    expect(screen.getByText('O original foi guardado em baixa resolução.')).toBeTruthy()
    expect(screen.getByText(/desde 07\/10 05:00/)).toBeTruthy()
    await userEvent.click(within(screen.getByRole('dialog')).getByLabelText(/Variante B/))
    await userEvent.click(screen.getByRole('button', { name: 'Encerrar e ficar com B' }))
    expect(encerrar).toHaveBeenCalledWith({ destino: 'variante', varianteId: 'v2' })
    // recusa do YouTube: o diálogo fecha e o aviso de página (status) aparece, com fechar
    expect(screen.queryByRole('dialog')).toBeNull()
    const aviso = await screen.findByText('Teste encerrado. O YouTube recusou a troca da thumbnail: veja o aviso no topo.')
    expect(aviso.closest('[role="status"]')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))
    expect(screen.queryByText(/O YouTube recusou a troca/)).toBeNull()
  })

  it('o aviso some sozinho em 6 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const encerrar = vi.fn().mockResolvedValue({ ok: true, resultado: 'feito', campos: { title: { estado: 'falhou' } } })
    render(<ActiveDetail view={view()} encerrar={encerrar} pausar={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^Encerrar$/ }))
    await userEvent.click(within(screen.getByRole('dialog')).getByLabelText(/Variante B/))
    await userEvent.click(screen.getByRole('button', { name: 'Encerrar e ficar com B' }))
    expect(await screen.findByText(/recusou a troca do título/)).toBeTruthy()
    await act(async () => { vi.advanceTimersByTime(6_100) })
    expect(screen.queryByText(/recusou a troca/)).toBeNull()
  })

  it('Pausar usa a prop e mostra a recusa escrita', async () => {
    const pausar = vi.fn().mockResolvedValue({ ok: false, resultado: 'em_andamento', error: 'Outra tentativa está em andamento. Tente de novo em instantes.' })
    render(<ActiveDetail view={view()} encerrar={vi.fn()} pausar={pausar} />)
    await userEvent.click(screen.getByRole('button', { name: /^Pausar$/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Pausar teste' }))
    expect(pausar).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Outra tentativa está em andamento. Tente de novo em instantes.')).toBeTruthy()
  })

  it('sem permissão de administrar: variantes desabilitadas no diálogo', async () => {
    siteAdmin.value = false
    try {
      render(<ActiveDetail view={view()} encerrar={vi.fn()} pausar={vi.fn()} />)
      await userEvent.click(screen.getByRole('button', { name: /^Encerrar$/ }))
      expect(within(screen.getByRole('dialog')).getByLabelText(/Variante B/)).toHaveProperty('disabled', true)
    } finally { siteAdmin.value = true }
  })
})

describe('guarda de props (CLAUDE.md: ação por prop, nunca importada no client)', () => {
  const dir = join(__dirname, '../../src/app/cms/(authed)/youtube/ab-lab/_components')
  for (const f of ['ab-end-test-dialog.tsx', 'ab-confirmar-troca-dialog.tsx', 'ab-pause-dialog.tsx', 'active-detail.tsx']) {
    it(`${f} não importa server action`, () => {
      expect(readFileSync(join(dir, f), 'utf8')).not.toMatch(/\b(endAbTest|pauseAbTest)\b.*from|from '\.\.\/actions'.*\b(endAbTest|pauseAbTest)/)
    })
  }
})

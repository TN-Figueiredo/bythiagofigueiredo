// @vitest-environment jsdom
// A5 2ª leva, T5: a tela da numeração (P com "empate", chevrons, Direção ordenável, linha de ordem, legenda, faixa). Só dado sintético.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => true,
}))
import { render, screen, within } from '@testing-library/react'
import { a3World } from './a3-fixture'
import { medidasDoMotor } from './canais-e5a-fixture'
import { buildCanaisView, type CanaisParams } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import type { Observatory } from '@/lib/youtube/observatorio'
import type { Dataset } from '@/lib/youtube/observatorio/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(''),
}))
beforeEach(() => { document.getElementById('flut')?.remove() })

const DAY = 86_400_000
const ok = async () => ({ ok: true })
function retratos(ds: Dataset, id: string, de: number, ganho: number) {
  const ch = ds.channels.find(c => c.id === id)!
  const fim = ds.now
  ch.subs = de + ganho
  ch.snapshots = [
    { t: fim - 30 * DAY, date: new Date(fim - 30 * DAY).toISOString().slice(0, 10), subs: de, views: 1 },
    { t: fim, date: new Date(fim).toISOString().slice(0, 10), subs: de + ganho, views: 2 },
  ]
}
const comWorldEmpate = () => a3World(ds => {
  const [a, b, c, d] = ds.channels.filter(x => !x.own)
  retratos(ds, a!.id, 1_200_000, 0); retratos(ds, b!.id, 1_200_000, 10_000); retratos(ds, c!.id, 1_200_000, 60_000); retratos(ds, d!.id, 1_200_000, -60_000)
})
function montar(p: Partial<CanaisParams> = {}, obs: Observatory = a3World().obs) {
  const v = buildCanaisView(obs, { niche: 'todos', limit: 75, fmt: 'longos', medidas: medidasDoMotor(obs), ...p })
  return render(<ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><CanaisScreen view={v} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} /></div></ChromeSyncContext.Provider></ToastProvider>)
}

describe('tela da numeração', () => {
  it('P mostra "Nº" e "empate" embaixo; a dica do cabeçalho P tem o texto novo', () => {
    montar({ sort: 'growth' }, comWorldEmpate().obs)
    const p = screen.getAllByTestId('canais-p').find(td => td.textContent?.includes('empate'))!
    expect(p.textContent).toMatch(/^\d+º\s*empate$/)
    const tipP = document.querySelector('thead th.p .tip')!
    expect(tipP).not.toBeNull()
  })
  it('linha de ordem à letra', () => {
    montar({ sort: 'growth', dir: 'desc' }, comWorldEmpate().obs)
    expect(screen.getByTestId('canais-ordem').textContent).toBe('Ordenado por Crescimento, de quem mais ganhou a quem mais perdeu inscritos em 30 dias. Posição: 1º é o maior valor, em qualquer sentido. Empate: mesmo valor na tela, mesma posição.')
  })
  it('Direção é ordenável e o th ativo tem aria-sort e chevron; o inativo tem chevron duplo', () => {
    montar({ sort: 'direcao' })
    const th = screen.getByTestId('canais-th-direcao')
    expect(th.getAttribute('aria-sort')).toBe('descending')
    expect(th.querySelector('svg.chev')).not.toBeNull()
    expect(screen.getByTestId('canais-th-growth').getAttribute('aria-sort')).toBeNull()
    expect(screen.getByTestId('canais-th-growth').querySelectorAll('svg.chev path').length).toBe(2)
    expect(th.querySelectorAll('svg.chev path').length).toBe(1)
    expect(th.textContent).not.toMatch(/[▼▲]/)
  })
  it('faixa sem posição com os dois botões', () => {
    montar({ sort: 'growth', retratosProprios: new Map() })
    const f = screen.getByTestId('canais-faixa')
    expect(within(f).getByText('Seu canal ainda não tem Crescimento medido.')).toBeTruthy()
    expect(within(f).getByRole('link', { name: 'Ordenar por Inscritos' })).toBeTruthy()
    expect(within(f).getByRole('link', { name: 'Ordenar por Views/dia' })).toBeTruthy()
  })
  it('legenda da Direção e do Crescimento à letra', () => {
    const d = montar({ sort: 'direcao' })
    expect(screen.getByText('As setas ▲ ▼ valem só para a Direção, que mede views.')).toBeTruthy()
    expect(screen.getByText('▲ subindo, +10% ou mais')).toBeTruthy()
    d.unmount()
    montar({ sort: 'growth' })
    expect(screen.getByText('Crescimento mede inscritos e usa + e −. Setas ▲ ▼ ficam para a Direção, que mede views.')).toBeTruthy()
  })
})

// @vitest-environment jsdom
// 11b B3: a coluna Trocas da lista de Canais conta só título e thumbnail (a mesma conta da linha "Trocas de título e thumbnail" da comparação
// e do cabeçalho do canal): a troca de descrição não entra. Nulo continua nulo (canal próprio, primeira sincronização), nunca zero.
import { describe, it, expect, vi, afterEach } from 'vitest'

const siteAdmin = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => siteAdmin.value,
}))
import { cleanup, render, screen } from '@testing-library/react'
import { a3World } from './a3-fixture'
import { buildCanaisView, type CanaisParams, type CanaisRow, type CanaisSort, type CanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import { trocas30 } from '@/app/cms/(authed)/youtube/competitors/_canal/numeros'
import { numerosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import type { Observatory } from '@/lib/youtube/observatorio'

const replace = vi.fn(), refresh = vi.fn(), push = vi.fn(), prefetch = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push, prefetch, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(''),
}))

const BASE = a3World()
const view = (p: Partial<CanaisParams> = {}, obs: Observatory = BASE.obs) => buildCanaisView(obs, { niche: 'todos', limit: 75, ...p })
const all = (v: CanaisView): CanaisRow[] => [...v.list.ranked, ...v.list.unranked]
const byId = (v: CanaisView, id: string) => all(v).find(r => r.id === id)!
const ok = async () => ({ ok: true })
const mount = (v: CanaisView) => render(
  <ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><div data-obs-chrome=""><button type="button" aria-label="Mais ações">⋯</button></div>
    <CanaisScreen view={v} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} />
  </div></ChromeSyncContext.Provider></ToastProvider>,
)
afterEach(() => { document.getElementById('flut')?.remove() })

const concorrentes = (obs: Observatory) => obs.channels.filter(c => !c.own)
const tipos = (obs: Observatory, id: string) => obs.changesIn({ days: 30, channel: id }).map(c => c.type)
/** Um concorrente com troca de descrição na janela de 30 dias (sem isso, os testes abaixo não provariam nada). */
const comDescricao = (obs: Observatory) => concorrentes(obs).filter(c => tipos(obs, c.id).includes('desc'))

describe('11b B3: a coluna Trocas da lista não conta descrição', () => {
  it('o fixture tem concorrente com troca de descrição na janela (senão os outros testes não provam nada)', () => {
    const lista = comDescricao(BASE.obs)
    expect(lista.length).toBeGreaterThan(0)
    expect(lista.some(c => tipos(BASE.obs, c.id).filter(t => t !== 'desc').length > 0), 'e um que também tem título ou thumbnail').toBe(true)
    expect(lista.some(c => tipos(BASE.obs, c.id).every(t => t === 'desc')), 'e um que só tem descrição').toBe(true)
  })

  it('a célula e o valor de ordenação de CADA concorrente são a conta da função única (trocas30), a mesma da comparação e do cabeçalho', () => {
    for (const fmt of ['longos', 'todos', 'shorts'] as const) {
      const v = view({ fmt })
      for (const c of concorrentes(BASE.obs)) {
        const r = byId(v, c.id)
        if (r.cells.swap.kind === 'na') { expect(r.valor.swaps, c.id).toBeNull(); continue } // primeira sincronização: não medido (ver o teste de nulo)
        const n = trocas30(BASE.obs, c.id)
        expect(r.cells.swap.n, `${c.id} ${fmt}`).toBe(n)
        expect(r.valor.swaps, `${c.id} ${fmt} (ordenação)`).toBe(n)
        // a mesma conta da linha "Trocas de título e thumbnail em 30 dias" da comparação
        const cmp = numerosDoCanal(BASE.obs, c.id).trocas30
        expect(cmp.x, c.id).toBe(n)
      }
    }
  })

  it('a descrição saiu da conta: o canal com 1 troca de título e 1 de descrição mostra 1, e o que só tem descrição mostra 0 medido com "nenhuma de título ou thumbnail em 30 d"', () => {
    const v = view()
    const misto = comDescricao(BASE.obs).find(c => tipos(BASE.obs, c.id).some(t => t !== 'desc'))!
    const todas = tipos(BASE.obs, misto.id)
    const r = byId(v, misto.id)
    expect(r.cells.swap.kind === 'ok' && r.cells.swap.n).toBe(todas.filter(t => t !== 'desc').length)
    expect(r.cells.swap.kind === 'ok' && r.cells.swap.n).toBeLessThan(todas.length)
    const soDesc = comDescricao(BASE.obs).find(c => tipos(BASE.obs, c.id).every(t => t === 'desc'))!
    const s = byId(v, soDesc.id)
    expect(s.cells.swap.kind).toBe('ok')
    if (s.cells.swap.kind === 'ok') { expect(s.cells.swap.n).toBe(0); expect(s.cells.swap.last).toMatch(/^nenhuma de título ou thumbnail em 30\s?d$/); expect(s.cells.swap.lastTitle).toBeNull() }
    expect(s.valor.swaps, 'zero medido, não nulo').toBe(0)
  })

  it('o texto da última troca nunca fala de descrição (nem sozinha, nem "na mesma janela")', () => {
    for (const r of all(view())) if (r.cells.swap.kind === 'ok') {
      expect(r.cells.swap.last, r.id).not.toMatch(/descri/i)
      expect(r.cells.swap.lastTitle ?? '', r.id).not.toMatch(/descri/i)
    }
    // paddy-doyle: a troca mais recente é a de título; a de descrição fica de fora
    const p = byId(view(), 'paddy-doyle')
    expect(p.cells.swap.kind === 'ok' && p.cells.swap.last).toMatch(/^Título trocado/)
  })

  it('a ordenação por Trocas segue a conta nova (do maior para o menor, sem descrição) e o desempate não muda a ordem entre valores diferentes', () => {
    const sort: CanaisSort = 'swaps'
    for (const dir of ['desc', 'asc'] as const) {
      const v = view({ sort, dir })
      const vals = v.list.ranked.filter(r => !r.own).map(r => r.valor.swaps)
      expect(vals.every(x => x != null)).toBe(true)
      const nums = vals as number[]
      const ordenado = [...nums].sort((a, b) => (dir === 'desc' ? b - a : a - b))
      expect(nums).toEqual(ordenado)
    }
    // o canal com 7 no total (6 sem descrição) fica na frente de quem tem 2 (título e thumbnail) e a conta é 6, não 7
    const v = view({ sort, dir: 'desc' })
    expect(v.list.ranked[0]!.id).toBe('matt-wolfe')
    expect(v.list.ranked[0]!.valor.swaps).toBe(6)
  })

  it('nulo continua nulo: canal próprio e canal em primeira sincronização dizem a frase de sempre e não têm valor para ordenar', () => {
    const v = view()
    for (const o of BASE.obs.channels.filter(c => c.own)) {
      const r = byId(v, o.id)
      expect(r.cells.swap).toEqual({ kind: 'na', text: 'Suas trocas ficam no A/B Lab.' })
      expect(r.valor.swaps).toBeNull()
    }
    const bf = concorrentes(BASE.obs).find(c => byId(v, c.id).cells.swap.kind === 'na')
    expect(bf, 'o fixture tem um canal em primeira sincronização').toBeTruthy()
    const r = byId(v, bf!.id)
    expect(r.cells.swap).toEqual({ kind: 'na', text: 'Trocas são detectadas a partir de agora.' })
    expect(r.valor.swaps).toBeNull()
  })

  it('o cabeçalho da coluna diz "título e thumbnail" e a célula na tela mostra o número novo', () => {
    const v = view({ sort: 'swaps' })
    const { container } = mount(v)
    const th = container.querySelector('th[data-k="swaps"]')!
    expect(th.querySelector('button')!.textContent).toContain('Trocas')
    expect(th.querySelector('.unit')!.textContent).toBe('título e thumbnail, 30 d, longos e Shorts')
    expect(th.textContent).not.toMatch(/descri/i)
    const linha = container.querySelector(`tr[data-id="matt-wolfe"]`) ?? [...container.querySelectorAll('tbody tr')].find(tr => tr.textContent?.includes('Matt Wolfe'))!
    expect(linha.querySelector('.swap [data-k="sw"]')!.textContent).toBe('6')
    expect(screen.getAllByRole('columnheader').some(h => /Trocas/.test(h.textContent ?? ''))).toBe(true)
  })

  it('os cartões (janela estreita) mostram a mesma conta, pois leem a mesma célula', () => {
    const v = view()
    const { container } = mount(v)
    const cartoes = [...container.querySelectorAll('.swap [data-k="sw"]')]
    expect(cartoes.length).toBeGreaterThan(0)
    const valores = concorrentes(BASE.obs).filter(c => byId(v, c.id).cells.swap.kind === 'ok').map(c => String(trocas30(BASE.obs, c.id)))
    // cada número desenhado (tabela e cartões) é uma das contas novas; nenhum é a conta antiga de quem tem descrição
    for (const el of cartoes) expect(valores).toContain(el.textContent)
    expect(cartoes.some(el => el.textContent === '7'), 'matt-wolfe tinha 7 com a descrição').toBe(false)
  })

  it('I-11b-1: a célula sem troca diz do que fala ("de título ou thumbnail") e o cartão ganha a unidade da coluna', () => {
    const { container } = mount(view())
    const textos = [...container.querySelectorAll('.swap .last')].map(e => (e.textContent ?? '').replace(/\s+/g, ' ').trim())
    expect(textos.some(t => t === 'nenhuma de título ou thumbnail em 30 d'), 'há ao menos um canal sem troca no fixture').toBe(true)
    expect(textos.some(t => t === 'nenhuma em 30 d')).toBe(false)
    cleanup()
    const cartoes = mount(view({ layout: 'cards' })).container
    expect([...cartoes.querySelectorAll('.swap .last')].some(e => /^nenhuma de título ou thumbnail em 30\s?d$/.test((e.textContent ?? '').trim()))).toBe(true)
    const rotulos = [...cartoes.querySelectorAll('.l')].map(e => (e.textContent ?? '').replace(/\s+/g, ' ').trim()).filter(t => /^Trocas/.test(t))
    expect(rotulos.length).toBeGreaterThan(0)
    for (const t of rotulos) expect(t).toBe('Trocas de título e thumbnail, 30 d')
  })
})

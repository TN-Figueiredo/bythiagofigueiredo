// @vitest-environment jsdom
// apps/web/test/youtube/observatorio/mudancas-pin.test.tsx — the pin control on the Mudanças cards.
import { describe, it, expect, vi } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import type { ObsVideo } from '@/lib/youtube/observatorio/types'
import { buildMudancasView } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'
import { MudancasScreen } from '@/app/cms/(authed)/youtube/competitors/_mudancas/mudancas-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import type { PinAction } from '@/app/cms/(authed)/youtube/competitors/_chrome/pin-kit'
import type { PinResult } from '@/app/cms/(authed)/youtube/competitors/pin-result'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/mudancas', useSearchParams: () => new URLSearchParams(''),
}))

const SHOW = 'matt-opus55' // the oracle's showcase: several changes on one video
function mount(o: { patch?: Partial<ObsVideo>; p?: Record<string, string>; onPin?: PinAction } = {}) {
  const ds = datasetFromOracle(loadOracle())
  Object.assign(ds.videos.find(x => x.id === SHOW)!, o.patch ?? {})
  const obs = createObservatory(ds)
  const view = buildMudancasView(obs, { niche: 'todos', win: '90', video: SHOW, ...(o.p ?? {}) }, new Set())
  const r = render(<div data-obs=""><ToastProvider><MudancasScreen view={view} onPin={o.onPin ?? (async () => ({ ok: true }))} onUnpin={async () => ({ ok: true })} /></ToastProvider></div>)
  return { ...r, view, obs, cards: () => [...r.container.querySelectorAll<HTMLElement>('article.vid')] }
}
const CAP: PinResult = { ok: false, kind: 'cap', error: 'Sem vagas: 10 de 10 vídeos fixados em Matt Wolfe. Desafixe um para fixar outro.' }

describe('Mudanças: view model', () => {
  it('cada cartão leva o controle de fixar, se o vídeo é observado e, quando não é, o motivo dito uma vez', () => {
    const tracked = mount().view.heroes[0]!.video
    expect(tracked).toMatchObject({ observed: true, outNote: null }); expect(tracked.pin).toMatchObject({ videoId: SHOW, pinned: false, chips: [] })
    const out = mount({ patch: { tracked: false, series: [], firstIdx: null } })
    const v = out.view.heroes[0]!.video, ch = out.obs.channel(out.obs.video(SHOW)!.ch)!
    expect(v.observed).toBe(false)
    expect(v.outNote).toBe('Fora dos ' + ch.video_limit + ' mais recentes de ' + ch.name + ': o efeito destas trocas não é medido.')
    expect(v.pin!.chips).toEqual([{ kind: 'fora', label: 'Fora dos acompanhados', how: null }])
    expect(v.meta.join(' | ')).not.toMatch(/views/) // D11: the stored count is frozen
  })
  it('fixado fora dos N: views com a data da última conferência (D15); recém-fixado: sem views', () => {
    const at = Date.parse('2026-10-24T15:00:00.000Z') // 12:00 in São Paulo; the oracle's NOW is that day
    const on = mount({ patch: { tracked: false, pinned: true, pinState: 'ativo', checkedAt: at } }).view.heroes[0]!.video
    expect(on.meta.some(m => /^.+ views em 24\/10 12:00$/.test(m))).toBe(true)
    const fresh = mount({ patch: { tracked: false, pinned: true, pinState: 'aguardando-primeira', checkedAt: at - 864e5 } }).view.heroes[0]!.video
    expect(fresh.meta.join(' | ')).not.toMatch(/views/)
    expect(fresh.pin!.chips[0]!.kind).toBe('fixado-agora')
    // the one YouTube did not return was not checked either: no count, and its own chip
    const gone = mount({ patch: { tracked: false, pinned: true, pinState: 'sem-resposta', checkedAt: at - 864e5 } }).view.heroes[0]!.video
    expect(gone.meta.join(' | ')).not.toMatch(/views/)
    expect(gone.pin!.chips[0]).toEqual({ kind: 'sem-resposta', label: 'Fixado', how: 'o YouTube não devolveu este vídeo' })
  })
})

describe('Mudanças: cartão', () => {
  it('ordem no DOM do cabeçalho: canal, título, ações; a mensagem vem depois do cabeçalho; nenhum order em linha', async () => {
    const { cards } = mount({ onPin: async () => CAP })
    const card = cards()[0]!, head = card.querySelector('header.vid-h')!
    expect([...head.children].map(e => e.className.split(' ')[0])).toEqual(['av', 'who', 'acts'])
    expect([...head.querySelectorAll('.acts a,.acts button')].map(e => e.textContent)).toEqual(['Fixar vídeo', 'Ver histórico do vídeo', 'Abrir no YouTube'])
    await act(async () => { fireEvent.click(card.querySelector('[data-pin]')!) })
    const row = card.querySelector('.fx-row')!
    expect(row.querySelector('.fx-msg')!.getAttribute('data-fx-msg')).toBe('cap')
    expect(head.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(card.querySelector('[style*="order"]')).toBeNull()
  })
  it('os selos têm linha própria, a última de .who, que existe mesmo vazia (a altura dela é reservada)', () => {
    const { cards } = mount()
    const who = cards()[0]!.querySelector('.who')!
    expect(who.lastElementChild!.className).toBe('fx-chips')
    expect(who.querySelector('.fx-chips')!.children).toHaveLength(0)
    const pinned = mount({ patch: { pinned: true, pinState: 'ativo' } }).cards()[0]!
    expect([...pinned.querySelectorAll('.fx-chips .fx-chip')].map(e => e.getAttribute('data-fx'))).toEqual(['fixado'])
    expect(pinned.querySelector('.fx-chip')!.classList.contains('fx-sm')).toBe(true)
  })
  it('ordem por efeito: o mesmo vídeo em vários cartões tem nomes acessíveis únicos e nenhum id repetido', async () => {
    const { cards, container } = mount({ p: { sort: 'gain' }, onPin: async () => CAP })
    const mine = cards().filter(c => c.getAttribute('data-video') === SHOW)
    expect(mine.length).toBeGreaterThan(1)
    const names = mine.map(c => c.querySelector('[data-pin]')!.getAttribute('aria-label')!)
    expect(new Set(names).size).toBe(names.length)
    for (const n of names) expect(n).toMatch(/^Fixar vídeo: .+ \(.+\)$/)
    const keys = mine.map(c => c.querySelector('[data-pin]')!.getAttribute('data-fx-k'))
    expect(new Set(keys).size).toBe(keys.length)
    await act(async () => { fireEvent.click(mine[1]!.querySelector('[data-pin]')!) })
    expect(mine[1]!.querySelector('.fx-msg')).not.toBeNull(); expect(mine[0]!.querySelector('.fx-msg')).toBeNull()
    const ids = [...container.querySelectorAll('[id]')].map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(document.activeElement === mine[1]!.querySelector('[data-pin]') || document.activeElement === document.body).toBe(true)
  })
  it('vídeo fora dos observados: o motivo uma vez no cabeçalho, sem coluna de efeito, trocas em grade', () => {
    const { cards } = mount({ patch: { tracked: false, series: [], firstIdx: null } })
    const card = cards()[0]!
    expect(card.querySelectorAll('.fx-out-note')).toHaveLength(1)
    expect(card.querySelector('.effect')).toBeNull()
    expect(card.querySelector('.fx-grid')!.querySelectorAll('.chg.fx-noeff').length).toBeGreaterThan(0)
    expect(card.textContent!.match(/o efeito destas trocas não é medido/g)).toHaveLength(1)
  })
  it('regiões vivas da tela: uma de cada, vazias na carga; a linha de contagem continua região viva', () => {
    const { container } = mount()
    expect(container.querySelectorAll('#fx-status')).toHaveLength(1); expect(container.querySelector('#fx-alert')!.textContent).toBe('')
    expect(container.querySelector('[data-count-line]')!.getAttribute('aria-live')).toBe('polite')
  })
})

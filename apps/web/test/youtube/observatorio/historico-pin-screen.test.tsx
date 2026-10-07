// @vitest-environment jsdom
// apps/web/test/youtube/observatorio/historico-pin-screen.test.tsx — the pin control and the R117 notice on the history screen.
import { describe, it, expect, vi } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import type { ObsVideo, SyncState } from '@/lib/youtube/observatorio/types'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { HistoricoScreen } from '@/app/cms/(authed)/youtube/competitors/_historico/historico-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import type { PinAction } from '@/app/cms/(authed)/youtube/competitors/_chrome/pin-kit'
import type { PinResult } from '@/app/cms/(authed)/youtube/competitors/pin-result'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/video/x', useSearchParams: () => new URLSearchParams(''),
}))

const FULL = 'matt-opus55', UNTR = 'luke-damant-l71'
function mount(id: string, o: { patch?: Partial<ObsVideo>; sync?: SyncState; onPin?: PinAction; onUnpin?: PinAction } = {}) {
  const ds = datasetFromOracle(loadOracle())
  const v = ds.videos.find(x => x.id === id)!
  Object.assign(v, o.patch ?? {})
  if (o.sync) ds.channels.find(c => c.id === v.ch)!.sync.state = o.sync
  const obs = createObservatory(ds), view = buildHistoricoView(obs, id, {})
  const r = render(<div data-obs=""><ToastProvider><HistoricoScreen view={view} onPin={o.onPin ?? (async () => ({ ok: true }))} onUnpin={o.onUnpin ?? (async () => ({ ok: true }))} /></ToastProvider></div>)
  return { ...r, view, obs, root: r.container.querySelector('[data-obs-screen="historico"]')! }
}
const CAP: PinResult = { ok: false, kind: 'cap', error: 'Sem vagas: 10 de 10 vídeos fixados em Canal. Desafixe um para fixar outro.' }
/** Index of an element among all elements of the screen, in DOM order. */
const at = (root: Element, sel: string) => [...root.querySelectorAll('*')].indexOf(root.querySelector(sel)!)

describe('Histórico: cabeçalho em quatro blocos', () => {
  it('ordem no DOM = thumbnail, título, ações, fatos e selos; só o título vem antes do botão', () => {
    const { root } = mount(FULL)
    const order = ['.vhead .cur', '.vhead .vt', '.vhead .actions', '.vhead .vm'].map(s => at(root, s))
    expect(order.every(i => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    const kids = [...root.querySelector('.vhead')!.children].map(e => e.className.split(' ')[0])
    expect(kids).toEqual(['cur', 'vt', 'actions', 'vm'])
    // nothing focusable between the top of the header and the pin button
    const focusables = [...root.querySelector('.vhead')!.querySelectorAll('a[href],button')]
    expect(focusables[0]!.getAttribute('data-pin')).toBe(FULL)
  })
  it('a linha de ações é Fixar vídeo e Abrir no YouTube; a mensagem nasce abaixo dela e antes da forja; não há Salvar (V7)', async () => {
    const { root } = mount(FULL, { onPin: async () => CAP })
    const row = root.querySelector('.actions .arow')!
    expect([...row.querySelectorAll('a,button')].map(e => e.textContent)).toEqual(['Fixar vídeo', 'Abrir no YouTube'])
    expect(root.querySelector('.actions')!.textContent).not.toMatch(/Salvar/)
    expect(root.querySelector('.actions .fx-under')!.children).toHaveLength(0)
    await act(async () => { fireEvent.click(root.querySelector('[data-pin]')!) })
    const msg = root.querySelector('.actions .fx-under .fx-msg')!
    expect(msg.getAttribute('data-fx-msg')).toBe('cap')
    expect(at(root, '.actions .arow')).toBeLessThan(at(root, '.fx-msg'))
    if (root.querySelector('.actions .frow')) expect(at(root, '.fx-msg')).toBeLessThan(at(root, '.actions .frow'))
  })
  it('regiões vivas existem vazias na carga, uma de cada, e os ids da tela não se repetem', () => {
    const { container } = mount(FULL)
    expect(container.querySelector('#fx-status')!.textContent).toBe(''); expect(container.querySelector('#fx-alert')!.textContent).toBe('')
    const ids = [...container.querySelectorAll('[id]')].map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('vídeo de canal próprio: sem controle de fixar', () => {
    const base = createObservatory(datasetFromOracle(loadOracle()))
    const own = base.videos.find(x => base.channel(x.ch)!.own)!
    const { root } = mount(own.id)
    expect(root.querySelector('[data-pin]')).toBeNull()
    expect(root.querySelector('.actions .arow')!.textContent).toBe('Abrir no YouTube')
  })
})

describe('Histórico: o estado fixado é dito uma vez, pelo selo', () => {
  it('fixado fora dos N: dois selos na linha de selos, e o botão diz "Desafixar" (não "Fixado")', () => {
    const { root, view } = mount(UNTR, { patch: { pinned: true, pinState: 'ativo' } })
    const chips = [...root.querySelectorAll('.vm .counts .fx-chip')].map(e => e.getAttribute('data-fx'))
    expect(chips).toEqual(['fixado', 'fora-dos-n'])
    expect(root.querySelector('[data-pin]')!.textContent).toBe('Desafixar')
    expect(root.textContent!.match(/Fixado/g)).toHaveLength(1)
    expect(view.untracked).toBeNull()
  })
  it('recém-fixado: "Fixado agora", sem fato de views nem de sincronização no cabeçalho', () => {
    const { root } = mount(UNTR, { patch: { pinned: true, pinState: 'aguardando-primeira' } })
    expect(root.querySelector('.fx-chip[data-fx="fixado-agora"]')!.textContent).toBe('Fixado agora, a primeira conferência acontece em até 6 h')
    expect(root.querySelector('.vm .facts')!.textContent).not.toMatch(/views|sincroniz/i)
  })
  it('recém-fixado com o canal em erro: o selo fala da sincronização, sem prazo (V8)', () => {
    const { root } = mount(UNTR, { patch: { pinned: true, pinState: 'aguardando-primeira' }, sync: 'erro' })
    expect(root.querySelector('.fx-chip[data-fx="fixado-agora"]')!.textContent).toBe('Fixado agora, sincronização do canal com erro')
    expect(root.textContent).not.toContain('em até 6 h')
  })
})

describe('Histórico: fixado que o YouTube não devolveu (sem-resposta)', () => {
  it('selo neutro com a frase curta, sem prazo; sem fato de views nem de sincronização (ninguém conferiu)', () => {
    const { root } = mount(UNTR, { patch: { pinned: true, pinState: 'sem-resposta' } })
    expect(root.querySelector('.fx-chip[data-fx="sem-resposta"]')!.textContent).toBe('Fixado, o YouTube não devolveu este vídeo')
    expect(root.querySelector('.vm .facts')!.textContent).not.toMatch(/views|sincroniz/i)
    expect(root.textContent).not.toMatch(/em até 6 h|conferido a cada/)
    expect(root.querySelector('[data-pin]')!.textContent).toBe('Desafixar')
  })
})

describe('Histórico: vídeo fora dos observados (R117)', () => {
  it('aviso em texto logo abaixo do cabeçalho, com a primeira frase em destaque; sem link dentro (a ação está no cabeçalho)', () => {
    const { root } = mount(UNTR)
    const n = root.querySelector('.fx-notice')!
    expect(n.querySelector('strong')!.textContent).toMatch(/^Este vídeo está fora dos \d+ mais recentes acompanhados de .+\.$/)
    expect(n.querySelector('a,button')).toBeNull()
    expect(at(root, '.vhead')).toBeLessThan(at(root, '.fx-notice'))
    expect(at(root, '.fx-notice')).toBeLessThan(at(root, '.timeline'))
  })
  it('o cabeçalho não mostra views, sincronização, multiplicador nem contagens; o botão de fixar está lá', () => {
    const { root } = mount(UNTR)
    expect(root.querySelector('.vm .facts')!.textContent).not.toMatch(/views|sincroniz|multiplicador|vs vídeos/i)
    expect(root.querySelector('.vm .counts')).toBeNull()
    expect(root.querySelector('[data-pin]')!.textContent).toBe('Fixar vídeo')
  })
  it('faixas com o eixo próprio: título da seção, uma marca por rótulo do eixo, primeira e última sempre visíveis', () => {
    const { root, view } = mount(UNTR)
    expect(root.querySelector('#hv-tlh')!.textContent).toBe('Trocas de título, thumbnail e descrição')
    const axis = root.querySelector('.lane-axis.fx-axis')!
    expect(axis.querySelectorAll('i')).toHaveLength(view.lanesAxis!.ticks.length)
    const labels = [...axis.querySelectorAll('span')].map(e => e.textContent)
    expect(labels[0]).toBe(view.lanesAxis!.ticks[0]!.label); expect(labels.at(-1)).toBe(view.lanesAxis!.ticks.at(-1)!.label)
    expect(root.querySelectorAll('.lanes [data-lane]')).toHaveLength(3)
  })
})

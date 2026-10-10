// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, cleanup, fireEvent } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { montarLista } from '@/app/cms/(authed)/youtube/competitors/_canal/lista'
import { mountCanal, comAntigos, cartoes, norm } from './canal-mount'

const push = vi.fn(), replace = vi.fn(), refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/matt-wolfe',
  useSearchParams: () => new URLSearchParams(''),
}))

const statusEl = () => document.querySelector<HTMLElement>('p.cv-status')!
const urlNow = () => new URL(window.location.href).searchParams
const botao = () => screen.queryByRole('button', { name: /^Carregar / })
// 120 acompanhados + 82 antigos = 202: o canal do mockup (51 de 133) em outra escala
const ANT = 82, ACOMP = 120, TOTAL = ACOMP + ANT

beforeEach(() => { push.mockReset(); replace.mockReset(); refresh.mockReset(); window.history.replaceState(null, '', '/cms/youtube/competitors/canal/matt-wolfe') })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('"Carregar mais"', () => {
  it('o bloco tem role=progressbar com aria-valuenow e aria-valuemax, "Mostrando 120 de 202 vídeos" e a frase do que vem', () => {
    mountCanal({ mut: comAntigos(ANT) })
    expect(cartoes()).toHaveLength(ACOMP)
    const bloco = screen.getByRole('group', { name: 'Carregar mais vídeos' })
    const barra = within(bloco).getByRole('progressbar')
    expect(barra.getAttribute('aria-valuenow')).toBe(String(ACOMP))
    expect(barra.getAttribute('aria-valuemax')).toBe(String(TOTAL))
    expect(barra.getAttribute('aria-valuemin')).toBe('0')
    expect(within(bloco).getByText(`Mostrando ${ACOMP} de ${TOTAL} vídeos`)).not.toBeNull()
    expect(within(bloco).getByText('Mais 40 vídeos antigos, sem contagem diária. Depois deste lote faltam 42.')).not.toBeNull()
  })

  it('o botão é o único preenchido da tela e tem 44 px de altura', () => {
    mountCanal({ mut: comAntigos(ANT) })
    const preenchidos = document.querySelectorAll('.pri')
    expect(preenchidos).toHaveLength(1)
    expect(preenchidos[0]).toBe(screen.getByRole('button', { name: 'Carregar mais 40 vídeos' }))
    const css = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_canal/canal.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toMatch(/\.cv-more \.pri\{[^}]*min-height:44px/)
  })

  it('o clique revela 40 sob o divisor "Mais antigos, sem contagem diária (82)", com o aviso da contagem antiga', () => {
    mountCanal({ mut: comAntigos(ANT) })
    fireEvent.click(botao()!)
    expect(cartoes()).toHaveLength(ACOMP + 40)
    const h3 = screen.getByRole('heading', { level: 3, name: /^Mais antigos, sem contagem diária/ })
    expect(norm(h3.textContent)).toBe('Mais antigos, sem contagem diária (82)')
    const li = h3.closest('li')!
    expect(norm(li.textContent)).toContain('a contagem de views deles é antiga; não há views por dia, e o múltiplo é o de quando foram contados')
    // os 40 vêm depois do divisor, e os acompanhados ficam acima
    const cs = cartoes()
    expect(li.compareDocumentPosition(cs[ACOMP]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(li.compareDocumentPosition(cs[ACOMP - 1]!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    // o antigo sem contagem de views diz o motivo em vez de números
    expect(cs[ACOMP]!.querySelector('.cv-nums .cv-c.s3 .obs-ch-nm, .cv-nums .cv-c .obs-ch-nm')).not.toBeNull()
  })

  it('depois do clique o foco vai para o primeiro cartão novo, com preventScroll', () => {
    mountCanal({ mut: comAntigos(ANT) })
    const spy = vi.spyOn(HTMLElement.prototype, 'focus')
    fireEvent.click(botao()!)
    const novo = cartoes()[ACOMP]!.querySelector('a.cv-lnk')!
    const chamadas = spy.mock.calls.map((args, i) => ({ args, el: spy.mock.contexts[i] as HTMLElement }))
    const foco = chamadas.find(c => c.el === novo)
    expect(foco, 'focus() no primeiro cartão novo').toBeTruthy()
    expect(foco!.args[0]).toEqual({ preventScroll: true })
    expect(document.activeElement).toBe(novo)
  })

  it('o status anuncia "Mostrando 160 de 202 vídeos. 40 vídeos antigos carregados."', () => {
    mountCanal({ mut: comAntigos(ANT) })
    fireEvent.click(botao()!)
    expect(norm(statusEl().textContent)).toBe(`Mostrando ${ACOMP + 40} de ${TOTAL} vídeos. 40 vídeos antigos carregados.`)
  })

  it('n vai para a URL (?n=40) sem navegar', () => {
    mountCanal({ mut: comAntigos(ANT) })
    const replaceState = vi.spyOn(window.history, 'replaceState')
    fireEvent.click(botao()!)
    expect(urlNow().get('n')).toBe('40')
    expect(replaceState).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled()
  })

  it('no último lote o rótulo é "Carregar os últimos 2 vídeos" e depois o botão some', () => {
    mountCanal({ mut: comAntigos(ANT) })
    fireEvent.click(botao()!)
    expect(screen.getByText(`Mostrando ${ACOMP + 40} de ${TOTAL} vídeos`)).not.toBeNull()
    expect(botao()!.textContent).toBe('Carregar mais 40 vídeos')
    fireEvent.click(botao()!)
    expect(botao()!.textContent).toBe('Carregar os últimos 2 vídeos')
    fireEvent.click(botao()!)
    expect(cartoes()).toHaveLength(TOTAL)
    expect(botao()).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(norm(statusEl().textContent)).toBe(`Mostrando ${TOTAL} de ${TOTAL} vídeos. 2 vídeos antigos carregados. Não falta nenhum.`)
  })

  it('o último vídeo que falta: "Carregar o último vídeo" e "1 vídeo antigo carregado"', () => {
    mountCanal({ mut: comAntigos(41) })
    fireEvent.click(botao()!)
    expect(botao()!.textContent).toBe('Carregar o último vídeo')
    fireEvent.click(botao()!)
    expect(norm(statusEl().textContent)).toBe(`Mostrando ${ACOMP + 41} de ${ACOMP + 41} vídeos. 1 vídeo antigo carregado. Não falta nenhum.`)
  })

  it('nada carrega sozinho: nenhum IntersectionObserver é criado', () => {
    const io = vi.fn()
    vi.stubGlobal('IntersectionObserver', io)
    mountCanal({ mut: comAntigos(ANT) })
    fireEvent.click(botao()!)
    expect(io).not.toHaveBeenCalled()
    expect(cartoes()).toHaveLength(ACOMP + 40)
  })

  it('abrir já com ?n=80 mostra os 80 antigos sem clique (o Voltar reabre a grade igual)', () => {
    mountCanal({ mut: comAntigos(ANT), sp: { n: '80' } })
    expect(cartoes()).toHaveLength(ACOMP + 80)
    expect(botao()!.textContent).toBe('Carregar os últimos 2 vídeos')
  })

  it('mudar o filtro volta aos acompanhados (n zera); mudar a vista mantém o que foi carregado', () => {
    mountCanal({ mut: comAntigos(ANT), sp: { n: '40' } })
    expect(cartoes()).toHaveLength(ACOMP + 40)
    fireEvent.click(within(screen.getByRole('group', { name: 'Vista' })).getByRole('button', { name: /Lista/ }))
    expect(urlNow().get('n')).toBe('40')
    fireEvent.click(screen.getByRole('button', { name: /^Longos, / }))
    expect(urlNow().has('n')).toBe(false)
  })

  it('filtro ou busca que só casa vídeos antigos: a frase e o bloco aparecem', () => {
    const { view } = mountCanal({ mut: comAntigos(ANT), sp: { q: 'zzqxnaoexiste' } })
    // nenhum título casa: sem bloco; com o título de um antigo, só o bloco
    expect(montarLista(view.videos.videos, view.state).mais).toBeNull()
    cleanup()
    let alvo = ''
    mountCanal({ mut: (ds, id) => { comAntigos(ANT)(ds, id); const o = ds.videos.find(v => v.ch === id && !v.tracked)!; alvo = o.id; o.title = 'japao antigo' }, sp: { q: 'japao' } })
    expect(alvo).not.toBe('')
    expect(cartoes()).toHaveLength(0)
    expect(screen.getByText('Nenhum dos vídeos acompanhados tem “japao”. Há 1 vídeo antigo, sem contagem diária.')).not.toBeNull()
    expect(botao()!.textContent).toBe('Carregar o último vídeo')
  })
})

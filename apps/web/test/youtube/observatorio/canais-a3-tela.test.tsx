// @vitest-environment jsdom
// A3 Tarefa 3: a lista única na tela: posição, canal próprio na posição dele, bloco "Seus canais", linha presa e busca.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => true,
}))
import { render, screen, within, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { a3World } from './a3-fixture'
import { buildCanaisView, type CanaisParams, type CanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import { forbiddenVocabulary } from './audits'
import { motivoTexto } from '@/app/cms/(authed)/youtube/competitors/_canais/posicao-model'
import type { Observatory } from '@/lib/youtube/observatorio'

const replace = vi.fn(), refresh = vi.fn(), push = vi.fn(), prefetch = vi.fn()
let search = 'fmt=longos'
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push, prefetch, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(search),
}))

const BASE = a3World()
const ok = async () => ({ ok: true })
const view = (p: Partial<CanaisParams> = {}, obs: Observatory = BASE.obs) => buildCanaisView(obs, { niche: 'todos', limit: 75, fmt: 'longos', ...p })
const ordem = (v: CanaisView) => [...v.list.ranked, ...v.list.unranked].map(r => r.id)
const tree = (v: CanaisView, extra?: { titulo?: boolean; main?: boolean }) => {
  const tela = (
    <ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><div data-obs-chrome="">
      {extra?.titulo ? <h2>Canais</h2> : null}
      <button type="button" aria-label="Mais ações">⋯</button></div>
      <CanaisScreen view={v} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} />
    </div></ChromeSyncContext.Provider></ToastProvider>
  )
  return extra?.main ? <main style={{ overflowY: 'auto' }}>{tela}</main> : tela
}
const mount = (p: Partial<CanaisParams> = {}, obs?: Observatory, extra?: { titulo?: boolean; main?: boolean }) => {
  search = `fmt=${p.fmt ?? 'longos'}${p.layout ? '&layout=' + p.layout : ''}`
  return render(tree(view(p, obs), extra))
}
const linhas = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('tbody tr.row')]
const cel = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`tr.row[data-id="${id}"] td.p`)!
const semOwn = (ds: { channels: Array<{ id: string; own: boolean }>; videos: Array<{ ch: string }> }) => {
  const own = new Set(ds.channels.filter(c => c.own).map(c => c.id))
  ds.channels = ds.channels.filter(c => !own.has(c.id)); ds.videos = ds.videos.filter(x => !own.has(x.ch))
}

// IntersectionObserver de mentira: o jsdom não tem; cada teste decide o que está à vista
class FakeIO {
  static vivos: FakeIO[] = []
  alvos = new Set<Element>()
  constructor(public cb: IntersectionObserverCallback, public opts?: IntersectionObserverInit) { FakeIO.vivos.push(this) }
  observe(t: Element) { this.alvos.add(t) }
  unobserve(t: Element) { this.alvos.delete(t) }
  disconnect() { this.alvos.clear() }
  takeRecords() { return [] }
  static emitir(el: Element, isIntersecting: boolean) {
    const io = FakeIO.vivos.find(x => x.alvos.has(el))
    if (!io) throw new Error('nenhum observador para o elemento')
    act(() => { io.cb([{ target: el, isIntersecting } as IntersectionObserverEntry], io as unknown as IntersectionObserver) })
  }
}

const scrollIntoView = vi.fn()
beforeEach(() => {
  replace.mockReset(); refresh.mockReset(); push.mockReset(); prefetch.mockReset(); scrollIntoView.mockReset()
  FakeIO.vivos = []
  Element.prototype.scrollIntoView = scrollIntoView
  const m = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) }, clear: () => m.clear() })
})
afterEach(() => { vi.unstubAllGlobals(); document.getElementById('flut')?.remove() })

describe('A3.3 a lista única na tabela', () => {
  it('a tabela não tem linhas de grupo por nicho; as linhas vêm na ordem de view.list.ranked e depois o divisor e as sem medida', () => {
    const v = view()
    expect(v.list.unranked.length).toBeGreaterThan(0)
    const { container } = mount()
    expect(linhas(container).map(r => r.dataset.id)).toEqual(ordem(v))
    expect(container.querySelectorAll('tr.group:not([data-divisor])')).toHaveLength(0)
    expect(container.querySelector('[data-own-group]')).toBeNull()
    // o divisor está entre a última com medida e a primeira sem
    const corpo = [...container.querySelectorAll('tbody tr')]
    const iDiv = corpo.findIndex(r => r.hasAttribute('data-divisor'))
    expect(iDiv).toBe(v.list.ranked.length)
    expect((corpo[iDiv + 1] as HTMLElement).dataset.id).toBe(v.list.unranked[0]!.id)
  })
  it('a coluna de posição mostra "13º" com "(empate)" para leitor de tela; linha sem posição tem "sem posição" só para leitor', () => {
    const w = a3World(ds => {
      const [a, b] = ds.channels.filter(c => !c.own && c.subs != null)
      a!.subs = 777000; b!.subs = 777000
    })
    const v = view({ sort: 'subs' }, w.obs)
    const empatados = v.list.ranked.filter(r => r.pos?.empate)
    expect(empatados).toHaveLength(2)
    const { container } = mount({ sort: 'subs' }, w.obs)
    const th = container.querySelector('thead th.p')!
    expect(th.textContent).toBe('Posição')
    for (const r of v.list.ranked.filter(x => x.pos)) {
      const td = cel(container, r.id)
      expect(td.textContent).toBe(`${r.pos!.pos}º${r.pos!.empate ? ' (empate)' : ''}`)
      if (r.pos!.empate) expect(td.querySelector('.sr')!.textContent).toBe(' (empate)')
    }
    // ordenação sem posição escrita: toda linha diz "sem posição" só para o leitor, e nada visível
    const { container: c2 } = mount({ sort: 'active' }, w.obs)
    const td = c2.querySelector<HTMLElement>('tr.row td.p')!
    expect(td.querySelector('.sr')!.textContent).toBe('sem posição')
    expect(td.querySelector('[aria-hidden]')).toBeNull()
  })
  it('a linha do canal próprio fica na posição dela, com o selo "seu canal" e a classe do fio; não se repete no topo da tabela', () => {
    const v = view({ sort: 'subs' })
    const donos = v.list.ranked.filter(r => r.own).map(r => r.id)
    const { container } = mount({ sort: 'subs' })
    const rs = linhas(container)
    const primeira = rs[0]!
    expect(primeira.classList.contains('you')).toBe(false)
    for (const id of donos) {
      const tr = container.querySelectorAll(`tr.row[data-id="${id}"]`)
      expect(tr).toHaveLength(1)
      expect(rs.indexOf(tr[0] as HTMLElement)).toBe(v.list.ranked.findIndex(r => r.id === id))
      expect(tr[0]!.classList.contains('you')).toBe(true)
      expect(tr[0]!.getAttribute('tabindex')).toBe('-1')
      expect(tr[0]!.querySelector('.youtag')!.textContent).toBe('seu canal')
    }
    expect(container.querySelectorAll('tr.row.you')).toHaveLength(donos.length)
  })
  it('o divisor "Ainda sem medida para ordenar (N)" é uma linha de grupo (th scope="rowgroup") com a nota', () => {
    const v = view()
    const { container } = mount()
    const d = container.querySelector('tr.group[data-divisor] th')!
    expect(d.getAttribute('scope')).toBe('rowgroup')
    expect(d.getAttribute('colspan'), 'o divisor cobre todas as colunas, inclusive "Com o meu canal"').toBe(String(container.querySelectorAll('thead th').length))
    expect(d.textContent).toContain(v.list.divisor!.titulo)
    expect(d.textContent).toContain(v.list.divisor!.nota)
    // sem ninguém sem medida, sem divisor
    const w = a3World(ds => { ds.channels = ds.channels.filter(c => c.id !== 'vou-sem-volta'); ds.videos = ds.videos.filter(x => x.ch !== 'vou-sem-volta') })
    const v2 = view({}, w.obs)
    expect(v2.list.unranked.length, 'o mundo sem o canal sem medida não tem ninguém sem medida').toBe(0)
    const { container: c2 } = mount({}, w.obs)
    expect(c2.querySelector('[data-divisor]')).toBeNull()
  })
  it('uma linha ordenada SEM posição (canal próprio sem nicho num nicho escolhido) desenha sem quebrar, com "sem posição" e um traço visível', () => {
    const w = a3World(undefined, 'mix')
    const v = view({ niche: 'viagem', sort: 'subs' }, w.obs)
    const r = v.list.ranked.find(x => x.id === 'mochila-leve')!
    expect(r.pos).toBeNull()
    const { container } = mount({ niche: 'viagem', sort: 'subs' }, w.obs)
    const td = cel(container, 'mochila-leve')
    expect(td.querySelector('.sr')!.textContent).toBe('sem posição')
    expect(td.querySelector('[aria-hidden="true"]')!.textContent).toBe('–')
    expect(linhas(container).map(x => x.dataset.id)).toEqual(ordem(v))
  })
})

describe('A3.3 bloco "Seus canais"', () => {
  it('bloco "Seus canais": título, uma linha por canal, "Ir até a linha" e "Abrir meu canal"; a linha fina não tem avatar, selo nem botão grande', () => {
    const w = a3World(ds => { const id = ds.channels.filter(c => c.own)[0]!.id; ds.videos = ds.videos.filter(x => x.ch !== id) })
    const v = view({}, w.obs)
    const b = v.own.block!
    const { container } = mount({}, w.obs)
    const sec = container.querySelector('[data-own-block]')!
    expect(sec.querySelector('h2')!.textContent).toBe(b.titulo)
    const lis = [...sec.querySelectorAll('li')]
    expect(lis).toHaveLength(b.linhas.length)
    b.linhas.forEach((l, i) => {
      const li = lis[i]!
      if (l.tipo === 'fina') {
        expect(li.classList.contains('fina')).toBe(true)
        expect(li.textContent).toContain(l.texto)
        expect(li.querySelector('.av, [data-avatar], .youtag, .btn')).toBeNull()
        expect(within(li).getAllByRole('button').map(x => x.textContent)).toEqual(['Ir até a linha'])
      } else {
        expect(li.querySelector('[data-avatar]')).not.toBeNull()
        expect(li.querySelector('.youtag')!.textContent).toBe('seu canal')
        expect(li.textContent).toContain(l.frase)
        if (l.vizinhos) expect(li.textContent).toContain(l.vizinhos)
        expect(within(li).getAllByRole('button').map(x => x.textContent)).toEqual(['Ir até a linha', 'Abrir meu canal'])
      }
    })
    expect(forbiddenVocabulary(sec as HTMLElement)).toEqual([])
  })
  it('"Abrir meu canal" abre o painel lateral do canal próprio (A3: o mesmo de hoje)', async () => {
    const user = userEvent.setup()
    mount()
    const alvo = view().own.block!.linhas.find(l => l.tipo === 'cheia')!
    await user.click(screen.getAllByRole('button', { name: /^Abrir meu canal/ })[0]!)
    expect(replace).toHaveBeenCalledTimes(1)
    expect(String(replace.mock.calls[0]![0])).toContain(`channel=${alvo.id}`)
    expect(push).not.toHaveBeenCalled()
  })
  it('"Ir até a linha" rola o contêiner que rola e põe o foco na linha (tabIndex -1); com busca ativa que esconde a linha, limpa a busca antes', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    const id = view().own.block!.linhas[0]!.id
    await user.click(container.querySelector<HTMLElement>(`[data-own-block] li button[aria-label^="Ir até a linha"]`)!)
    const tr = container.querySelector<HTMLElement>(`tr.row[data-id="${id}"]`)!
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(tr)
    expect(document.activeElement).toBe(tr)
    // com busca que esconde a linha
    scrollIntoView.mockReset()
    const caixa = screen.getByRole('searchbox', { name: 'Buscar canal' }) as HTMLInputElement
    await user.type(caixa, 'leo khev')
    expect(container.querySelector(`tr.row[data-id="${id}"]`)).toBeNull()
    await user.click(container.querySelector<HTMLElement>(`[data-own-block] li button[aria-label^="Ir até a linha"]`)!)
    await waitFor(() => expect(document.activeElement).toBe(container.querySelector(`tr.row[data-id="${id}"]`)))
    expect(caixa.value).toBe('')
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })
  it('com a árvore antiga escondida no DOM (Voltar do Next 16), "Ir até a linha" acha a linha da árvore à vista, por ref', async () => {
    const user = userEvent.setup()
    const antiga = mount()
    antiga.container.style.display = 'none'
    const nova = mount()
    const id = view().own.block!.linhas[0]!.id
    await user.click(nova.container.querySelector<HTMLElement>('[data-own-block] li button[aria-label^="Ir até a linha"]')!)
    expect(document.activeElement).toBe(nova.container.querySelector(`tr.row[data-id="${id}"]`))
    expect(antiga.container.contains(document.activeElement)).toBe(false)
  })
  it('site sem canal próprio: sem bloco, sem linha presa, sem selo', () => {
    const w = a3World(semOwn)
    vi.stubGlobal('IntersectionObserver', FakeIO)
    const { container } = mount({}, w.obs)
    expect(container.querySelector('[data-own-block]')).toBeNull()
    expect(container.querySelector('.cn-pin')).toBeNull()
    expect(container.querySelector('.youtag, tr.row.you')).toBeNull()
    expect(linhas(container).length).toBe(w.obs.channels.length)
  })
  it('bloco sem linhas (todos os canais próprios em outro nicho): desenha o título e as partes, sem lista, sem linha presa e sem quebrar', () => {
    const v = view({ niche: 'ia' }, a3World(undefined, '1').obs)
    expect(v.own.block!.linhas).toEqual([])
    vi.stubGlobal('IntersectionObserver', FakeIO)
    const { container } = mount({ niche: 'ia' }, a3World(undefined, '1').obs)
    const sec = container.querySelector('[data-own-block]')!
    expect(sec.querySelector('h2')!.textContent).toBe(v.own.block!.titulo)
    expect(sec.querySelector('ul')).toBeNull()
    expect(sec.textContent).toContain('nenhum de IA')
    expect(container.querySelector('.cn-pin')).toBeNull()
  })
  it('nicho Todos: o aviso da posição geral aparece sob o controle; dentro de um nicho, não', () => {
    const { container, unmount } = mount()
    expect(container.querySelector('[data-k="conjunto-aviso"]')!.textContent).toBe(view().conjuntoAviso)
    unmount()
    const { container: c2 } = mount({ niche: 'viagem' })
    expect(c2.querySelector('[data-k="conjunto-aviso"]')).toBeNull()
  })
})

describe('A3.3 cartões', () => {
  it('cartões: mesma ordem, o cartão do canal próprio na posição dele com "Você está na 10ª posição de 14 em Viagem nesta ordenação."; o cartão NÃO se repete no topo', () => {
    const v = view({ niche: 'viagem', layout: 'cards' })
    const { container } = mount({ niche: 'viagem', layout: 'cards' })
    expect([...container.querySelectorAll<HTMLElement>('article.card')].map(a => a.dataset.id)).toEqual(ordem(v))
    expect(container.querySelector('[data-own-group]')).toBeNull()
    const dono = v.list.ranked.find(r => r.own && r.pos)!
    const card = container.querySelectorAll(`article.card[data-id="${dono.id}"]`)
    expect(card).toHaveLength(1)
    expect(card[0]!.classList.contains('you')).toBe(true)
    expect(card[0]!.getAttribute('tabindex')).toBe('-1')
    expect(card[0]!.querySelector('.voce')!.textContent).toBe(`Você está na ${dono.pos!.pos}ª posição de ${dono.pos!.de} em Viagem nesta ordenação.`)
    // card de concorrente não tem a frase
    expect(container.querySelector('article.card:not(.you) .voce')).toBeNull()
    // o divisor da lista de cartões
    expect(container.querySelector('.cardsep[data-divisor]')!.textContent).toContain('Ainda sem medida para ordenar')
  })
  it('cartão do canal próprio sem posição diz o motivo, nunca uma posição', () => {
    const w = a3World(undefined, 'mix')
    const { container } = mount({ niche: 'viagem', sort: 'subs', layout: 'cards' }, w.obs)
    expect(container.querySelector('article.card[data-id="mochila-leve"] .voce')!.textContent).toBe('Sem posição dentro de um nicho: escolha o nicho do canal para ver a posição.')
  })
})

describe('A3.3 linha presa no pé', () => {
  const montaComIO = (p: Partial<CanaisParams> = {}) => {
    vi.stubGlobal('IntersectionObserver', FakeIO)
    const m = mount(p, undefined, { titulo: true, main: true })
    const topo = m.container.querySelector('[data-own-block]')!
    const pe = m.container.querySelector<HTMLElement>('.cn-pin')!
    const linha = m.container.querySelector(`tr.row[data-id="${view(p).pe!.canalId}"]`)!
    return { ...m, topo, pe, linha }
  }
  it('linha presa: escondida enquanto o bloco ou a linha do canal estão à vista; aparece quando nenhum dos dois está', () => {
    const { pe, topo, linha } = montaComIO()
    expect(pe.hidden).toBe(true) // antes da primeira leitura do observador
    expect(pe.textContent).toContain(view().pe!.texto)
    FakeIO.emitir(topo, true); FakeIO.emitir(linha, false)
    expect(pe.hidden).toBe(true)
    FakeIO.emitir(topo, false)
    expect(pe.hidden).toBe(false)
    FakeIO.emitir(linha, true)
    expect(pe.hidden).toBe(true)
    FakeIO.emitir(linha, false)
    expect(pe.hidden).toBe(false)
    const io = FakeIO.vivos.find(x => x.alvos.has(topo))!
    expect(io.opts?.threshold).toBe(0.15)
    expect(io.opts?.root).toBe(document.querySelector('main')) // o contêiner que rola
  })
  it('sem IntersectionObserver (jsdom) a linha presa fica escondida', () => {
    const { container } = mount()
    expect(container.querySelector<HTMLElement>('.cn-pin')!.hidden).toBe(true)
  })
  it('linha presa: "Voltar ao topo" rola ao topo e foca o título; "Ir até a linha" foca a linha; sem canal próprio ela não existe no DOM', async () => {
    const user = userEvent.setup()
    const scrollTo = vi.fn()
    Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo
    const { pe, container, linha } = montaComIO()
    FakeIO.emitir(container.querySelector('[data-own-block]')!, false); FakeIO.emitir(linha, false)
    await user.click(within(pe).getByRole('button', { name: 'Voltar ao topo' }))
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo.mock.contexts[0]).toBe(document.querySelector('main'))
    expect(scrollTo.mock.calls[0]![0]).toMatchObject({ top: 0 })
    expect(document.activeElement).toBe(container.querySelector('h2'))
    await user.click(within(pe).getByRole('button', { name: 'Ir até a linha' }))
    expect(document.activeElement).toBe(linha)
  })
  it('navegação que só muda a query (outro sort): a frase do bloco e a linha presa acompanham', () => {
    search = 'fmt=longos'
    const { container, rerender } = render(tree(view({ sort: 'vpd' })))
    const antes = container.querySelector('[data-own-block] li .tp')!.textContent
    rerender(tree(view({ sort: 'subs' })))
    const v2 = view({ sort: 'subs' })
    const l = v2.own.block!.linhas[0]!
    expect(l.tipo === 'cheia' && container.querySelector('[data-own-block] li .tp')!.textContent).toContain(l.tipo === 'cheia' ? l.frase : '')
    expect(container.querySelector('[data-own-block] li .tp')!.textContent).not.toBe(antes)
    expect(container.querySelector('.cn-pin p')!.textContent).toBe(v2.pe!.texto)
  })
})

describe('A3.3 busca e ordenação', () => {
  it('busca: filtra as linhas, não renumera, e mostra "Posição na lista inteira, não só nos resultados da busca."', async () => {
    const user = userEvent.setup()
    const v = view({ sort: 'subs' })
    const { container } = mount({ sort: 'subs' })
    expect(container.querySelector('[data-k="busca-nota"]')).toBeNull()
    const antes = new Map(v.list.ranked.map(r => [r.id, cel(container, r.id).textContent]))
    await user.type(screen.getByRole('searchbox', { name: 'Buscar canal' }), 'leo')
    const resto = linhas(container).map(r => r.dataset.id!)
    const esperado = ordem(v).filter(id => [...v.list.ranked, ...v.list.unranked].find(r => r.id === id)!.name.toLowerCase().includes('leo'))
    expect(resto).toEqual(esperado)
    expect(resto.length).toBeGreaterThan(0)
    for (const id of resto) if (antes.has(id)) expect(cel(container, id).textContent).toBe(antes.get(id))
    expect(container.querySelector('[data-k="busca-nota"]')!.textContent).toBe('Posição na lista inteira, não só nos resultados da busca.')
    expect(v.buscaNota).toBe('Posição na lista inteira, não só nos resultados da busca.')
  })
  it('busca sem resultado: a frase de vazio de hoje; o bloco "Seus canais" continua', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(screen.getByRole('searchbox', { name: 'Buscar canal' }), 'zzzzqq')
    expect(linhas(container)).toHaveLength(0)
    expect(container.querySelector('tbody')!.textContent).toContain('Nenhum canal com “zzzzqq”. Para acompanhar um canal novo, use Adicionar canal.')
    expect(container.querySelector('[data-own-block] li')).not.toBeNull()
  })
  it('ordenar anuncia no status a ordenação e a posição do seu canal ("Seu canal: 14º de 14 em Viagem.") ou que não há medida', async () => {
    const user = userEvent.setup()
    search = 'fmt=longos'
    const vA = view({ niche: 'viagem', sort: 'vpd' })
    const { container, rerender } = render(tree(vA))
    const st = () => container.querySelector('[data-k="ord-anuncio"]')!
    expect(st().textContent).toBe('')
    await user.click(container.querySelector<HTMLElement>('thead th[data-k="subs"] button')!)
    expect(replace).toHaveBeenCalled()
    // o anúncio espera a lista nova (a posição é a da ordenação nova)
    expect(st().textContent).toBe('')
    const vB = view({ niche: 'viagem', sort: 'subs' })
    rerender(tree(vB))
    const dono = vB.list.ranked.find(r => r.id === vB.pe!.canalId)!
    expect(st().textContent).toBe(`${vB.sortNote}. Seu canal: ${dono.pos!.pos}º de ${dono.pos!.de} em Viagem.`)
    // ordenação sem posição escrita
    await user.click(container.querySelector<HTMLElement>('thead th[data-k="growth"] button')!)
    const vC = view({ niche: 'viagem', sort: 'growth' })
    rerender(tree(vC))
    // o canal TEM medida em Crescimento e só não há posição escrita: o anúncio diz o mesmo que o bloco e o cartão (motivoTexto), não "sem medida"
    const donoC = vC.list.ranked.find(r => r.id === vC.pe!.canalId) ?? vC.list.unranked.find(r => r.id === vC.pe!.canalId)!
    expect(st().textContent).toBe(`${vC.sortNote}. ${motivoTexto(donoC.semMedida ?? 'ordenacao-sem-posicao')}`)
    expect(st().textContent).not.toContain('ainda sem medida nesta coluna')
  })
  it('nenhum elemento novo é buscado por document.getElementById (a árvore escondida do Voltar teria o mesmo id)', async () => {
    const user = userEvent.setup()
    const g = vi.spyOn(document, 'getElementById')
    const { container } = mount({}, undefined, { titulo: true, main: true })
    vi.stubGlobal('IntersectionObserver', FakeIO)
    await user.click(container.querySelector<HTMLElement>('[data-own-block] li button[aria-label^="Ir até a linha"]')!)
    const chamados = g.mock.calls.map(c => c[0]).filter(id => id !== 'flut')
    g.mockRestore()
    expect(chamados).toEqual([])
    expect(container.querySelector('[data-own-block]')!.getAttribute('id')).toBeNull()
  })
  it('o filtro "só com problema" mantém os canais próprios na lista e no bloco', () => {
    const w = a3World(ds => { const c = ds.channels.find(x => !x.own)!; c.sync.state = 'erro'; c.sync.msg = 'falhou' })
    const v = view({ filter: 'problemas' }, w.obs)
    const { container } = mount({ filter: 'problemas' }, w.obs)
    expect(linhas(container).map(r => r.dataset.id)).toEqual(ordem(v))
    expect(container.querySelector('[data-own-block] li')).not.toBeNull()
    expect(screen.getAllByRole('button', { name: /^Ir até a linha/ }).length).toBeGreaterThan(0)
  })
  it('a nota do "de N" aparece sob o controle quando a lista mostra outra coisa (só com problema; canal próprio sem nicho num nicho) e some quando não há o que explicar', () => {
    const w = a3World(ds => { const c = ds.channels.find(x => !x.own)!; c.sync.state = 'erro'; c.sync.msg = 'falhou' }, 'mix')
    const { container, unmount } = mount({ filter: 'problemas', niche: 'viagem' }, w.obs)
    expect(container.querySelector('[data-k="posicao-nota"]')!.textContent).toBe(view({ filter: 'problemas', niche: 'viagem' }, w.obs).posicaoNota)
    expect(container.querySelector('[data-k="posicao-nota"]')!.textContent).toContain('Posição na lista inteira, não só nos canais com problema.')
    unmount()
    const { container: c2 } = mount()
    expect(c2.querySelector('[data-k="posicao-nota"]')).toBeNull()
  })
})

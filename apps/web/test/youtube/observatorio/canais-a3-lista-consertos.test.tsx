// @vitest-environment jsdom
// A3 Tarefa 4: três defeitos da lista de Canais achados na revisão da Tarefa 3 (I1, I2, I3), cada um com o teste que faltava.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => true,
}))
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { a3World } from './a3-fixture'
import { buildCanaisView, type CanaisParams, type CanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import type { Observatory } from '@/lib/youtube/observatorio'
import fs from 'node:fs'
import path from 'node:path'

const replace = vi.fn(), refresh = vi.fn(), push = vi.fn(), prefetch = vi.fn()
let search = 'fmt=longos'
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push, prefetch, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(search),
}))

const BASE = a3World()
/** O mundo de produção: o canal próprio ainda sem leitura diária (o diário só chega na A4), logo sem views por dia e sem posição nela. */
const SEM_DIARIO = a3World(ds => {
  const own = new Set(ds.channels.filter(c => c.own).map(c => c.id))
  for (const v of ds.videos) if (own.has(v.ch)) { v.series = []; v.firstIdx = null }
})
const ok = async () => ({ ok: true })
const view = (p: Partial<CanaisParams> = {}, obs: Observatory = BASE.obs) => buildCanaisView(obs, { niche: 'todos', limit: 75, fmt: 'longos', ...p })
const tree = (v: CanaisView) => (
  <ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><div data-obs-chrome=""><button type="button" aria-label="Mais ações">⋯</button></div>
    <CanaisScreen view={v} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} />
  </div></ChromeSyncContext.Provider></ToastProvider>
)
const mount = (p: Partial<CanaisParams> = {}, obs?: Observatory) => { search = `fmt=longos${p.layout ? '&layout=' + p.layout : ''}`; return render(tree(view(p, obs))) }

class FakeIO {
  static vivos: FakeIO[] = []
  alvos = new Set<Element>()
  constructor(public cb: IntersectionObserverCallback, public opts?: IntersectionObserverInit) { FakeIO.vivos.push(this) }
  observe(t: Element) { this.alvos.add(t) }
  unobserve(t: Element) { this.alvos.delete(t) }
  disconnect() { this.alvos.clear() }
  takeRecords() { return [] }
}

beforeEach(() => {
  replace.mockReset(); refresh.mockReset(); push.mockReset(); prefetch.mockReset(); FakeIO.vivos = []
  const m = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) }, clear: () => m.clear() })
})
afterEach(() => { vi.unstubAllGlobals(); document.getElementById('flut')?.remove() })

describe('I1: o vazio da busca só aparece quando nenhuma linha restou', () => {
  const VAZIO = /Nenhum canal com “/
  const buscar = async (termo: string) => { await userEvent.setup().type(screen.getByRole('searchbox', { name: 'Buscar canal' }), termo) }
  for (const layout of ['table', 'cards'] as const) {
    it(`${layout}: a busca casa só com canais próprios (que estão na tela): sem frase de vazio`, async () => {
      const { container } = mount({ layout })
      await buscar('tnfig')
      const donos = [...container.querySelectorAll<HTMLElement>(layout === 'table' ? 'tbody tr.row' : '.cards article')]
      expect(donos.length).toBeGreaterThan(0)
      expect(donos.every(d => d.classList.contains('you'))).toBe(true)
      expect(container.textContent).not.toMatch(VAZIO)
    })
    it(`${layout}: a busca que não casa com nenhum canal (próprio ou não) mostra a frase de vazio`, async () => {
      const { container } = mount({ layout })
      await buscar('zzzzqq')
      expect(container.querySelectorAll(layout === 'table' ? 'tbody tr.row' : '.cards article')).toHaveLength(0)
      expect(container.textContent).toMatch(VAZIO)
    })
    it(`${layout}: a busca que casa com um concorrente também não mostra o vazio`, async () => {
      const { container } = mount({ layout })
      await buscar('leo')
      expect(container.querySelectorAll(layout === 'table' ? 'tbody tr.row' : '.cards article').length).toBeGreaterThan(0)
      expect(container.textContent).not.toMatch(VAZIO)
    })
  }
  it('sem busca o vazio continua o de hoje (nenhum concorrente e canal próprio na tela)', () => {
    const w = a3World(ds => { ds.channels = ds.channels.filter(c => c.own); const own = new Set(ds.channels.map(c => c.id)); ds.videos = ds.videos.filter(v => own.has(v.ch)) })
    const v = view({}, w.obs)
    const { container } = mount({}, w.obs)
    expect(container.querySelectorAll('tbody tr.row').length).toBeGreaterThan(0)
    expect(container.querySelector('tbody')!.textContent).toContain(v.emptyText.slice(0, 20))
  })
})

describe('I2: o anúncio de ordenação diz o motivo do modelo, não "sem medida" quando o canal tem medida', () => {
  const anuncio = (c: HTMLElement) => c.querySelector('[data-k="ord-anuncio"]')!.textContent!
  const colunas = ['active', 'outliers', 'growth', 'swaps', 'vpd', 'subs'] as const
  for (const sort of colunas) {
    it(`${sort}: o fim do anúncio é a frase do bloco "Seus canais" quando o canal próprio não tem posição`, async () => {
      const user = userEvent.setup()
      const vA = view({ niche: 'viagem', sort: sort === 'subs' ? 'vpd' : 'subs' })
      search = 'fmt=longos'
      const { container, rerender } = render(tree(vA))
      await user.click(container.querySelector<HTMLElement>(`thead th[data-k="${sort}"] button`)!)
      const vB = view({ niche: 'viagem', sort })
      rerender(tree(vB))
      const dono = [...vB.list.ranked, ...vB.list.unranked].find(r => r.id === vB.pe!.canalId)!
      const linha = vB.own.block!.linhas.find(l => l.id === dono.id)!
      expect(linha.tipo).toBe('cheia')
      if (dono.pos) expect(anuncio(container)).toBe(`${vB.sortNote}. Seu canal: ${dono.pos.pos}º de ${dono.pos.de} em Viagem${dono.pos.empate ? ' (empate)' : ''}.`)
      else {
        const frase = (linha as Extract<typeof linha, { tipo: 'cheia' }>).frase
        expect(anuncio(container)).toBe(`${vB.sortNote}. ${frase}`)
        expect(anuncio(container)).not.toContain('ainda sem medida nesta coluna')
      }
    })
  }
  it('o canal próprio SEM medida em views/dia: o anúncio diz o motivo (coleta diária), igual ao bloco', async () => {
    const user = userEvent.setup()
    search = 'fmt=longos'
    const { container, rerender } = render(tree(view({ sort: 'subs' }, SEM_DIARIO.obs)))
    await user.click(container.querySelector<HTMLElement>('thead th[data-k="vpd"] button')!)
    const vB = view({ sort: 'vpd' }, SEM_DIARIO.obs)
    rerender(tree(vB))
    const dono = [...vB.list.ranked, ...vB.list.unranked].find(r => r.id === vB.pe!.canalId)!
    expect(dono.pos).toBeNull()
    expect(dono.semMedida).toBe('sem-views-dia-proprio')
    expect(anuncio(container)).toBe(`${vB.sortNote}. Ainda sem views por dia medidas: a coleta diária do seu canal começa em breve. Sem posição nesta ordenação.`)
  })
})

describe('I3: a linha presa observa a linha do canal depois que ela passa entre as seções da tabela', () => {
  it('clicar em Inscritos com o canal sob "Ainda sem medida para ordenar": o observador passa a observar a linha nova', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIO)
    const user = userEvent.setup()
    search = 'fmt=longos'
    const vA = view({ sort: 'vpd' }, SEM_DIARIO.obs)
    const { container, rerender } = render(tree(vA))
    const id = vA.pe!.canalId
    const linha = () => container.querySelector<HTMLElement>(`tbody tr.row[data-id="${id}"]`)!
    expect(vA.list.unranked.some(r => r.id === id)).toBe(true) // sob o divisor
    const antes = linha()
    expect(FakeIO.vivos.some(io => io.alvos.has(antes))).toBe(true)
    await user.click(container.querySelector<HTMLElement>('thead th[data-k="subs"] button')!)
    const vB = view({ sort: 'subs' }, SEM_DIARIO.obs)
    expect(vB.list.ranked.some(r => r.id === id)).toBe(true) // agora entre as com medida
    act(() => { rerender(tree(vB)) })
    const depois = linha()
    expect(depois).not.toBe(antes) // a `tr` foi remontada
    expect(FakeIO.vivos.some(io => io.alvos.has(depois)), 'o observador vivo observa a linha de agora').toBe(true)
    expect(FakeIO.vivos.some(io => io.alvos.has(antes)), 'nenhum observador segura a linha velha').toBe(false)
  })
  it('e no sentido contrário (de Inscritos para Views/dia)', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIO)
    const user = userEvent.setup()
    search = 'fmt=longos'
    const { container, rerender } = render(tree(view({ sort: 'subs' }, SEM_DIARIO.obs)))
    const vB = view({ sort: 'vpd' }, SEM_DIARIO.obs)
    const id = vB.pe!.canalId
    await user.click(container.querySelector<HTMLElement>('thead th[data-k="vpd"] button')!)
    act(() => { rerender(tree(vB)) })
    const depois = container.querySelector<HTMLElement>(`tbody tr.row[data-id="${id}"]`)!
    expect(FakeIO.vivos.some(io => io.alvos.has(depois))).toBe(true)
  })
})

describe('I4 (achado no navegador): o foco por Tab não fica sob a linha presa no pé', () => {
  // o navegador só rola para revelar o que está fora da área; um controle na faixa que a linha presa cobre já "está à vista". A margem de rolagem
  // dos controles da lista faz o Tab levá-lo para cima da linha presa. O jsdom não rola: a prova real é o Tab do canais-a3.spec.ts; aqui a regra existe.
  const css = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_canais/canais.css'), 'utf8')
  it('os controles da tabela e dos cartões têm scroll-margin-bottom que cobre a linha presa (pé de 66 px + 34 px)', () => {
    const regra = css.split('\n').find(l => l.includes('scroll-margin-bottom') && l.includes('.tablebox') && l.includes('.cards'))
    expect(regra, 'regra de scroll-margin-bottom para .tablebox e .cards').toBeDefined()
    const px = Number(/scroll-margin-bottom:\s*(\d+)px/.exec(regra!)?.[1])
    expect(px).toBeGreaterThanOrEqual(100)
  })
})

describe('I5 (achado no navegador): os cartões cabem em 320 px', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_canais/canais.css'), 'utf8')
  it('a grade dos cartões nunca pede coluna maior que o espaço (minmax(min(320px,100%),1fr)): em 320 px de janela o espaço é de 292 px', () => {
    const regra = css.split('\n').find(l => l.includes('.cards{') && l.includes('grid-template-columns'))
    expect(regra).toBeDefined()
    expect(regra).toContain('minmax(min(320px,100%),1fr)')
    expect(regra).not.toMatch(/minmax\(320px/)
  })
})

describe('I6 (achado no navegador): a tabela cabe no invólucro de 1.152 px de uma janela de 1.440 px', () => {
  // a prova real é a medida do canais-a3.spec.ts (a tabela larga só se vê no navegador); aqui ficam as regras que a causaram
  const css = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_canais/canais.css'), 'utf8')
  const linhas = css.split('\n')
  it('a ressalva de dado velho quebra de linha: um nowrap nela alarga a coluna Views/dia em Todos', () => {
    const regra = linhas.find(l => /\.fm \.ressalva\{/.test(l))
    expect(regra).toBeDefined()
    expect(regra).toContain('white-space:normal')
  })
  it('a largura mínima da tabela não passa de 1.000 px (a natural das colunas decide, e a tabela larga rola por dentro)', () => {
    const mins = linhas.flatMap(l => [...l.matchAll(/(?:^|[^-\w.])\[data-obs-screen="canais"\] table\{[^}]*min-width:(\d+)px/g)].map(m => Number(m[1])))
    expect(mins.length).toBeGreaterThan(0)
    expect(Math.max(...mins)).toBeLessThanOrEqual(1000)
  })
  it('as colunas largas não têm piso maior que o necessário: canal 180, ritmo 130, outliers 188, trocas 104, sincronização 140', () => {
    // a regra que vale é a última que declara o piso (fora dos @media de gaveta aberta, que começam por .drawer-open)
    const piso = (sel: string) => Number([...css.matchAll(new RegExp(`\\[data-obs-screen="canais"\\] ${sel.replace('.', '\\.')}\\{[^}]*min-width:(\\d+)px`, 'g'))].at(-1)?.[1])
    expect(piso('.ch')).toBeLessThanOrEqual(180)
    expect(piso('.cad')).toBeLessThanOrEqual(130)
    expect(piso('.out')).toBeLessThanOrEqual(188)
    expect(piso('.swap')).toBeLessThanOrEqual(104)
    expect(piso('.sync')).toBeLessThanOrEqual(140)
  })
})

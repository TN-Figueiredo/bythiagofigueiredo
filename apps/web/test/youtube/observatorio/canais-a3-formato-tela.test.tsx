// @vitest-environment jsdom
// A3 Tarefa 1: o controle "Todos | Longos | Shorts" da lista de Canais e as duas medidas por célula.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const siteAdmin = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => siteAdmin.value,
}))
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { a3World } from './a3-fixture'
import { buildCanaisView, type CanaisParams, type CanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import { noJunkText, forbiddenVocabulary } from './audits'
import type { Observatory } from '@/lib/youtube/observatorio'

const replace = vi.fn(), refresh = vi.fn(), push = vi.fn(), prefetch = vi.fn()
let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push, prefetch, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(search),
}))

const BASE = a3World()
const ok = async () => ({ ok: true })
const view = (p: Partial<CanaisParams> = {}, obs: Observatory = BASE.obs) => buildCanaisView(obs, { niche: 'todos', limit: 75, ...p })
const tree = (v: CanaisView) => (
  <ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><div data-obs-chrome=""><button type="button" aria-label="Mais ações">⋯</button></div>
    <CanaisScreen view={v} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} />
  </div></ChromeSyncContext.Provider></ToastProvider>
)
const mount = (p: Partial<CanaisParams> = {}, obs?: Observatory) => render(tree(view(p, obs)))
const grupo = () => screen.getByRole('group', { name: 'Formato' })
const botoes = () => within(grupo()).getAllByRole('button')

// O jsdom desta suíte não traz um localStorage inteiro (o do Node vem sem arquivo): um armazenamento de mentira, que também sabe falhar
let store = new Map<string, string>(), falha = false
const armazenamento = {
  getItem: (k: string) => { if (falha) throw new Error('bloqueado'); return store.get(k) ?? null },
  setItem: (k: string, v: string) => { if (falha) throw new Error('bloqueado'); store.set(k, v) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => { store.clear() },
}
const lembrado = (valor: string | null) => { store = new Map(valor == null ? [] : [['obs:canais-fmt', valor]]) }

beforeEach(() => {
  replace.mockReset(); refresh.mockReset(); push.mockReset(); prefetch.mockReset(); search = ''
  store = new Map(); falha = false; vi.stubGlobal('localStorage', armazenamento)
})
afterEach(() => { vi.unstubAllGlobals(); document.getElementById('flut')?.remove() })

describe('A3.1 controle de formato', () => {
  it('o grupo "Formato" tem três botões com aria-pressed, na ordem Todos, Longos, Shorts', () => {
    search = 'fmt=todos'
    mount({ fmt: 'todos' })
    expect(botoes().map(b => b.textContent)).toEqual(['Todos', 'Longos', 'Shorts'])
    expect(botoes().map(b => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
    expect(grupo()).toHaveAttribute('role', 'group')
  })
  it('escolher um formato grava fmt= na URL SEMPRE, inclusive Longos, e guarda em localStorage', async () => {
    const user = userEvent.setup()
    search = 'fmt=longos'
    mount({ fmt: 'longos' })
    expect(replace).not.toHaveBeenCalled() // a URL já traz um formato válido: nada a gravar na montagem
    await user.click(screen.getByRole('button', { name: 'Todos' }))
    expect(replace).toHaveBeenLastCalledWith('/cms/youtube/competitors?fmt=todos', { scroll: false })
    expect(store.get('obs:canais-fmt')).toBe('todos')
    await user.click(screen.getByRole('button', { name: 'Shorts' }))
    expect(replace).toHaveBeenLastCalledWith('/cms/youtube/competitors?fmt=shorts', { scroll: false })
    await user.click(screen.getByRole('button', { name: 'Longos' }))
    expect(replace).toHaveBeenLastCalledWith('/cms/youtube/competitors?fmt=longos', { scroll: false })
    expect(store.get('obs:canais-fmt')).toBe('longos')
  })
  it('o formato novo preserva o resto da query (ordem, escala, visualização)', async () => {
    const user = userEvent.setup()
    search = 'fmt=longos&sort=subs&scale=abs'
    mount({ fmt: 'longos', sort: 'subs', scale: 'abs' })
    await user.click(screen.getByRole('button', { name: 'Todos' }))
    const u = new URL('http://x' + replace.mock.calls.at(-1)![0])
    expect([u.searchParams.get('fmt'), u.searchParams.get('sort'), u.searchParams.get('scale')]).toEqual(['todos', 'subs', 'abs'])
  })
  it('URL sem fmt: grava o lembrado (ou longos) com replace, uma vez só; localStorage que lança não quebra a tela', () => {
    // nada lembrado: Longos
    const a = mount()
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors?fmt=longos', { scroll: false })
    a.rerender(tree(view())) // a mesma tela de novo: não grava outra vez
    expect(replace).toHaveBeenCalledTimes(1)
    a.unmount()
    // lembrado: Shorts
    replace.mockReset(); lembrado('shorts')
    const b = mount()
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors?fmt=shorts', { scroll: false })
    b.unmount()
    // lembrado lixo: Longos
    replace.mockReset(); lembrado('abc')
    const c = mount()
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors?fmt=longos', { scroll: false })
    c.unmount()
    // o armazenamento lança: a tela abre e grava Longos
    replace.mockReset(); falha = true
    mount()
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors?fmt=longos', { scroll: false })
    expect(grupo()).toBeInTheDocument()
  })
  it('URL com fmt inválido (fmt=abc) é reescrita para um formato válido, sem mensagem de erro', () => {
    search = 'fmt=abc&sort=subs'
    const { container } = mount({ fmt: 'abc', sort: 'subs' })
    const u = new URL('http://x' + replace.mock.calls.at(-1)![0])
    expect([u.searchParams.get('fmt'), u.searchParams.get('sort')]).toEqual(['longos', 'subs'])
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
  it('URL com fmt válido não grava nada', () => {
    search = 'fmt=short'
    mount({ fmt: 'short' }) // link antigo: abre Shorts; o valor na URL já vale
    expect(replace).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Shorts' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('navegação que só muda a query (rerender com outro view.fmt) atualiza o botão pressionado', () => {
    search = 'fmt=longos'
    const r = mount({ fmt: 'longos' })
    expect(screen.getByRole('button', { name: 'Longos' })).toHaveAttribute('aria-pressed', 'true')
    search = 'fmt=todos'
    r.rerender(tree(view({ fmt: 'todos' })))
    expect(botoes().map(b => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
    search = 'fmt=shorts'
    r.rerender(tree(view({ fmt: 'shorts' })))
    expect(botoes().map(b => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
  })
  it('a mudança é anunciada no status: "Formato: Todos, longos e Shorts lado a lado, ordem pelos longos."', async () => {
    const user = userEvent.setup()
    search = 'fmt=longos'
    mount({ fmt: 'longos' })
    const status = within(grupo()).getByRole('status')
    expect(status.textContent).toBe('')
    await user.click(screen.getByRole('button', { name: 'Todos' }))
    expect(status.textContent).toBe('Formato: Todos, longos e Shorts lado a lado, ordem pelos longos.')
    await user.click(screen.getByRole('button', { name: 'Shorts' }))
    expect(status.textContent).toBe('Formato: Shorts.')
  })
  it('o aviso sob o controle: o texto do modelo em Todos e Shorts, nada em Longos', () => {
    search = 'fmt=longos'
    const a = mount({ fmt: 'longos' })
    expect(document.querySelector('[data-k="fmt-nota"]')).toBeNull()
    a.unmount()
    search = 'fmt=todos'
    mount({ fmt: 'todos' })
    expect(document.querySelector('[data-k="fmt-nota"]')!.textContent).toBe(view({ fmt: 'todos' }).fmtNota)
  })
})

describe('A3.1 duas medidas', () => {
  it('Todos na tabela: o cabeçalho da coluna diz "longos em cima, Shorts embaixo" e cada medida tem o rótulo para leitor de tela', () => {
    search = 'fmt=todos'
    const { container } = mount({ fmt: 'todos' })
    const th = (k: string) => container.querySelector(`thead th[data-k="${k}"]`)!
    for (const k of ['active', 'vpd', 'outliers']) expect(th(k).textContent).toContain('longos em cima, Shorts embaixo')
    for (const k of ['subs', 'swaps', 'growth']) expect(th(k).textContent).not.toContain('longos em cima')
    // a coluna ordenada (views/dia) diz que ordena pelos longos; as outras, não
    expect(th('vpd').textContent).toContain('ordenado pelos longos')
    expect(th('active').textContent).not.toContain('ordenado pelos longos')
    const linha = container.querySelector('tr[data-id="matt-wolfe"]')!
    const celula = linha.querySelectorAll('td')[2]!
    const medidas = celula.querySelectorAll('.fm')
    expect(medidas).toHaveLength(2)
    expect(medidas[0]!.querySelector('.sr')!.textContent).toBe('longos: ')
    expect(medidas[1]!.querySelector('.sr')!.textContent).toBe('Shorts: ')
    expect(celula.querySelector('.fl')).toBeNull() // na tabela o rótulo visível mora no cabeçalho
  })
  it('em Longos e em Shorts o cabeçalho não tem a linha de dois formatos e a célula tem uma medida só', () => {
    for (const f of ['longos', 'shorts'] as const) {
      search = `fmt=${f}`
      const { container, unmount } = mount({ fmt: f })
      expect(container.querySelector('[data-cab-fmt]')).toBeNull()
      expect(container.querySelector('tr[data-id="matt-wolfe"] .fm')).toBeNull()
      unmount()
    }
  })
  it('Todos nos cartões: o rótulo "longos" / "Shorts" é visível em cada medida', () => {
    search = 'fmt=todos&layout=cards'
    const { container } = mount({ fmt: 'todos', layout: 'cards' })
    const cartao = container.querySelector('article.card[data-id="matt-wolfe"]')!
    const rotulos = [...cartao.querySelectorAll('.fm .fl')].map(x => x.textContent)
    expect(rotulos).toEqual(['longos', 'Shorts', 'longos', 'Shorts']) // Views/dia e Outliers
    expect(cartao.querySelector('.fm .sr')).toBeNull()
  })
  it('Todos: canal sem Shorts diz "sem Shorts" na segunda linha da célula; zero nunca aparece no lugar', () => {
    const alvo = BASE.ds.channels.find(c => !c.own && BASE.ds.videos.some(v => v.ch === c.id && v.fmt === 'short'))!.id
    const w = a3World(ds => { ds.videos = ds.videos.filter(v => !(v.ch === alvo && v.fmt === 'short')) })
    search = 'fmt=todos'
    const { container } = mount({ fmt: 'todos' }, w.obs)
    const linha = container.querySelector(`tr[data-id="${alvo}"]`)!
    for (const i of [1, 2, 3]) {
      const fm = linha.querySelectorAll('td')[i]!.querySelectorAll('.fm')
      expect(fm[fm.length - 1]!.textContent).toContain('sem Shorts')
    }
    expect(noJunkText(container)).toEqual([])
    expect(forbiddenVocabulary(container)).toEqual([])
  })
  it('Todos nos cartões: "sem Shorts" e "sem vídeos" vêm sem rótulo visível na frente (a frase já diz); os rótulos "longos" e "Shorts" ficam onde há número', () => {
    const conc = BASE.ds.channels.filter(c => !c.own && BASE.ds.videos.some(v => v.ch === c.id && v.fmt === 'short'))
    const semShorts = conc[0]!.id, semVideos = conc[1]!.id
    const w = a3World(ds => {
      ds.videos = ds.videos.filter(v => !(v.ch === semShorts && v.fmt === 'short') && v.ch !== semVideos)
    })
    search = 'fmt=todos&layout=cards'
    const { container } = mount({ fmt: 'todos', layout: 'cards' }, w.obs)
    const rotulos = (id: string) => [...container.querySelector(`article.card[data-id="${id}"]`)!.querySelectorAll('.fm .fl')].map(x => x.textContent)
    const cartao = (id: string) => container.querySelector(`article.card[data-id="${id}"]`)!
    // sem Shorts: Views/dia e Outliers têm o rótulo "longos" (há número) e a frase da falta sem rótulo
    expect(rotulos(semShorts)).not.toContain('Shorts')
    expect(cartao(semShorts).textContent).toContain('sem Shorts')
    expect(cartao(semShorts).textContent).not.toMatch(/Shorts\s*sem Shorts/)
    // sem vídeo algum: nenhum rótulo de formato diante de "sem vídeos"
    expect(rotulos(semVideos)).not.toContain('Shorts')
    expect(cartao(semVideos).textContent).toContain('sem vídeos')
    expect(cartao(semVideos).textContent).not.toMatch(/Shorts\s*sem vídeos/)
    // um canal com os dois formatos continua com os quatro rótulos
    const comAmbos = conc.find(c => c.id !== semShorts && c.id !== semVideos && w.ds.videos.some(v => v.ch === c.id && v.fmt === 'short' && v.tracked))
    if (comAmbos) expect(rotulos(comAmbos.id)).toContain('Shorts')
  })
  it('Todos: a ressalva de dado velho ("até o registro diário de DD/MM") aparece em texto na célula de views/dia, não só no title', () => {
    const alvo = BASE.ds.channels.find(c => !c.own && c.sync.state !== 'backfill')!.id
    const w = a3World(ds => { const s = ds.channels.find(c => c.id === alvo)!.sync; s.state = 'erro'; s.msg = 'falhou' })
    const texto = (f: 'todos' | 'longos') => {
      search = `fmt=${f}`
      const { container, unmount } = mount({ fmt: f }, w.obs)
      const t = container.querySelector(`tr[data-id="${alvo}"]`)!.querySelectorAll('td')[2]!.textContent ?? ''
      unmount()
      return t
    }
    expect(texto('longos')).toMatch(/até o registro diário de \d{2}\/\d{2}/) // o que o filtro Longos já mostra
    expect(texto('todos')).toMatch(/até o registro diário de \d{2}\/\d{2}/)
  })
  it('"formato não confirmado (N)" aparece na linha, com a dica na camada flutuante', () => {
    const alvo = BASE.ds.channels.find(c => !c.own)!.id
    const w = a3World(ds => { ds.videos.filter(v => v.ch === alvo && v.tracked).slice(0, 3).forEach(v => { v.isShort = null }) })
    search = 'fmt=longos'
    const { container } = mount({ fmt: 'longos' }, w.obs)
    const linha = container.querySelector(`tr[data-id="${alvo}"]`)!
    const aviso = linha.querySelector('[data-sem-formato]')!
    expect(aviso.textContent).toContain('formato não confirmado (3)')
    const q = aviso.querySelector<HTMLElement>('.tip')!
    expect(q.querySelector('[role="tooltip"]')).toBeNull()
    fireEvent.focus(q)
    const tip = document.querySelector('#flut .cn-tt')!
    expect(tip.closest('td, tr, table')).toBeNull()
    expect(tip.textContent).toMatch(/entram nos números dos longos/)
    fireEvent.blur(q)
    // as outras linhas não têm o aviso
    expect(container.querySelectorAll('[data-sem-formato]')).toHaveLength(1)
  })
})

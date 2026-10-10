// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, cleanup, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { montarLista } from '@/app/cms/(authed)/youtube/competitors/_canal/lista'
import { mountCanal, cartoes, norm } from './canal-mount'

const push = vi.fn(), replace = vi.fn(), refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/matt-wolfe',
  useSearchParams: () => new URLSearchParams(''),
}))

const statusEl = () => document.querySelector<HTMLElement>('p.cv-status')!
const urlNow = () => new URL(window.location.href).searchParams

beforeEach(() => { push.mockReset(); replace.mockReset(); refresh.mockReset(); window.history.replaceState(null, '', '/cms/youtube/competitors/canal/matt-wolfe') })
afterEach(() => { vi.useRealTimers(); cleanup(); document.getElementById('flut')?.remove(); vi.restoreAllMocks() })

describe('controles da aba Vídeos', () => {
  it('grupo "Formato": role=group, botões com aria-pressed e a contagem no nome ("Longos, 61")', () => {
    const { view } = mountCanal()
    const c = montarLista(view.videos.videos, view.state).counts
    const g = screen.getByRole('group', { name: 'Formato' })
    const bs = within(g).getAllByRole('button')
    expect(bs.map(b => b.getAttribute('aria-label'))).toEqual([`Todos, ${c.todos}`, `Longos, ${c.longos}`, `Shorts, ${c.shorts}`, `Fixados, ${c.fixados}`])
    expect(bs.map(b => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false'])
    expect(norm(bs[1]!.textContent)).toBe(`Longos ${c.longos}`)
  })

  it('"Ordenar" é select nativo com as quatro opções e os rótulos exatos', () => {
    mountCanal()
    const sel = screen.getByRole('combobox', { name: 'Ordenar' }) as HTMLSelectElement
    expect(sel.tagName).toBe('SELECT')
    expect([...sel.options].map(o => [o.value, o.textContent])).toEqual([['recentes', 'Mais recentes'], ['vistos', 'Mais vistos'], ['multiplo', 'Maior múltiplo'], ['vpd', 'Mais views por dia']])
    expect(sel.value).toBe('recentes')
  })

  it('trocar a ordenação reordena no mesmo render, volta a direção para decrescente e anuncia', () => {
    const { all } = mountCanal({ sp: { dir: 'asc' } })
    const sel = screen.getByRole('combobox', { name: 'Ordenar' })
    fireEvent.change(sel, { target: { value: 'vistos' } })
    const ordem = cartoes().map(c => c.dataset.id)
    const esperado = all.filter(v => v.grupo !== 'antigo' && v.views != null).sort((a, b) => b.views! - a.views! || (b.pub ?? 0) - (a.pub ?? 0)).map(v => v.id)
    expect(ordem.slice(0, 10)).toEqual(esperado.slice(0, 10))
    expect(urlNow().get('sort')).toBe('vistos')
    expect(urlNow().has('dir')).toBe(false)
    expect(norm(statusEl().textContent)).toMatch(/^Ordenado por Views, decrescente, \d+ vídeos$/)
  })

  it('grupo "Vista": Capas (padrão) e Lista, com aria-pressed', () => {
    mountCanal()
    const g = screen.getByRole('group', { name: 'Vista' })
    const [capas, lista] = within(g).getAllByRole('button')
    expect(norm(capas!.textContent)).toBe('Capas'); expect(norm(lista!.textContent)).toBe('Lista')
    expect([capas!.getAttribute('aria-pressed'), lista!.getAttribute('aria-pressed')]).toEqual(['true', 'false'])
    fireEvent.click(lista!)
    expect([capas!.getAttribute('aria-pressed'), lista!.getAttribute('aria-pressed')]).toEqual(['false', 'true'])
    expect(urlNow().get('ver')).toBe('lista')
  })

  it('busca: placeholder "Buscar por título"; botão "Limpar busca" só com texto; ignora acento', async () => {
    let alvo = ''
    const { all } = mountCanal({ mut: (ds: Dataset, id) => { const x = ds.videos.find(v => v.ch === id && v.tracked)!; alvo = x.id; x.title = 'Pôr do Sol em São Paulo' } })
    const user = userEvent.setup()
    const input = screen.getByRole('searchbox', { name: 'Buscar por título' }) as HTMLInputElement
    expect(input.placeholder).toBe('Buscar por título')
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).toBeNull()
    await user.type(input, 'SAO paulo')
    expect(screen.getByRole('button', { name: 'Limpar busca' })).not.toBeNull()
    expect(cartoes().map(c => c.dataset.id)).toEqual([alvo])
    expect(urlNow().get('q')).toBe('SAO paulo')
    await user.click(screen.getByRole('button', { name: 'Limpar busca' }))
    expect(input.value).toBe('')
    expect(document.activeElement).toBe(input)
    expect(cartoes().length).toBeGreaterThan(50)
    expect(urlNow().has('q')).toBe(false)
    expect(all.length).toBeGreaterThan(0)
  })

  it('Esc na busca com texto limpa a busca', async () => {
    mountCanal()
    const user = userEvent.setup()
    const input = screen.getByRole('searchbox', { name: 'Buscar por título' }) as HTMLInputElement
    await user.type(input, 'ai{Escape}')
    expect(input.value).toBe('')
  })

  it('digitar "[" na busca não dispara atalho nenhum', async () => {
    mountCanal()
    const input = screen.getByRole('searchbox', { name: 'Buscar por título' }) as HTMLInputElement
    input.focus()
    // nenhuma tecla é interceptada: o evento chega ao campo sem preventDefault e o foco não sai dele
    for (const key of ['[', ']']) expect(fireEvent.keyDown(input, { key })).toBe(true)
    await userEvent.setup().keyboard('[[')   // "[[" é o "[" literal do user-event
    expect(input.value).toBe('[')
    expect(document.activeElement).toBe(input)
    expect(push).not.toHaveBeenCalled()
  })

  it('cada troca de filtro atualiza a lista no mesmo render e escreve a URL sem navegar', () => {
    const { view } = mountCanal()
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const c = montarLista(view.videos.videos, { ...view.state, fmt: 'shorts' })
    fireEvent.click(screen.getByRole('button', { name: /^Shorts, / }))
    expect(cartoes().map(x => x.dataset.id)).toEqual(c.secoes.flatMap(s => s.itens.map(v => v.id)).filter((_, i) => i < cartoes().length))
    expect(cartoes().length).toBe(c.visiveis.length)
    expect(replaceState).toHaveBeenCalledTimes(1)
    expect(String(replaceState.mock.calls[0]![2])).toContain('fmt=shorts')
    expect(screen.getByRole('button', { name: /^Shorts, / }).getAttribute('aria-pressed')).toBe('true')
    expect(push).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled()
  })

  it('o resto da URL (from, back) fica quando o filtro muda', () => {
    window.history.replaceState(null, '', '/cms/youtube/competitors/canal/matt-wolfe?from=outliers&back=%3Fniche%3Dviagem')
    mountCanal({ sp: { from: 'outliers' } })
    fireEvent.click(screen.getByRole('button', { name: /^Longos, / }))
    const q = urlNow()
    expect(q.get('from')).toBe('outliers'); expect(q.get('back')).toBe('?niche=viagem'); expect(q.get('fmt')).toBe('longos')
  })

  it('o status (role=status, aria-atomic) anuncia uma vez por mudança, 500 ms depois da última tecla, e nunca move o foco', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const { view } = mountCanal()
    const st = statusEl()
    expect(st.getAttribute('role')).toBe('status'); expect(st.getAttribute('aria-atomic')).toBe('true')
    const input = screen.getByRole('searchbox', { name: 'Buscar por título' }) as HTMLInputElement
    input.focus()
    for (const ch of ['a', 'i', ' ']) { fireEvent.change(input, { target: { value: input.value + ch } }); act(() => { vi.advanceTimersByTime(200) }) }
    expect(st.textContent).toBe('')
    act(() => { vi.advanceTimersByTime(299) })
    expect(st.textContent).toBe('')
    act(() => { vi.advanceTimersByTime(2) })
    const esperado = montarLista(view.videos.videos, { ...view.state, q: 'ai ' }).resultado
    expect(st.textContent).toBe(esperado)
    expect(esperado).toMatch(/com “ai”$/)
    expect(document.activeElement).toBe(input)
    // e não repete sozinho
    act(() => { vi.advanceTimersByTime(5000) })
    expect(st.textContent).toBe(esperado)
  })

  it('ao trocar a vista o status diz "Vista Lista, <n> vídeos"', () => {
    const { view } = mountCanal()
    const n = montarLista(view.videos.videos, view.state).visiveis.length
    fireEvent.click(within(screen.getByRole('group', { name: 'Vista' })).getByRole('button', { name: /Lista/ }))
    expect(norm(statusEl().textContent)).toBe(`Vista Lista, ${n} vídeos`)
    fireEvent.click(within(screen.getByRole('group', { name: 'Vista' })).getByRole('button', { name: /Capas/ }))
    expect(norm(statusEl().textContent)).toBe(`Vista Capas, ${n} vídeos`)
  })

  it('ao trocar o formato o status diz o formato e a contagem; o foco fica no botão', () => {
    mountCanal()
    const b = screen.getByRole('button', { name: /^Shorts, / })
    b.focus()
    fireEvent.click(b)
    expect(norm(statusEl().textContent)).toMatch(/^Shorts, \d+ vídeos$/)
    expect(document.activeElement).toBe(b)
  })

  it('busca vazia dentro de um filtro mostra "Buscar em Todos" e o botão troca o filtro mantendo a busca', async () => {
    let alvo = ''
    mountCanal({ sp: { fmt: 'shorts', q: 'zzqxunico' }, mut: (ds: Dataset, id) => { const x = ds.videos.find(v => v.ch === id && v.tracked && v.fmt === 'long')!; alvo = x.id; x.title = 'zzqxunico video longo' } })
    expect(cartoes()).toHaveLength(0)
    expect(screen.getByText('Nenhum Short com “zzqxunico”. Há 1 em Todos.')).not.toBeNull()
    expect(within(document.querySelector<HTMLElement>('.cv-empty')!).getByRole('button', { name: 'Limpar busca' })).not.toBeNull()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Buscar em Todos' }))
    expect(cartoes().map(c => c.dataset.id)).toEqual([alvo])
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('zzqxunico')
    expect(urlNow().has('fmt')).toBe(false); expect(urlNow().get('q')).toBe('zzqxunico')
  })

  it('busca sem resultado em Todos: só "Limpar busca"', () => {
    mountCanal({ sp: { q: 'zzqxnaoexiste' } })
    expect(screen.getByText('Nenhum vídeo com “zzqxnaoexiste”.')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Buscar em Todos' })).toBeNull()
  })

  it('filtro sem vídeos mostra a frase do spec', () => {
    mountCanal({ sp: { fmt: 'fixados' } })
    expect(screen.getByText('Nenhum vídeo fixado. Fixe um vídeo para acompanhá-lo mesmo quando sair dos mais recentes.')).not.toBeNull()
  })

  it('canal sem vídeos: a frase do spec e "Sincronizar só este canal"; sem controles', () => {
    const { act: a } = mountCanal({ mut: (ds: Dataset, id) => { ds.videos = ds.videos.filter(v => v.ch !== id) } })
    expect(screen.getByText('Este canal ainda não tem vídeos sincronizados.')).not.toBeNull()
    expect(screen.queryByRole('group', { name: 'Formato' })).toBeNull()
    const botoes = screen.getAllByRole('button', { name: 'Sincronizar só este canal' })
    expect(botoes.length).toBeGreaterThan(0)
    expect(a.onSyncOne).not.toHaveBeenCalled()
  })

  it('a nota fixa sob a grade explica o múltiplo e as views por dia', () => {
    const { view } = mountCanal()
    expect(norm(document.querySelector('.cv-foot')!.textContent)).toBe(norm(view.videos.nota))
  })

  it('a linha de controles só é presa em tela larga e alta (media query) e o alvo de foco respeita --obs-sticky-h', async () => {
    mountCanal()
    const fs = await import('node:fs'), path = await import('node:path')
    const css = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_canal/canal.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toMatch(/@media \(min-width:768px\) and \(min-height:600px\)\{[^}]*\.cv-ctl\{[^}]*position:sticky[^}]*z-index:var\(--z-grudado\)/)
    expect(css).toMatch(/scroll-margin-top:calc\(var\(--obs-sticky-h(?:,0px)?\) \+ 12px\)/)
    // fora da condição a barra não é presa
    expect(css.replace(/@media \(min-width:768px\) and \(min-height:600px\)\{[\s\S]*?\}\}/, '')).not.toMatch(/\.cv-ctl\{[^}]*position:sticky/)
  })

  it('--obs-sticky-h: ResizeObserver escreve a altura da barra quando ela é presa e 0 fora disso', () => {
    const observed: Array<() => void> = []
    vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { observed.push(cb) } observe() {} disconnect() {} unobserve() {} })
    const mq = (matches: boolean) => vi.fn().mockImplementation((q: string) => ({ matches, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
    window.matchMedia = mq(true) as unknown as typeof window.matchMedia
    mountCanal()
    const raiz = document.querySelector<HTMLElement>('[data-obs-screen="canal"]')!
    const barra = document.querySelector<HTMLElement>('.cv-ctl')!
    vi.spyOn(barra, 'getBoundingClientRect').mockReturnValue({ height: 50 } as DOMRect)
    act(() => { observed.forEach(f => f()) })
    expect(raiz.style.getPropertyValue('--obs-sticky-h')).toBe('50px')
    cleanup()
    window.matchMedia = mq(false) as unknown as typeof window.matchMedia
    mountCanal()
    const raiz2 = document.querySelector<HTMLElement>('[data-obs-screen="canal"]')!
    act(() => { observed.forEach(f => f()) })
    expect(raiz2.style.getPropertyValue('--obs-sticky-h')).toBe('0px')
    vi.unstubAllGlobals()
    // @ts-expect-error limpa o stub do jsdom
    delete window.matchMedia
  })
})

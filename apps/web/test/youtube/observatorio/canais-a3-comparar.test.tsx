// @vitest-environment jsdom
// A3 Tarefa 10: as entradas da comparação: "Comparar" em cada linha e cartão de Canais (coluna "Com o meu canal"), "Comparar com o meu canal" no
// cabeçalho do concorrente, e o foco que volta ao gatilho (D18). Casos de canais próprios: nenhum, um, dois (um sem vídeos).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => true,
}))
import { render, screen, within, cleanup, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { a3World } from './a3-fixture'
import { canalWorld } from './canal-fixture'
import { buildCanaisView, nicheOptions, type CanaisParams, type CanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { buildCanalView } from '@/app/cms/(authed)/youtube/competitors/_canal/view-model'
import { CanalScreen, type CanalActions } from '@/app/cms/(authed)/youtube/competitors/_canal/canal-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import { lembrarGatilho, lerGatilho } from '@/app/cms/(authed)/youtube/competitors/_chrome/gatilho-volta'
import { link } from '@/lib/youtube/observatorio/links'
import type { Observatory } from '@/lib/youtube/observatorio'
import { principalDoMotor } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'

const replace = vi.fn(), refresh = vi.fn(), push = vi.fn(), prefetch = vi.fn()
let search = 'fmt=longos'
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push, prefetch, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(search),
}))

const DIA = 86_400_000
const ok = async () => ({ ok: true })
const view = (obs: Observatory, p: Partial<CanaisParams> = {}) => buildCanaisView(obs, { niche: 'todos', limit: 75, fmt: 'longos', ...p })
const tree = (v: CanaisView) => (
  <ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><div data-obs-chrome=""><button type="button" aria-label="Mais ações">⋯</button></div>
    <CanaisScreen view={v} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} />
  </div></ChromeSyncContext.Provider></ToastProvider>
)
const mount = (obs: Observatory, p: Partial<CanaisParams> = {}) => { search = `fmt=longos${p.layout ? '&layout=' + p.layout : ''}`; return render(tree(view(obs, p))) }

const SEM_PROPRIO = () => a3World(ds => {
  const own = new Set(ds.channels.filter(c => c.own).map(c => c.id))
  ds.channels = ds.channels.filter(c => !own.has(c.id)); ds.videos = ds.videos.filter(v => !own.has(v.ch))
})
const UM = () => a3World(undefined, '1')
const DOIS = () => a3World()
/** O MAIOR canal próprio sem vídeos: o principal (`escolherPrincipal`) é o segundo. */
const PRIMEIRO_SEM_VIDEOS = () => a3World(ds => {
  const first = ds.channels.filter(c => c.own).sort((a, b) => (b.subs ?? 0) - (a.subs ?? 0))[0]!
  ds.videos = ds.videos.filter(v => v.ch !== first.id)
})
const principalDe = (obs: Observatory, lembrado: string | null = null) => obs.channel(principalDoMotor(obs, lembrado)!)!

const FORA_DO_ARMAZENAMENTO = (() => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) }, clear: () => m.clear() } })()
beforeEach(() => {
  replace.mockReset(); refresh.mockReset(); push.mockReset(); prefetch.mockReset()
  FORA_DO_ARMAZENAMENTO.clear()
  vi.stubGlobal('localStorage', FORA_DO_ARMAZENAMENTO)
  window.sessionStorage.clear()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); document.getElementById('flut')?.remove() })

const linksComparar = (root: ParentNode) => [...root.querySelectorAll<HTMLAnchorElement>('a[data-comparar]')]

describe('"Comparar" na tabela', () => {
  it('cada linha de concorrente tem "Comparar" na coluna "Com o meu canal", com o nome acessível "Comparar <canal> com o meu canal"', () => {
    const w = DOIS(), v = view(w.obs)
    const { container } = mount(w.obs)
    const cab = [...container.querySelectorAll('thead th')].find(th => th.textContent?.includes('Com o meu canal'))
    expect(cab, 'cabeçalho "Com o meu canal"').toBeDefined()
    const idx = [...cab!.parentElement!.children].indexOf(cab!)
    const linhas = [...container.querySelectorAll<HTMLElement>('tbody tr.row')]
    const concorrentes = linhas.filter(l => !l.classList.contains('you'))
    expect(concorrentes.length).toBeGreaterThan(5)
    for (const l of concorrentes) {
      const nome = [...v.list.ranked, ...v.list.unranked].find(r => r.id === l.dataset.id)!.name
      const a = l.children[idx]!.querySelector('a')!
      expect(a.textContent, nome).toBe('Comparar')
      // com dois canais próprios com vídeos o nome acessível diz de qual (11c, D-C.5); o texto visível não muda
      expect(screen.getByRole('link', { name: `Comparar ${nome} com o meu canal (${principalDe(w.obs).name})` })).toBe(a)
    }
  })
  it('o link leva a comparar?a=<canal próprio principal>&b=<concorrente>', () => {
    const w = DOIS(), principal = principalDe(w.obs)
    const { container } = mount(w.obs)
    const links = linksComparar(container)
    expect(links.length).toBeGreaterThan(5)
    for (const a of links) {
      const b = a.closest('tr')!.dataset.id!
      expect(a.getAttribute('href')).toBe(link.comparar(principal.id, b))
    }
  })
  it('com dois canais próprios, o primeiro SEM vídeos: o "meu canal" do link é o que tem vídeos', () => {
    const w = PRIMEIRO_SEM_VIDEOS(), principal = principalDe(w.obs)
    expect(principal.id).not.toBe(w.obs.ownChannels()[0]!.id)
    const { container } = mount(w.obs)
    for (const a of linksComparar(container)) expect(a.getAttribute('href')).toContain('a=' + encodeURIComponent(principal.id))
  })
  it('um canal próprio: o link usa esse canal; o canal próprio não tem "Comparar" (traço no lugar, sem promessa de ação)', () => {
    const w = UM()
    const { container } = mount(w.obs)
    const own = container.querySelector<HTMLElement>('tbody tr.row.you')!
    expect(own.querySelector('a[data-comparar]')).toBeNull()
    expect(own.textContent).not.toMatch(/Comparar/)
    const a = linksComparar(container)[0]!
    expect(a.getAttribute('href')).toContain('a=' + encodeURIComponent(w.owns[0]!))
  })
  it('canal próprio nunca tem "Comparar", com um ou dois, em qualquer filtro de formato', () => {
    for (const w of [UM(), DOIS()]) for (const fmt of ['longos', 'shorts', 'todos'] as const) {
      cleanup()
      const { container } = mount(w.obs, { fmt })
      for (const l of container.querySelectorAll<HTMLElement>('tbody tr.row.you')) expect(l.querySelector('a[data-comparar]'), l.dataset.id).toBeNull()
      for (const a of linksComparar(container)) expect(w.owns).not.toContain(a.closest('tr')!.dataset.id)
    }
  })
  it('site sem canal próprio não tem a coluna nem o link, nem nos cartões', () => {
    const w = SEM_PROPRIO()
    expect(view(w.obs).compararColuna).toBe(false)
    const { container } = mount(w.obs)
    expect([...container.querySelectorAll('thead th')].some(th => /Com o meu canal/.test(th.textContent ?? ''))).toBe(false)
    expect(linksComparar(container)).toHaveLength(0)
    expect(container.textContent).not.toMatch(/Comparar/)
    cleanup()
    const c = mount(w.obs, { layout: 'cards' })
    expect(c.container.textContent).not.toMatch(/Comparar/)
  })
  it('os dois canais próprios sem vídeos: nenhum destino válido, então nenhum "Comparar" (a frase só aparece com a ação habilitada)', () => {
    const w = a3World(ds => { const own = new Set(ds.channels.filter(c => c.own).map(c => c.id)); ds.videos = ds.videos.filter(v => !own.has(v.ch)) })
    expect(view(w.obs).compararColuna).toBe(false)
    expect(linksComparar(mount(w.obs).container)).toHaveLength(0)
  })
  it('a coluna "Com o meu canal" existe em Todos, Longos e Shorts', () => {
    for (const fmt of ['longos', 'shorts', 'todos'] as const) {
      cleanup()
      const { container } = mount(DOIS().obs, { fmt })
      expect(linksComparar(container).length, fmt).toBeGreaterThan(5)
    }
  })
  it('o clique na linha fora do link continua abrindo a página do canal; o clique em "Comparar" não abre a página', async () => {
    const user = userEvent.setup()
    const w = DOIS()
    const { container } = mount(w.obs)
    const linha = container.querySelector<HTMLElement>('tbody tr.row:not(.you)')!
    const a = linha.querySelector<HTMLAnchorElement>('a[data-comparar]')!
    a.addEventListener('click', e => e.preventDefault()) // o jsdom não navega
    await user.click(a)
    expect(push).not.toHaveBeenCalled()
    await user.click(linha.querySelector('td.cmp')!) // a célula, fora do link: é da linha, e a linha abre a página do canal
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith(link.canal(linha.dataset.id!))
  })
})

describe('"Comparar" com vários canais próprios: a regra única, a escolha do dono e o nome acessível (11c, D-C)', () => {
  /** O canal próprio que NÃO é o padrão por recência no mundo de dois canais. */
  const outroDe = (w: ReturnType<typeof DOIS>) => w.owns.find(id => id !== principalDe(w.obs).id)!
  it('sem escolha: o link e o rótulo falam do canal próprio de publicação mais recente', () => {
    const w = DOIS(), principal = principalDe(w.obs)
    const maisRecente = w.obs.ownChannels().map(c => ({ id: c.id, t: Math.max(...w.obs.videos.filter(v => v.ch === c.id).map(v => v.pub)) })).sort((a, b) => b.t - a.t)[0]!
    expect(principal.id).toBe(maisRecente.id)
    for (const a of linksComparar(mount(w.obs).container)) expect(a.getAttribute('href')).toContain('a=' + encodeURIComponent(principal.id))
  })
  it('13 (I-11c-3): o canal que publicou por último NÃO é o primeiro nem o maior: a recência decide a lista, o link, o rótulo e a linha presa; a lembrança de outro canal ativo vence, a de canal parado cede', () => {
    // o MAIOR recua 40 dias (ainda ativo); o menor passa a ser o mais recente. Um mutante que ignora a recência escolheria o maior (o primeiro da lista)
    const w = a3World(ds => {
      const [grande] = ds.channels.filter(c => c.own).sort((a, b) => (b.subs ?? 0) - (a.subs ?? 0))
      for (const v of ds.videos) if (v.ch === grande!.id) v.pub -= 40 * DIA
    })
    const [maior, menor] = w.obs.ownChannels() // ordem do motor: inscritos, maior primeiro
    const ultimo = (id: string) => Math.max(...w.obs.videos.filter(v => v.ch === id).map(v => v.pub))
    expect(w.obs.channel(maior!.id)!.subs!).toBeGreaterThan(w.obs.channel(menor!.id)!.subs!)
    expect(ultimo(menor!.id)).toBeGreaterThan(ultimo(maior!.id)) // o ponto de partida: o mais recente é o MENOR
    expect(w.obs.NOW - ultimo(maior!.id)).toBeLessThan(91 * DIA) // e o maior continua ativo
    expect(principalDe(w.obs).id).toBe(menor!.id)
    const v = view(w.obs)
    expect(v.pe!.canalId).toBe(menor!.id)
    for (const a of linksComparar(mount(w.obs).container)) {
      expect(a.getAttribute('href')).toBe(link.comparar(menor!.id, a.closest('tr')!.dataset.id!))
      expect(a.getAttribute('aria-label')).toContain(`(${menor!.name})`)
    }
    cleanup()
    // a lembrança do canal que NÃO é o mais recente (mas ativo) vence a recência
    expect(view(w.obs, { lembrado: maior!.id }).pe!.canalId).toBe(maior!.id)
    expect(principalDe(w.obs, maior!.id).id).toBe(maior!.id)
    // a lembrança que aponta para o mais recente: ele mesmo
    expect(view(w.obs, { lembrado: menor!.id }).pe!.canalId).toBe(menor!.id)
    // lembrança de canal PARADO cede ao ativo: o maior recua 200 dias e o cookie dele não segura
    const parado = a3World(ds => {
      const [grande] = ds.channels.filter(c => c.own).sort((a, b) => (b.subs ?? 0) - (a.subs ?? 0))
      for (const x of ds.videos) if (x.ch === grande!.id) x.pub -= 200 * DIA
    })
    const [pMaior, pMenor] = parado.obs.ownChannels()
    expect(view(parado.obs, { lembrado: pMaior!.id }).pe!.canalId).toBe(pMenor!.id)
    // o teste que apaga o cookie: sem lembrança, de volta à recência
    expect(view(w.obs, { lembrado: null }).pe!.canalId).toBe(menor!.id)
  })
  it('com a escolha do dono (cookie) em outro canal ativo: o link, o nome acessível e a linha presa mudam juntos', () => {
    const w = DOIS(), outro = outroDe(w), nome = w.obs.channel(outro)!.name
    const v = view(w.obs, { lembrado: outro })
    const { container } = mount(w.obs, { lembrado: outro })
    for (const a of linksComparar(container)) {
      expect(a.getAttribute('href')).toBe(link.comparar(outro, a.closest('tr')!.dataset.id!))
      expect(a.getAttribute('aria-label')).toMatch(new RegExp(`com o meu canal \\(${nome}\\)$`))
    }
    expect(v.pe!.canalId).toBe(outro) // a linha presa fala do MESMO canal
    cleanup()
    // o teste que apaga o cookie: sem ele, volta à recência
    expect(view(w.obs, { lembrado: null }).pe!.canalId).toBe(principalDe(w.obs).id)
    expect(view(w.obs).pe!.canalId).toBe(principalDe(w.obs).id)
  })
  it('lembrança de canal que não é próprio, removido ou lixo: ignorada, sem erro', () => {
    const w = DOIS(), esperado = principalDe(w.obs).id
    const concorrente = w.obs.channels.find(c => !c.own)!.id
    for (const lembrado of [concorrente, '00000000-0000-4000-8000-0000000000ff', 'lixo', '']) {
      expect(view(w.obs, { lembrado }).pe!.canalId, lembrado).toBe(esperado)
      expect(linksComparar(mount(w.obs, { lembrado }).container)[0]!.getAttribute('href'), lembrado).toContain('a=' + encodeURIComponent(esperado))
      cleanup()
    }
  })
  it('um só canal com vídeos (o outro é canal novo): o nome acessível é o de antes, sem o nome do canal', () => {
    const w = PRIMEIRO_SEM_VIDEOS()
    for (const a of linksComparar(mount(w.obs).container)) expect(a.getAttribute('aria-label')).toMatch(/^Comparar .+ com o meu canal$/)
  })
  it('a lembrança de um canal sem vídeos (canal novo) é ignorada', () => {
    const w = PRIMEIRO_SEM_VIDEOS(), semVideos = w.obs.ownChannels().find(c => !w.obs.videos.some(v => v.ch === c.id))!
    expect(view(w.obs, { lembrado: semVideos.id }).pe!.canalId).toBe(principalDe(w.obs).id)
  })
})

describe('"Comparar" nos cartões', () => {
  it('nos cartões o link diz "Comparar com o meu canal", com o mesmo destino da linha', () => {
    const w = DOIS(), principal = principalDe(w.obs)
    const { container } = mount(w.obs, { layout: 'cards' })
    const links = linksComparar(container)
    expect(links.length).toBeGreaterThan(5)
    for (const a of links) {
      expect(a.textContent).toBe('Comparar com o meu canal')
      const nome = a.closest('article')!.querySelector('.nm, .nmbtn, a')?.textContent
      expect(a.getAttribute('href')).toBe(link.comparar(principal.id, a.closest('article')!.dataset.id!))
      expect(a.getAttribute('aria-label') ?? '').toMatch(/^Comparar .+ com o meu canal \(.+\)$/)
      expect(nome).toBeTruthy()
    }
    for (const art of container.querySelectorAll<HTMLElement>('article.you')) expect(art.querySelector('a[data-comparar]')).toBeNull()
  })
})

describe('o gatilho de "Comparar" e o Voltar (D18)', () => {
  /** O jsdom não tem layout: a raiz "está à vista" quando devolve um retângulo. */
  const comLayout = () => vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) { return [{}] as unknown as DOMRectList })
  const voltar = () => act(() => { window.dispatchEvent(new PopStateEvent('popstate')) })

  it('o gatilho usado é lembrado; ao voltar (popstate) a lista põe o foco no "Comparar" daquela linha', async () => {
    comLayout()
    const user = userEvent.setup()
    const w = DOIS()
    const { container } = mount(w.obs)
    const links = linksComparar(container)
    const alvo = links[3]!, id = alvo.closest('tr')!.dataset.id!
    alvo.addEventListener('click', e => e.preventDefault())
    await user.click(alvo)
    expect(window.sessionStorage.getItem('obs:gatilho-comparar')).toContain(id)
    ;(document.activeElement as HTMLElement | null)?.blur()
    voltar()
    await waitFor(() => expect(document.activeElement).toBe(alvo))
    expect(lerGatilho('canais'), 'o registro vale um Voltar só').toBeNull()
  })
  it('a tela REMONTADA depois de um Voltar (o Next remonta a rota, às vezes dentro do próprio popstate) também põe o foco no gatilho', async () => {
    comLayout()
    const user = userEvent.setup()
    const w = DOIS()
    const primeira = mount(w.obs)
    const alvo0 = linksComparar(primeira.container)[4]!, id = alvo0.dataset.comparar!
    alvo0.addEventListener('click', e => e.preventDefault())
    await user.click(alvo0)
    primeira.unmount(); cleanup() // a pessoa foi para a comparação: a lista saiu da tela
    voltar() // o Voltar...
    const segunda = mount(w.obs) // ...e só então a lista monta de novo
    await waitFor(() => expect(document.activeElement).toBe(linksComparar(segunda.container).find(a => a.dataset.comparar === id)))
  })
  it('uma montagem nova SEM Voltar (a pessoa chegou por um link) não move o foco, mesmo com um registro velho na sessão', async () => {
    comLayout()
    window.sessionStorage.setItem('obs:gatilho-comparar', JSON.stringify({ lugar: 'canais', canalId: 'qualquer', t: Date.now() }))
    window.sessionStorage.removeItem('obs:gatilho-pop')
    // o instante do último popstate está longe: uma montagem que não veio de um Voltar
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(Date.now() + 60_000)
    try {
      mount(DOIS().obs)
      ;(document.activeElement as HTMLElement | null)?.blur()
      const antes = document.activeElement
      await new Promise(r => setTimeout(r, 60))
      expect(document.activeElement).toBe(antes)
    } finally { vi.useRealTimers() }
  })
  it('I-1: uma montagem da lista sem Voltar APAGA o registro da lista que ficou de uma saída por outro caminho; o de outro lugar fica', async () => {
    comLayout()
    window.sessionStorage.setItem('obs:gatilho-pop', '0')
    lembrarGatilho('canais', 'qualquer')
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(Date.now() + 120_000)
    try {
      mount(DOIS().obs)
      await new Promise(r => setTimeout(r, 40))
      expect(window.sessionStorage.getItem('obs:gatilho-comparar')).toBeNull()
    } finally { vi.useRealTimers() }
  })
  it('I-1: o registro de outra URL de origem não leva o foco ao "Comparar" quando um Voltar chega à lista', async () => {
    comLayout()
    const user = userEvent.setup()
    const w = DOIS()
    window.history.replaceState(null, '', '/cms/youtube/competitors?fmt=longos')
    const { container } = mount(w.obs)
    const alvo = linksComparar(container)[3]!
    alvo.addEventListener('click', e => e.preventDefault())
    await user.click(alvo) // gravou com a URL ?fmt=longos
    window.history.replaceState(null, '', '/cms/youtube/competitors?fmt=longos&sort=vpd') // saiu pela trilha e voltou a uma lista de outra URL
    ;(document.activeElement as HTMLElement | null)?.blur()
    const antes = document.activeElement
    voltar()
    await new Promise(r => setTimeout(r, 60))
    expect(document.activeElement).toBe(antes)
    expect(window.sessionStorage.getItem('obs:gatilho-comparar')).toBeNull()
  })
  it('o clique com tecla de modificação (outra aba) não lembra nada', async () => {
    const user = userEvent.setup()
    const { container } = mount(DOIS().obs)
    const a = linksComparar(container)[0]!
    a.addEventListener('click', e => e.preventDefault())
    await user.keyboard('{Control>}'); await user.click(a); await user.keyboard('{/Control}')
    expect(window.sessionStorage.getItem('obs:gatilho-comparar')).toBeNull()
  })
  it('no cartão, o Voltar põe o foco no link do cartão daquele canal', async () => {
    comLayout()
    const user = userEvent.setup()
    const { container } = mount(DOIS().obs, { layout: 'cards' })
    const alvo = linksComparar(container)[2]!
    alvo.addEventListener('click', e => e.preventDefault())
    await user.click(alvo)
    ;(document.activeElement as HTMLElement | null)?.blur()
    voltar()
    await waitFor(() => expect(document.activeElement).toBe(alvo))
  })
  it('sem registro, a tela volta como hoje: o foco não se mexe', async () => {
    comLayout()
    mount(DOIS().obs)
    ;(document.activeElement as HTMLElement | null)?.blur()
    const antes = document.activeElement
    voltar()
    await new Promise(r => setTimeout(r, 60))
    expect(document.activeElement).toBe(antes)
  })
  it('com armazenamento que lança, o clique e o Voltar não quebram e a tela volta como hoje', async () => {
    comLayout()
    const user = userEvent.setup()
    const quebra = { getItem() { throw new Error('bloqueado') }, setItem() { throw new Error('bloqueado') }, removeItem() { throw new Error('bloqueado') } }
    vi.stubGlobal('sessionStorage', quebra)
    const { container } = mount(DOIS().obs)
    const a = linksComparar(container)[0]!
    a.addEventListener('click', e => e.preventDefault())
    await user.click(a)
    ;(document.activeElement as HTMLElement | null)?.blur()
    const antes = document.activeElement
    expect(() => voltar()).not.toThrow()
    await new Promise(r => setTimeout(r, 60))
    expect(document.activeElement).toBe(antes)
  })
  it('um registro de OUTRO lugar (o cabeçalho do canal) não move o foco da lista e fica para quem vai ler', async () => {
    comLayout()
    lembrarGatilho('canal', 'x') // com a URL de origem desta tela
    mount(DOIS().obs)
    ;(document.activeElement as HTMLElement | null)?.blur()
    const antes = document.activeElement
    voltar()
    await new Promise(r => setTimeout(r, 60))
    expect(document.activeElement).toBe(antes)
    expect(lerGatilho('canal')).toBe('x')
  })
})

describe('cabeçalho do concorrente', () => {
  const okAct = async () => ({ ok: true })
  const actions = (): CanalActions => ({
    onSyncOne: vi.fn(async (_id: string) => ({ ok: true })), onRemove: vi.fn(async (_id: string) => ({ ok: true })),
    onRemovalImpact: vi.fn(async (_id: string) => ({ ok: false as const })), onSetNiche: vi.fn(async (_id: string, _n: string | null) => ({ ok: true })),
    onPin: vi.fn(async () => ({ ok: true as const })), onUnpin: vi.fn(async () => ({ ok: true as const })),
  })
  const mountCanal = (compararHref: string | null | undefined) => {
    const { obs, chId } = canalWorld()
    const v = buildCanalView(obs, chId, {})!
    window.history.replaceState(null, '', '/cms/youtube/competitors/canal/' + chId)
    const r = render(<ToastProvider><div data-obs=""><CanalScreen view={v} niches={nicheOptions(obs)} canAdmin leitura={null} actions={actions()} {...(compararHref === undefined ? {} : { compararHref })} /></div></ToastProvider>)
    return { ...r, chId, okAct }
  }
  const HREF = link.comparar('proprio-1', 'matt-wolfe')

  it('"Comparar com o meu canal" ao lado de "Abrir no YouTube", fora do menu ⋯; sem canal próprio, ausente', async () => {
    const user = userEvent.setup()
    const { container, unmount } = mountCanal(HREF)
    const b = screen.getByRole('link', { name: 'Comparar com o meu canal' })
    expect(b.getAttribute('href')).toBe(HREF)
    const abrir = screen.getByRole('link', { name: /^Abrir no YouTube/ })
    expect(b.parentElement).toBe(abrir.parentElement) // o mesmo grupo de ações
    expect(b.nextElementSibling).toBe(abrir)
    expect(b.closest('.acts')).not.toBeNull()
    // fora do menu ⋯: o menu não o tem
    await user.click(screen.getByRole('button', { name: 'Ações do canal' }))
    const menu = within(document.getElementById('flut')!).getByRole('menu')
    expect(within(menu).queryByText(/Comparar/)).toBeNull()
    expect(container.querySelectorAll('.btn-primary,.btn-forja-solid')).toHaveLength(0) // nenhum botão preenchido novo
    unmount(); cleanup()
    for (const sem of [null, undefined]) {
      const r = mountCanal(sem)
      expect(screen.queryByText(/Comparar/)).toBeNull()
      expect(r.container.textContent).not.toMatch(/Comparar/)
      r.unmount(); cleanup()
    }
  })
  it('o clique no botão lembra o gatilho do cabeçalho; o Voltar põe o foco nele', async () => {
    vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) { return [{}] as unknown as DOMRectList })
    const user = userEvent.setup()
    const { chId } = mountCanal(HREF)
    const b = screen.getByRole('link', { name: 'Comparar com o meu canal' })
    b.addEventListener('click', e => e.preventDefault())
    await user.click(b)
    expect(window.sessionStorage.getItem('obs:gatilho-comparar')).toContain(chId)
    ;(document.activeElement as HTMLElement | null)?.blur()
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')) })
    await waitFor(() => expect(document.activeElement).toBe(b))
  })
  it('I-1: a página do canal montada SEM Voltar apaga o registro que ficou de uma saída por outro caminho (um Voltar de um vídeo não perde o foco do último vídeo visto)', async () => {
    vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) { return [{}] as unknown as DOMRectList })
    window.sessionStorage.setItem('obs:gatilho-pop', '0')
    const { chId } = mountCanal(HREF) // monta a página (define a URL do canal)
    cleanup()
    window.history.replaceState(null, '', '/cms/youtube/competitors/canal/' + chId)
    lembrarGatilho('canal', chId) // saiu da comparação pela trilha: o registro ficou
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(Date.now() + 5 * 60_000)
    try {
      mountCanal(HREF)
      await new Promise(r => setTimeout(r, 40))
      expect(window.sessionStorage.getItem('obs:gatilho-comparar')).toBeNull()
    } finally { vi.useRealTimers() }
  })
  it('sem registro o Voltar não mexe no foco do cabeçalho', async () => {
    vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) { return [{}] as unknown as DOMRectList })
    mountCanal(HREF)
    ;(document.activeElement as HTMLElement | null)?.blur()
    const antes = document.activeElement
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')) })
    await new Promise(r => setTimeout(r, 60))
    expect(document.activeElement).toBe(antes)
  })
})

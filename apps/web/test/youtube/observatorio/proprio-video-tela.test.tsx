// @vitest-environment jsdom
// A4 Tarefa 11: a TELA do vídeo próprio — cabeçalho, faixa de seis números com um ⓘ só, paginador na trilha (apagado nas pontas, com o motivo),
// atalhos [ e ], foco depois de Anterior/Próximo, o registro do último vídeo visto (o Voltar da página do canal põe o foco no cartão), a frase
// de alcance e o lugar das Tarefas 12 e 13 (children). jsdom não navega: `next/link` vira um <a> que registra `replace`, e "trocar de vídeo" é
// re-renderizar a mesma tela com a vista do vizinho (o Next 16 não remonta quando só a query muda).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fs from 'node:fs'
import path from 'node:path'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { proprioWorld, primeiroProprio, DADOS } from './proprio-fixture'
import { TrailChrome } from '@/app/cms/(authed)/youtube/competitors/_chrome/trail-chrome'
import { Pager } from '@/app/cms/(authed)/youtube/competitors/_historico/pager'
import { limparPagerUsado } from '@/app/cms/(authed)/youtube/competitors/_historico/pager-usado'
import { lerUltimoVideo } from '@/app/cms/(authed)/youtube/competitors/_chrome/ultimo-video'
import { ProprioVideoScreen } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-screen'
import { buildProprioVideoPage } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-model'
import type { Dataset, ObsVideo } from '@/lib/youtube/observatorio/types'

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, refresh: vi.fn(), push: nav.push, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/video/x',
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('next/link', () => ({
  default: ({ href, replace, prefetch: _p, onClick, children, ...rest }: { href: string; replace?: boolean; prefetch?: boolean; onClick?: (e: ReactMouseEvent<HTMLAnchorElement>) => void; children?: ReactNode } & Record<string, unknown>) => (
    <a href={href} data-replace={replace ? 'true' : 'false'} onClick={e => { e.preventDefault(); onClick?.(e) }} {...rest}>{children}</a>
  ),
}))

const DAY = 86_400_000
const W = proprioWorld({
  mut: ds => {
    const ch = primeiroProprio(ds)
    const modelo = ds.videos.find(v => v.ch === ch.id && v.fmt === 'long' && v.tracked)!
    ds.videos = ds.videos.filter(v => v.ch !== ch.id)
    for (let i = 0; i < 5; i++) {
      const v: ObsVideo = structuredClone(modelo)
      Object.assign(v, { id: 'v' + i, ytId: 'yt' + i, title: 'Vídeo ' + i, pub: ds.now - (700 + i) * DAY, ageDays: 700 + i, fmt: 'long', isShort: false, tracked: true, views: i === 0 ? 118 : 138, likes: 12, comments: i === 2 ? null : 6, dur: 2397 })
      ds.videos.push(v)
    }
    void (null as unknown as Dataset)
  },
})
const dados = (c: keyof typeof DADOS = 'cheio') => DADOS[c](W.canalId, W.ytIds, W.hoje)
const ORIGEM = { from: 'canais', canal: W.canalId, back: '?sort=imp', ids: 'v0,v1,v2,v3,v4' }
const pagina = (id: string, sp: Record<string, string> = {}, d = dados()) => {
  const posicao = Number(id.slice(1)) + 1
  return buildProprioVideoPage(W.obs, id, { ...ORIGEM, pos: String(posicao), tot: '5', ...sp }, d)!
}

const Tela = ({ page, children }: { page: ReturnType<typeof pagina>; children?: ReactNode }) => (
  <TrailChrome crumbs={page.crumbs} aside={<Pager pager={page.pager} naTrilha />}>
    <ProprioVideoScreen header={page.header} pager={page.pager} alcanceNota={page.alcanceNota} fromCanal={page.fromCanal}>{children}</ProprioVideoScreen>
  </TrailChrome>
)
const mount = (id = 'v1', sp: Record<string, string> = {}, d = dados(), children?: ReactNode) => {
  const r = render(<Tela page={pagina(id, sp, d)}>{children}</Tela>)
  return { ...r, para: (j: string) => r.rerender(<Tela page={pagina(j, sp, d)}>{children}</Tela>) }
}
const raiz = () => document.querySelector<HTMLElement>('[data-obs-screen="video-proprio"]')!
const prev = () => document.querySelector<HTMLElement>('[data-pager-prev]')!
const next = () => document.querySelector<HTMLElement>('[data-pager-next]')!
const KEY = 'obs:ultimo-video:' + W.canalId

let erros: string[] = []
beforeEach(() => {
  nav.replace.mockClear(); nav.push.mockClear(); window.sessionStorage.clear(); limparPagerUsado(); erros = []
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { erros.push(a.map(String).join(' ')) })
})
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.restoreAllMocks() })

describe('T11 cabeçalho da tela', () => {
  it('a raiz NÃO é a tela do canal (o gatilho da volta procura essa raiz) e leva o selo "seu canal", o título e as ações', () => {
    mount()
    expect(raiz()).not.toBeNull()
    expect(document.querySelector('[data-obs-screen="canal"]')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Vídeo 1')
    expect(raiz().querySelector('.own-seal')!.textContent).toBe('seu canal')
    const yt = screen.getByRole('link', { name: /Abrir no YouTube/ })
    expect(yt.getAttribute('target')).toBe('_blank'); expect(yt.getAttribute('rel')).toContain('noopener')
    expect(screen.getByRole('button', { name: 'Ampliar thumbnail' })).toBeTruthy()
    expect(raiz().textContent).toMatch(/Publicado há 701 dias/)
  })

  it('"Ampliar thumbnail" abre o visualizador (diálogo) e o foco volta ao botão ao fechar', async () => {
    const user = userEvent.setup()
    mount()
    const b = screen.getByRole('button', { name: 'Ampliar thumbnail' })
    await user.click(b)
    const dlg = await screen.findByRole('dialog')
    expect(dlg).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(b)
  })

  it('a trilha é "Canais › <canal> › Vídeo" e o item do canal leva o back=', () => {
    mount('v1')
    const li = [...document.querySelectorAll('.crumbs li')].map(e => e.textContent)
    expect(li).toEqual(['Canais', W.obs.channel(W.canalId)!.name, 'Vídeo'])
    expect(screen.getByRole('link', { name: W.obs.channel(W.canalId)!.name }).getAttribute('href')).toContain('?sort=imp')
  })
})

describe('T11 faixa de números', () => {
  it('seis células na ordem, valor + rótulo, a segunda linha do rótulo onde o spec a pede', () => {
    mount('v0')
    const dl = raiz().querySelector('dl[aria-label="Números deste vídeo"]')!
    const nc = [...dl.querySelectorAll('.nc')]
    expect(nc).toHaveLength(6)
    expect(nc.map(e => e.querySelector('dt')!.firstChild!.textContent)).toEqual(['views', 'curtidas', 'comentários', 'engajamento', 'o normal do canal', 'duração'])
    expect(nc.map(e => e.querySelector('dd')!.textContent)).toEqual(['118', '12', '6', '15,3%', '0,9×', '39:57'])
    expect(nc[3]!.querySelector('.nsub')!.textContent).toBe('curtidas + comentários por view')
    expect(nc[4]!.querySelector('.nsub')!.textContent).toMatch(/^mediana dos outros 4: 138 views$/)
  })

  it('célula sem valor diz o motivo na pastilha "não medido"; nunca 0, nunca traço', () => {
    mount('v2')   // v2 tem comentários nulos
    const nc = [...raiz().querySelectorAll('dl .nc')]
    const com = nc[2]!, eng = nc[3]!
    expect(com.querySelector('dd .obs-ch-nm')!.textContent).toBe('não medido')
    expect(eng.querySelector('dd .obs-ch-nm')!.textContent).toBe('não medido')
    expect(com.textContent).not.toMatch(/\b0\b|—/)
  })

  it('UM ⓘ só; abre a base dos seis com a conta feita e não abre vazio', async () => {
    const user = userEvent.setup()
    mount('v0')
    const botoes = raiz().querySelectorAll('.ibtn')
    expect(botoes).toHaveLength(1)
    await user.click(botoes[0]!)
    const dlg = await screen.findByRole('dialog')
    const itens = within(dlg).getAllByRole('listitem')
    expect(itens).toHaveLength(6)
    expect(itens[3]!.textContent).toContain('(12 curtidas + 6 comentários) ÷ 118 views = 15,3%')
    expect(itens[4]!.textContent).toContain('118 ÷ 138 = 0,9×; 138 é a mediana de views dos outros 4 vídeos')
    for (const li of itens) expect(li.textContent!.replace(/^[^:]+:/, '').trim().length).toBeGreaterThan(10)
  })

  it('o ⓘ tem alvo de 44 px em ponteiro grosso (regra no CSS) e nome acessível', () => {
    mount('v0')
    expect(raiz().querySelector('.ibtn')!.getAttribute('aria-label')).toBe('De onde vêm os números deste vídeo')
  })
})

describe('T11 paginador na trilha', () => {
  it('Anterior/Próximo são links que SUBSTITUEM a entrada do histórico; a frase diz a ordem; "vídeo 2 de 5"', () => {
    mount('v1')
    expect(prev().getAttribute('href')).toContain('/video/v0'); expect(prev().getAttribute('data-replace')).toBe('true')
    expect(next().getAttribute('href')).toContain('/video/v2'); expect(next().getAttribute('data-replace')).toBe('true')
    expect(document.querySelector('[data-pager-pos]')!.textContent).toBe('vídeo 2 de 5, na ordem da lista: mais impressões primeiro')
    expect(document.querySelector('.obs-tr-aside')).not.toBeNull()        // mora na linha da trilha
    // em tela estreita os dois botões ficam lado a lado e a frase desce (a captura de 390 px gastava 140 px com os três empilhados)
    expect(document.querySelector('[data-pager]')!.hasAttribute('data-pager-compacto')).toBe(true)
  })

  it('no primeiro, "Anterior" fica na tela, apagado (aria-disabled), com o motivo no nome e na dica; clicar não faz nada', async () => {
    const user = userEvent.setup()
    mount('v0')
    const b = prev()
    expect(b.tagName).toBe('BUTTON'); expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(b.getAttribute('aria-label')).toBe('Não há vídeo anterior: este é o primeiro da lista')
    expect(b.getAttribute('title')).toBe('Não há vídeo anterior: este é o primeiro da lista')
    expect(b.textContent).toBe('Anterior')
    b.focus(); expect(document.activeElement).toBe(b)            // continua na ordem do Tab
    await user.click(b)
    expect(nav.replace).not.toHaveBeenCalled(); expect(nav.push).not.toHaveBeenCalled()
    expect(next().tagName).toBe('A')
  })

  it('no último, "Próximo" é o apagado', () => {
    mount('v4')
    expect(next().getAttribute('aria-disabled')).toBe('true')
    expect(next().getAttribute('aria-label')).toBe('Não há próximo vídeo: este é o último da lista')
    expect(prev().tagName).toBe('A')
  })

  it('[ e ] só funcionam com o foco no título ou no paginador: foco num botão qualquer, nada acontece', async () => {
    const user = userEvent.setup()
    mount('v1')
    const outro = screen.getByRole('button', { name: 'Ampliar thumbnail' })
    outro.focus()
    await user.keyboard(']'); await user.keyboard('[[')
    expect(nav.replace).not.toHaveBeenCalled()
    // no título: ] vai ao próximo, [ ao anterior, sempre por replace (o Voltar do navegador não entra em laço)
    screen.getByRole('heading', { level: 1 }).focus()
    await user.keyboard(']')
    expect(nav.replace).toHaveBeenLastCalledWith(next().getAttribute('href'))
    await user.keyboard('[[')
    expect(nav.replace).toHaveBeenLastCalledWith(prev().getAttribute('href'))
    // no paginador
    next().focus(); nav.replace.mockClear()
    await user.keyboard(']')
    expect(nav.replace).toHaveBeenCalledTimes(1)
    // com modificador: nada
    nav.replace.mockClear()
    fireEvent.keyDown(document.activeElement!, { key: ']', ctrlKey: true })
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('[ no primeiro e ] no último não navegam (o botão apagado não tem para onde ir)', async () => {
    const user = userEvent.setup()
    mount('v0')
    screen.getByRole('heading', { level: 1 }).focus()
    await user.keyboard('[[')
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('em campo de texto os atalhos não valem', () => {
    mount('v1', {}, dados(), <input aria-label="campo" />)
    const campo = screen.getByLabelText('campo')
    campo.focus()
    fireEvent.keyDown(campo, { key: ']' })
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('depois de Anterior/Próximo o foco vai ao botão usado e o status diz "Vídeo 3 de 5: …"; sem uso do pager, o título recebe o foco', async () => {
    const user = userEvent.setup()
    const r = mount('v1')
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }))
    await user.click(next())
    r.para('v2')
    await waitFor(() => expect(document.activeElement).toBe(next()))
    expect(raiz().querySelector('[role="status"]')!.textContent).toBe('Vídeo 3 de 5: Vídeo 2')
    // outra chegada sem o pager: o foco volta ao título
    r.para('v3')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })))
  })

  it('o atalho [ conta como o botão: o foco cai em "Anterior" no vídeo novo', async () => {
    const user = userEvent.setup()
    const r = mount('v2')
    screen.getByRole('heading', { level: 1 }).focus()
    await user.keyboard('[[')
    r.para('v1')
    await waitFor(() => expect(document.activeElement).toBe(prev()))
  })

  it('na ponta, o foco continua no botão apagado quando foi ele quem trouxe a pessoa até lá', async () => {
    const user = userEvent.setup()
    const r = mount('v3')
    await user.click(next())
    r.para('v4')
    await waitFor(() => expect(document.activeElement).toBe(next()))
    expect(next().getAttribute('aria-disabled')).toBe('true')
  })
})

describe('T11 o último vídeo visto (o Voltar da página do canal põe o foco no cartão)', () => {
  it('veio da página do canal: grava o vídeo; Anterior/Próximo gravam o novo; a trilha renova', async () => {
    const user = userEvent.setup()
    const r = mount('v1')
    expect(lerUltimoVideo(W.canalId)).toMatchObject({ id: 'v1', via: 'cartao' })
    r.para('v2')
    expect(lerUltimoVideo(W.canalId)).toMatchObject({ id: 'v2' })
    // sair por um link da tela renova o prazo (o registro vale 30 min)
    const antes = JSON.parse(window.sessionStorage.getItem(KEY)!).t as number
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(Date.now() + 20 * 60_000)
    fireEvent.click(screen.getByRole('link', { name: /Abrir no YouTube/ }))
    expect(JSON.parse(window.sessionStorage.getItem(KEY)!).t).toBeGreaterThan(antes)
    vi.useRealTimers()
    void user
  })

  it('não veio da página do canal: nada é gravado', () => {
    window.sessionStorage.clear()
    render(<Tela page={buildProprioVideoPage(W.obs, 'v1', {}, dados())!} />)
    expect(window.sessionStorage.length).toBe(0)
  })

  it('sem sessionStorage a tela abre igual (conforto, nunca requisito)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado') })
    expect(() => mount('v1')).not.toThrow()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Vídeo 1')
  })
})

describe('T11 alcance e o lugar das próximas tarefas', () => {
  it('negado: a frase certa aparece, e nenhum número do alcance está na tela', () => {
    mount('v0', {}, dados('negado'))
    const nota = raiz().querySelector('[data-alcance-nota]')!
    expect(nota.textContent).toBe('Impressões e cliques deste vídeo: só quem edita o site vê este número.')
    expect(raiz().textContent).not.toMatch(/\b187\b/)
  })
  it('erro e sem relatório: cada um a sua frase; lido: nenhuma frase', () => {
    mount('v0', {}, dados('erro'))
    expect(raiz().querySelector('[data-alcance-nota]')!.textContent).toMatch(/a leitura do alcance falhou agora/)
    cleanup()
    mount('v0', {}, dados('vazio'))
    expect(raiz().querySelector('[data-alcance-nota]')!.textContent).toMatch(/ainda sem relatório de alcance deste canal/)
    cleanup()
    mount('v0', {}, dados('cheio'))
    expect(raiz().querySelector('[data-alcance-nota]')).toBeNull()
  })
  it('children (Tarefas 12 e 13) entram depois da faixa, dentro da raiz', () => {
    mount('v0', {}, dados(), <section data-testid="encaixe">x</section>)
    const e = screen.getByTestId('encaixe')
    expect(raiz().contains(e)).toBe(true)
    expect(raiz().querySelector('dl')!.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('T11 higiene da árvore', () => {
  it('nenhum aviso do React ("unique key", aninhamento inválido) em nenhum estado', () => {
    for (const id of ['v0', 'v2', 'v4']) { mount(id); cleanup(); document.getElementById('flut')?.remove() }
    expect(erros.filter(e => /unique "key"|validateDOMNesting|cannot be a descendant|hydrat/i.test(e))).toEqual([])
  })
  it('nenhum <p> contém <div>, <form> ou lista', () => {
    mount('v0', {}, dados('negado'))
    expect(document.querySelectorAll('p div, p form, p ul, p ol, p table')).toHaveLength(0)
  })
  it('a tela não importa o leitor nem a guarda, nem recebe o token (a varredura da T4 olha o resto)', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_proprio/video-screen.tsx'), 'utf8')
    expect(src).not.toMatch(/proprio\/ler|proprio\/edicao|_proprio\/dados|EdicaoDoSite/)
  })
})

describe('T11 CSS (regras da casa)', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_proprio/video.css'), 'utf8')
  it('sem color-mix, sem z-index numérico, nenhum texto abaixo de 12 px, alvo de 44 px em ponteiro grosso, claro e escuro por token', () => {
    expect(css).not.toMatch(/color-mix/)
    expect(css).not.toMatch(/z-index\s*:\s*-?\d/)
    for (const m of css.matchAll(/font(?:-size)?\s*:[^;}]*?(\d+(?:\.\d+)?)px/g)) expect(Number(m[1]), m[0]).toBeGreaterThanOrEqual(12)
    expect(css).toMatch(/pointer:\s*coarse[^}]*\{[^}]*44px/s)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![^{]*\{)/)   // cor solta fora de regra
  })
})

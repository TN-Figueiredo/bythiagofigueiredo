// @vitest-environment jsdom
// Tarefa 11c, C3 (design D-A): o topo das telas. Janela estreita (<= 480 px): o atalho "Meu canal" sai do grupo de ações das abas e as mesmas opções abrem o
// menu ⋯; na trilha ele vira só um ícone com o nome acessível completo. Acima de 480 px o menu ⋯ NÃO traz a seção. As medidas (67, 26, 34 px) são do navegador:
// e2e/comparar-a3.spec.ts e historico-a2.spec.ts. Aqui: a marcação, o hook e as regras de CSS que sustentam essas medidas.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const siteAdmin = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => siteAdmin.value,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(''),
}))
import { render, screen, within, cleanup, renderHook, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { a3World } from './a3-fixture'
import { ObservatoryChrome } from '@/app/cms/(authed)/youtube/competitors/_chrome/observatory-chrome'
import { TrailChrome } from '@/app/cms/(authed)/youtube/competitors/_chrome/trail-chrome'
import { MeuCanal } from '@/app/cms/(authed)/youtube/competitors/_chrome/meu-canal'
import { buildChromeView, type ChromeTab } from '@/app/cms/(authed)/youtube/competitors/_chrome/view-model'
import { ownMenuFromRows } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'
import { useJanelaEstreita, LARGURA_ESTREITA } from '@/app/cms/(authed)/youtube/competitors/_chrome/use-janela-estreita'

const mundo = a3World()
const CSS = readFileSync(resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_chrome/meu-canal.css'), 'utf8')

/** Um `matchMedia` de mentira: `estreita` decide o que `(max-width: 480px)` responde; guarda os ouvintes para a troca de largura. */
function matchMediaCom(estreita: { value: boolean }) {
  const ouvintes = new Set<() => void>()
  vi.stubGlobal('matchMedia', (q: string) => ({
    get matches() { return /max-width:\s*480px/.test(q) ? estreita.value : false },
    media: q, addEventListener: (_: string, f: () => void) => ouvintes.add(f), removeEventListener: (_: string, f: () => void) => ouvintes.delete(f),
  }))
  return () => { for (const f of ouvintes) f() }
}
let estreita = { value: false }
beforeEach(() => { siteAdmin.value = true; estreita = { value: false } })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.getElementById('flut')?.remove() })

const abrirMais = async (tab: ChromeTab = 'canais') => {
  const user = userEvent.setup()
  const { container } = render(<ObservatoryChrome view={buildChromeView(mundo.obs, { tab, niche: 'todos' })}><div /></ObservatoryChrome>)
  await user.click(screen.getByRole('button', { name: 'Mais ações' }))
  return { user, container, menu: within(document.getElementById('flut')!).getByRole('menu', { name: 'Mais ações' }) }
}

describe('o hook useJanelaEstreita', () => {
  it('480 px é o limiar; acompanha a mudança de largura; no servidor (sem matchMedia) devolve false', () => {
    expect(LARGURA_ESTREITA).toBe(480)
    expect(renderHook(() => useJanelaEstreita()).result.current).toBe(false) // jsdom não tem matchMedia
    const avisar = matchMediaCom(estreita)
    const { result } = renderHook(() => useJanelaEstreita())
    expect(result.current).toBe(false)
    act(() => { estreita.value = true; avisar() })
    expect(result.current).toBe(true)
  })
})

describe('o menu ⋯ das abas (design D-A.1)', () => {
  it('a <= 480 px: a primeira seção traz "Meus canais" com os canais próprios, antes de "Copiar pedido para o Cowork", e os itens entram nas setas', async () => {
    estreita.value = true; matchMediaCom(estreita)
    const { user, menu } = await abrirMais()
    const itens = within(menu).getAllByRole('menuitem')
    expect(within(menu).getByText('Meus canais')).toBeTruthy()
    const nomes = mundo.obs.ownChannels().map(c => c.name)
    for (const n of nomes) expect(within(menu).getByText(n)).toBeTruthy()
    // a seção vem antes de "Copiar pedido para o Cowork"
    const iCopiar = itens.findIndex(e => /Copiar pedido para o Cowork/.test(e.getAttribute('aria-label') ?? ''))
    const iPrimeiro = itens.findIndex(e => e.textContent!.includes(nomes[0]!))
    expect(iPrimeiro).toBeGreaterThan(-1); expect(iPrimeiro).toBeLessThan(iCopiar)
    expect(menu.querySelector('hr')).not.toBeNull()
    // o primeiro item recebe o foco e as setas andam pelos canais
    expect(document.activeElement).toBe(itens[0])
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(itens[1])
    expect(within(menu).getByRole('menuitem', { name: 'Ver meus canais na lista de Canais' })).toBeTruthy()
  })
  it('a > 480 px o menu ⋯ NÃO traz a seção de canais próprios', async () => {
    matchMediaCom(estreita) // estreita.value = false
    const { menu } = await abrirMais()
    expect(within(menu).queryByText('Meus canais')).toBeNull()
    expect(within(menu).queryByRole('menuitem', { name: 'Ver meus canais na lista de Canais' })).toBeNull()
    for (const n of mundo.obs.ownChannels().map(c => c.name)) expect(within(menu).queryByText(n)).toBeNull()
  })
  it('site sem canal próprio: nem a 390 px o menu ⋯ ganha seção', async () => {
    estreita.value = true; matchMediaCom(estreita)
    const w = a3World(ds => { const own = new Set(ds.channels.filter(c => c.own).map(c => c.id)); ds.channels = ds.channels.filter(c => !own.has(c.id)); ds.videos = ds.videos.filter(v => !own.has(v.ch)) })
    const user = userEvent.setup()
    render(<ObservatoryChrome view={buildChromeView(w.obs, { tab: 'canais', niche: 'todos' })}><div /></ObservatoryChrome>)
    await user.click(screen.getByRole('button', { name: 'Mais ações' }))
    const menu = within(document.getElementById('flut')!).getByRole('menu', { name: 'Mais ações' })
    expect(within(menu).queryByText('Meus canais')).toBeNull()
  })
  it('clicar num canal próprio do menu ⋯ fecha o menu e o torna "o meu canal" (cookie); canal sem vídeos (apagado) não entra nas setas', async () => {
    estreita.value = true; matchMediaCom(estreita)
    window.history.replaceState(null, '', '/cms/youtube/competitors')
    const U1 = '00000000-0000-4000-8000-000000000001', U2 = '00000000-0000-4000-8000-000000000002', U3 = '00000000-0000-4000-8000-000000000003'
    const owns = ownMenuFromRows([
      { id: U1, name: 'Um', subs: 900, videos: 9, ultimo: mundo.obs.NOW - 86_400_000 }, { id: U2, name: 'Dois', subs: 50, videos: 9, ultimo: mundo.obs.NOW - 9 * 86_400_000 },
      { id: U3, name: 'Novo', subs: 4, videos: 0, ultimo: null },
    ], mundo.obs.fmt, { lembrado: null, agora: mundo.obs.NOW })
    const user = userEvent.setup()
    render(<ObservatoryChrome view={{ ...buildChromeView(mundo.obs, { tab: 'canais', niche: 'todos' }), owns }}><div /></ObservatoryChrome>)
    await user.click(screen.getByRole('button', { name: 'Mais ações' }))
    const menu = within(document.getElementById('flut')!).getByRole('menu', { name: 'Mais ações' })
    const off = within(menu).getByText('Novo').closest('[role="menuitem"]') as HTMLElement
    expect(off.getAttribute('aria-disabled')).toBe('true')
    const a = within(menu).getAllByRole('menuitem').find(e => e.textContent!.includes('Dois'))! as HTMLAnchorElement
    a.addEventListener('click', e => e.preventDefault())
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(document.activeElement).not.toBe(off) // o apagado nunca recebe o foco
    await user.click(a)
    expect(document.cookie).toContain(`obs-meu-canal=${U2}`)
    expect(screen.queryByRole('menu', { name: 'Mais ações' })).toBeNull()
    document.cookie = 'obs-meu-canal=; path=/cms; max-age=0'
  })
})

describe('o atalho "Meu canal" com glifo (design D-A.2 e D-A.4)', () => {
  it('o botão tem o glifo de pessoa como PRIMEIRO filho (aria-hidden, 24x24 de viewBox), o rótulo e o nome, e o nome acessível continua "Meu canal: <nome>"', () => {
    render(<MeuCanal owns={ownMenuFromRows([{ id: '00000000-0000-4000-8000-000000000001', name: 'tnFigueiredo', subs: 10, videos: 3, ultimo: mundo.obs.NOW - 1000 }], mundo.obs.fmt, { lembrado: null, agora: mundo.obs.NOW })} />)
    const b = screen.getByRole('button', { name: 'Meu canal: tnFigueiredo' })
    const g = b.firstElementChild!
    expect(g.tagName.toLowerCase()).toBe('svg'); expect(g.getAttribute('class')).toBe('mc-ic')
    expect(g.getAttribute('aria-hidden')).toBe('true'); expect(g.getAttribute('focusable')).toBe('false'); expect(g.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(g.querySelector('circle')).not.toBeNull(); expect(g.querySelector('path')).not.toBeNull()
    expect(b.querySelector('.mc-l')!.textContent).toBe('Meu canal: ')
    expect(b.querySelector('b')!.textContent).toBe('tnFigueiredo')
    expect(b.querySelector('b')!.getAttribute('title')).toBe('tnFigueiredo') // nome completo mesmo truncado a 14 caracteres
  })
  it('sem canal principal o botão diz "Meus canais" e também tem o glifo', () => {
    render(<MeuCanal owns={ownMenuFromRows([{ id: '00000000-0000-4000-8000-000000000001', name: 'Novo', subs: 4, videos: 0, ultimo: null }], mundo.obs.fmt, { lembrado: null, agora: mundo.obs.NOW })} />)
    const b = screen.getByRole('button', { name: 'Meus canais' })
    expect(b.querySelector('.mc-ic')).not.toBeNull()
  })
  it('na trilha o atalho existe uma vez, dentro de .obs-tr-top', () => {
    const owns = ownMenuFromRows([{ id: '00000000-0000-4000-8000-000000000001', name: 'tnFigueiredo', subs: 10, videos: 3, ultimo: mundo.obs.NOW - 1000 }], mundo.obs.fmt, { lembrado: null, agora: mundo.obs.NOW })
    const { container } = render(<TrailChrome crumbs={[{ text: 'Canais', href: '/x' }, { text: 'Leo' }]} owns={owns}><p>x</p></TrailChrome>)
    expect(container.querySelectorAll('.obs-tr-top [data-meu-canal] .mc-ic')).toHaveLength(1)
  })
})

describe('as regras de CSS do topo (o jsdom não tem layout: o que as sustenta é lido do arquivo)', () => {
  const regra = (re: RegExp) => { const m = CSS.match(re); expect(m, String(re)).not.toBeNull(); return m![0] }
  it('a <= 480 px o atalho sai do grupo de ações; o bloco de container query antigo saiu; entre 481 e 560 o grupo quebra', () => {
    regra(/@media \(max-width:480px\)\{\s*\[data-obs\] \.obs-ch-actions > \.mc\{display:none\}\s*\}/)
    expect(CSS).not.toMatch(/@container/)
    regra(/@media \(min-width:481px\) and \(max-width:560px\)\{\s*\[data-obs\] \.obs-ch-actions:has\(> \[data-meu-canal\]\)\{flex-wrap:wrap\}/)
  })
  it('na trilha: glifo visível, rótulo "Meu canal:" fora da vista, nome em 14ch; a <= 480 px só o ícone, 34 px (44 com toque)', () => {
    regra(/\[data-obs\] \.mc-b \.mc-ic\{display:none;width:16px;height:16px/)
    regra(/\[data-obs\] \.obs-tr-top \.mc-ic\{display:block\}/)
    regra(/\[data-obs\] \.obs-tr-top \.mc-b b\{max-width:14ch\}/)
    regra(/\[data-obs\] \.obs-tr-top \.mc-b\{width:34px;min-width:34px;padding:0;justify-content:center;gap:0\}/)
    regra(/@media \(max-width:480px\) and \(pointer:coarse\)\{\[data-obs\] \.obs-tr-top \.mc-b\{min-width:44px;width:44px\}\}/)
  })
  it('nenhum color-mix e nenhum z-index numérico novo', () => {
    const semComentarios = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(semComentarios).not.toMatch(/color-mix/)
    expect(semComentarios).not.toMatch(/z-index/)
  })
})

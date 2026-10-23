// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: nav.replace, refresh: nav.refresh, push: vi.fn() }) }))

import { SugestoesLista } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/sugestoes-lista'
import { EsqueletoDaLista } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/esqueleto'
import type { LinhaDaVista, VistaDaLista } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/view-model'
import type { AcoesDaLista, RespostaDaAcao } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/tipos'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_sugestoes')

function linha(id: string, o: Partial<LinhaDaVista> = {}): LinhaDaVista {
  const kind = o.kind ?? 'destino'
  return {
    id, kind, chip: kind === 'destino' ? { rotulo: 'Destino esquentou', simbolo: 'alfinete' } : { rotulo: 'Concorrente bombou', simbolo: 'chama' },
    lugar: kind === 'destino' ? 'L' + id : '', titulo: `Um vídeo sobre ${id} passou de 5× o normal do canal`,
    puxadoPor: { titulo: 'Vídeo ' + id, canal: 'Canal X', miniatura: 'https://x/y.jpg' },
    regua: { valor: 8.4, acimaDe20: false, limiar: 5, texto: '8,4× o normal do canal' },
    seus: { texto: 'Seus vídeos sobre X: 2.', naoMedido: false },
    primario: { texto: 'Abrir seus 2 vídeos sobre X', href: '/cms/youtube/videos', cheio: false }, venceEm: null,
    info: { mults: '8,4×', medida: 'views por dia', regra: 'regra sinais-v1', surgiu: '18/10', vence: '17/11' },
    motivos: kind === 'destino'
      ? [{ valor: 'lugar_errado', rotulo: 'Lugar errado', grupo: 'motivo' }, { valor: 'nao_interessa', rotulo: 'Não me interessa', grupo: 'motivo' }, { valor: 'ja_fiz', rotulo: 'Já fiz', grupo: 'feito' }]
      : [{ valor: 'nao_e_parecido', rotulo: 'Não é parecido', grupo: 'motivo' }, { valor: 'nao_interessa', rotulo: 'Não me interessa', grupo: 'motivo' }, { valor: 'ja_fiz', rotulo: 'Já fiz', grupo: 'feito' }],
    ...o,
  }
}
function vista(ls: LinhaDaVista[], o: Partial<VistaDaLista> = {}): VistaDaLista {
  const com = ls.map((l, i) => ({ ...l, primario: { ...l.primario, cheio: i === 0 } }))
  return {
    n: com.length, calculado: 'Calculado hoje às 07:02', velho: false, resumo: `${com.length} sugestões: ${com.length} destinos.`, faixa: null,
    filtro: null, linhas: com, completas: com, totalAlemDoLimite: null, vazio: null, ...o,
  }
}
const tres = () => vista([linha('a'), linha('b'), linha('c')])
const ok: RespostaDaAcao = { ok: true }
function acoes(r: RespostaDaAcao | (() => Promise<RespostaDaAcao>) = ok): AcoesDaLista & { dispensar: ReturnType<typeof vi.fn> } {
  return { dispensar: vi.fn(typeof r === 'function' ? r : async () => r) } as AcoesDaLista & { dispensar: ReturnType<typeof vi.fn> }
}
const cnt = () => document.querySelector('.sg-cnt')!.textContent

beforeEach(() => { nav.replace.mockClear(); nav.refresh.mockClear() })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

async function abrirMotivos(id: string) {
  const li = document.querySelector(`[data-row="${id}"]`) as HTMLElement
  fireEvent.click(within(li).getAllByRole('button', { name: /dispensar/i })[0]!)
  return li
}

describe('SugestoesLista: linha', () => {
  it('só um botão com a classe do primário cheio; as outras em contorno', () => {
    const { container } = render(<SugestoesLista vista={tres()} acoes={acoes()} modo="pagina" />)
    expect(container.querySelectorAll('.sg-pri')).toHaveLength(1)
    expect(container.querySelectorAll('.sg-ol')).toHaveLength(2)
    expect(container.querySelector('section.sg[data-obs-screen="sugestoes"]')).not.toBeNull()
  })
  it('Dispensar abre os motivos do kind; Esc fecha e o foco volta ao gatilho', async () => {
    const v = vista([linha('a'), linha('p', { kind: 'parecido' })])
    render(<SugestoesLista vista={v} acoes={acoes()} modo="pagina" />)
    const li = document.querySelector('[data-row="p"]') as HTMLElement
    const gatilho = within(li).getAllByRole('button', { name: /dispensar/i })[0]!
    gatilho.focus(); fireEvent.click(gatilho)
    const grupo = within(li).getByRole('group', { name: /motivo/i })
    expect(within(grupo).getByRole('button', { name: 'Não é parecido' })).toBeTruthy()
    expect(within(grupo).queryByRole('button', { name: 'Lugar errado' })).toBeNull()
    expect(document.activeElement).toBe(gatilho) // o foco fica no gatilho, fora do grupo
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(within(li).queryByRole('group', { name: /motivo/i })).toBeNull()
    expect(document.activeElement).toBe(gatilho)
  })
  it('dois cliques rápidos no mesmo motivo chamam a ação uma vez; o grupo fica disabled e mostra "Salvando…"', async () => {
    let solta!: (r: RespostaDaAcao) => void
    const a = acoes(() => new Promise<RespostaDaAcao>((res) => { solta = res }))
    render(<SugestoesLista vista={tres()} acoes={a} modo="pagina" />)
    const li = await abrirMotivos('a')
    const btn = within(li).getByRole('button', { name: 'Lugar errado' })
    fireEvent.click(btn); fireEvent.click(btn)
    expect(a.dispensar).toHaveBeenCalledTimes(1)
    expect(a.dispensar).toHaveBeenCalledWith('a', 'lugar_errado')
    const grupo = within(li).getByRole('group', { name: /motivo/i })
    for (const b of within(grupo).getAllByRole('button')) expect((b as HTMLButtonElement).disabled).toBe(true)
    expect(within(grupo).getByText('Salvando…').closest('button')!.getAttribute('aria-busy')).toBe('true')
    expect(within(grupo).queryByText('Cancelar')).toBeNull()
    await act(async () => { solta(ok) })
  })
  it('motivo -> confirmação no lugar da linha; N cai só depois da promessa; foco na linha seguinte', async () => {
    let solta!: (r: RespostaDaAcao) => void
    const a = acoes(() => new Promise<RespostaDaAcao>((res) => { solta = res }))
    render(<SugestoesLista vista={tres()} acoes={a} modo="pagina" />)
    const li = await abrirMotivos('a')
    fireEvent.click(within(li).getByRole('button', { name: 'Lugar errado' }))
    expect(cnt()).toBe('3')
    await act(async () => { solta(ok) })
    expect(cnt()).toBe('2')
    const items = document.querySelectorAll('.sg-list > li')
    expect(items).toHaveLength(3) // a confirmação ocupa o mesmo <li> (mesma posição)
    const conf = items[0]!
    expect(conf.getAttribute('role')).toBe('status')
    expect(conf.textContent).toContain('Dispensada: lugar errado. Não volta nos próximos 30 dias.')
    expect((document.activeElement as HTMLElement).getAttribute('data-row')).toBe('b')
    expect(document.querySelectorAll('.sg-pri')).toHaveLength(1)
    expect(document.querySelector('[data-row="b"] .sg-pri')).not.toBeNull()
  })
  it('a confirmação recolhe depois de 5 s', async () => {
    vi.useFakeTimers()
    render(<SugestoesLista vista={tres()} acoes={acoes()} modo="pagina" />)
    const li = await abrirMotivos('a')
    await act(async () => { fireEvent.click(within(li).getByRole('button', { name: 'Já fiz' })) })
    expect(document.querySelector('.sg-list > li')!.textContent).toContain('Marcada como já feita')
    await act(async () => { vi.advanceTimersByTime(5100) })
    expect(document.querySelectorAll('.sg-list > li')).toHaveLength(2)
  })
  it('última linha: o foco vai à frase-resumo', async () => {
    render(<SugestoesLista vista={vista([linha('a')])} acoes={acoes()} modo="pagina" />)
    const li = await abrirMotivos('a')
    await act(async () => { fireEvent.click(within(li).getByRole('button', { name: 'Já fiz' })) })
    expect(document.activeElement!.className).toContain('sg-sum')
  })
  it('nao_aberto: a linha sai com "já saiu", sem "Tentar de novo"', async () => {
    render(<SugestoesLista vista={tres()} acoes={acoes({ ok: false, motivo: 'nao_aberto' })} modo="pagina" />)
    const li = await abrirMotivos('a')
    await act(async () => { fireEvent.click(within(li).getByRole('button', { name: 'Já fiz' })) })
    expect(screen.getByText('Esta sugestão já saiu da lista.')).toBeTruthy()
    expect(screen.queryByText(/Dispensada:/)).toBeNull()
    expect(screen.queryByText(/Tentar de novo/)).toBeNull()
    expect(cnt()).toBe('2')
  })
  it('sem_permissao: linha fica, sem "Tentar de novo", com "Entrar de novo" para o login', async () => {
    render(<SugestoesLista vista={tres()} acoes={acoes({ ok: false, motivo: 'sem_permissao' })} modo="pagina" />)
    const li = await abrirMotivos('a')
    await act(async () => { fireEvent.click(within(li).getByRole('button', { name: 'Já fiz' })) })
    expect(screen.getByText('Você não tem permissão para responder agora. Entre de novo ou fale com o admin do site.')).toBeTruthy()
    expect(screen.queryByText(/Tentar de novo/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Entrar de novo' }).getAttribute('href')).toMatch(/^\/cms\/login\?next=/)
    expect(cnt()).toBe('3')
  })
  it('falhou: "Tentar de novo" chama a ação de novo com o mesmo motivo', async () => {
    const a = acoes({ ok: false, motivo: 'falhou' })
    render(<SugestoesLista vista={tres()} acoes={a} modo="pagina" />)
    const li = await abrirMotivos('a')
    await act(async () => { fireEvent.click(within(li).getByRole('button', { name: 'Lugar errado' })) })
    expect(screen.getByText(/Não salvou “Lugar errado”\./)).toBeTruthy()
    expect(screen.getByText(/A sugestão continua aberta\./)).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo “Lugar errado”' })) })
    expect(a.dispensar).toHaveBeenCalledTimes(2)
    expect(a.dispensar).toHaveBeenLastCalledWith('a', 'lugar_errado')
  })
  it('15 s sem resposta: "sem conexão"; ok tardio: a linha sai', async () => {
    vi.useFakeTimers()
    let solta!: (r: RespostaDaAcao) => void
    const a = acoes(() => new Promise<RespostaDaAcao>((res) => { solta = res }))
    render(<SugestoesLista vista={tres()} acoes={a} modo="pagina" />)
    const li = await abrirMotivos('a')
    await act(async () => { fireEvent.click(within(li).getByRole('button', { name: 'Lugar errado' })) })
    await act(async () => { vi.advanceTimersByTime(15_100) })
    expect(screen.getByText(/Não salvou “Lugar errado”: sem conexão\./)).toBeTruthy()
    await act(async () => { solta(ok) })
    expect(document.querySelector('.sg-list > li')!.textContent).toContain('Dispensada: lugar errado')
    expect(cnt()).toBe('2')
  })
  it('promessa rejeitada: sem conexão', async () => {
    const a = acoes(() => Promise.reject(new Error('rede')))
    render(<SugestoesLista vista={tres()} acoes={a} modo="pagina" />)
    const li = await abrirMotivos('a')
    await act(async () => { fireEvent.click(within(li).getByRole('button', { name: 'Já fiz' })) })
    expect(screen.getByText(/sem conexão\./)).toBeTruthy()
  })
  it('<script> no título e no puxado por vira texto', () => {
    const l = linha('a', { titulo: '<script>alert(1)</script> oi', puxadoPor: { titulo: '<script>x</script>', canal: '<b>c</b>', miniatura: null } })
    const { container } = render(<SugestoesLista vista={vista([l])} acoes={acoes()} modo="pagina" />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('<script>alert(1)</script> oi')
    expect(container.textContent).toContain('Miniatura indisponível')
  })
  it('miniatura que falha troca pelo bloco "Miniatura indisponível"', () => {
    const { container } = render(<SugestoesLista vista={vista([linha('a')])} acoes={acoes()} modo="pagina" />)
    const img = container.querySelector('img')!
    expect(img.getAttribute('width')).toBe('96'); expect(img.getAttribute('height')).toBe('54')
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer'); expect(img.getAttribute('loading')).toBe('lazy')
    fireEvent.error(img)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('Miniatura indisponível')).toBeTruthy()
  })
  it('acoes = null: sem Dispensar', () => {
    render(<SugestoesLista vista={tres()} acoes={null} modo="pagina" />)
    expect(screen.queryByRole('button', { name: /dispensar/i })).toBeNull()
  })
  it('régua com aria-label "regra 5×"', () => {
    const { container } = render(<SugestoesLista vista={vista([linha('a')])} acoes={null} modo="pagina" />)
    expect(container.querySelector('svg[aria-label*="regra 5×"]')).not.toBeNull()
  })
  it('ⓘ abre o método da linha', () => {
    render(<SugestoesLista vista={vista([linha('a')])} acoes={null} modo="pagina" />)
    fireEvent.click(screen.getAllByRole('button', { name: /como esta sugestão foi calculada/i })[0]!)
    expect(screen.getByText('Como esta sugestão foi calculada', { selector: 'h5' })).toBeTruthy()
    expect(screen.getByText(/associação, não causa/)).toBeTruthy()
  })
})

describe('SugestoesLista: lista grande, filtro, faixa, bloco, vazio', () => {
  const quarenta = () => vista(Array.from({ length: 40 }, (_, i) => linha('q' + i, { kind: i % 4 === 3 ? 'parecido' : 'destino' })), {
    filtro: { atual: 'todas', contagens: { todas: 40, destino: 30, parecido: 10 } },
    faixa: { tipo: 'velho', titulo: 'As sugestões não são recalculadas há mais de 36 horas.', texto: 'A lista abaixo é a do último cálculo.' },
  })
  it('o HTML do servidor traz as 40 linhas e o botão "Mostrar mais (30)"', () => {
    const html = renderToString(<SugestoesLista vista={quarenta()} acoes={acoes()} modo="pagina" />)
    expect((html.match(/<li[^>]*class="sg-row/g) ?? []).length).toBe(40)
    expect(html).toContain('Mostrar mais (30)')
    expect(html).not.toContain('data-mais')
  })
  it('o CSS esconde da 11ª em diante só dentro da container query, sem data-mais', () => {
    const css = fs.readFileSync(path.join(DIR, 'sugestoes.css'), 'utf8')
    const bloco = css.slice(css.indexOf('@container (max-width:640px)'))
    expect(bloco).toContain('.sg:not([data-mais]) .sg-list > .sg-row:nth-child(n+11){display:none}')
    expect(css.slice(0, css.indexOf('@container (max-width:640px)'))).not.toContain('nth-child(n+11)')
  })
  it('"Mostrar mais" põe data-mais e grava mais=1 sem rolar', () => {
    const { container } = render(<SugestoesLista vista={quarenta()} acoes={acoes()} modo="pagina" />)
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais (30)' }))
    expect(container.querySelector('section.sg')!.hasAttribute('data-mais')).toBe(true)
    expect(nav.replace).toHaveBeenCalledTimes(1)
    expect(String(nav.replace.mock.calls[0]![0])).toContain('mais=1')
    expect(nav.replace.mock.calls[0]![1]).toEqual({ scroll: false })
  })
  it('filtro recorta no cliente e grava na URL com replaceState, sem refazer a leitura', () => {
    const spy = vi.spyOn(window.history, 'replaceState')
    render(<SugestoesLista vista={quarenta()} acoes={acoes()} modo="pagina" />)
    fireEvent.click(screen.getByRole('button', { name: /Concorrentes \(10\)/ }))
    expect(document.querySelectorAll('.sg-list > li')).toHaveLength(10)
    expect(String(spy.mock.calls.at(-1)![2])).toContain('filtro=parecido')
    expect(nav.refresh).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('a faixa velho aparece (role=status) e nunca como resultado de ação', () => {
    render(<SugestoesLista vista={quarenta()} acoes={acoes()} modo="pagina" />)
    expect(screen.getByText(/não são recalculadas há mais de 36 horas/).closest('[role="status"]')).not.toBeNull()
  })
  it('erro-com-lista: faixa com "Tentar de novo" que recarrega; a lista segue utilizável', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, type: 'basic', status: 200 })))
    const boa = tres()
    const { rerender } = render(<SugestoesLista vista={boa} acoes={acoes()} modo="pagina" />)
    rerender(<SugestoesLista vista={{ ...tres(), n: null, linhas: [], completas: [] }} acoes={acoes()} modo="pagina" />)
    expect(screen.getByText('Não deu para atualizar a lista.').closest('[role="alert"]')).not.toBeNull()
    expect(document.querySelectorAll('.sg-list > li')).toHaveLength(3)
    expect(cnt()).toBe('3')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' })) })
    expect(nav.refresh).toHaveBeenCalled()
  })
  it('n null sem lista anterior: "?" e erro com "Tentar de novo"', () => {
    render(<SugestoesLista vista={{ ...tres(), n: null, linhas: [], completas: [] }} acoes={acoes()} modo="pagina" />)
    expect(cnt()).toBe('?')
    expect(screen.getByRole('alert')).toBeTruthy()
  })
  it('modo=bloco com 5 linhas: 3 e "Ver todas (5)"; sem sticky', () => {
    const v = vista(Array.from({ length: 5 }, (_, i) => linha('z' + i)))
    const { container } = render(<SugestoesLista vista={v} acoes={acoes()} modo="bloco" verTodasHref="/cms/youtube/competitors/sugestoes" />)
    expect(container.querySelectorAll('.sg-list > li')).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Ver todas (5)' }).getAttribute('href')).toBe('/cms/youtube/competitors/sugestoes')
    expect(container.querySelector('section.sg')!.getAttribute('data-modo')).toBe('bloco')
  })
  it('modo=bloco com 3 linhas: sem "Ver todas"', () => {
    render(<SugestoesLista vista={tres()} acoes={acoes()} modo="bloco" verTodasHref="/x" />)
    expect(screen.queryByText(/Ver todas/)).toBeNull()
  })
  it('bloco com vazio: uma linha, ícone + título + "Ver detalhes", sem parágrafo', () => {
    const v = vista([], { n: 0, resumo: 'Nenhuma sugestão agora.', vazio: { familia: 'calmo', topo: 'Nenhuma sugestão agora.', titulo: 'Nenhum vídeo dos canais acompanhados passou do normal.', texto: 'Olhamos 14 canais.' } })
    const { container } = render(<SugestoesLista vista={v} acoes={null} modo="bloco" verTodasHref="/x" />)
    expect(screen.getByText('Nenhum vídeo dos canais acompanhados passou do normal.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver detalhes' })).toBeTruthy()
    expect(container.querySelector('.sg-vz1')).not.toBeNull() // o seletor mira o bloco real
    expect(container.querySelector('.sg-vz1 p, .sg-vz p')).toBeNull()
  })
  it('vazio da página: sem "0" fora da contagem; nunca calculado mostra "—"', () => {
    const v = vista([], { n: 0, calculado: 'Nunca calculado', resumo: 'As sugestões ainda não foram calculadas.', vazio: { familia: 'espera', topo: 'As sugestões ainda não foram calculadas.', titulo: 'Ainda não houve cálculo.', texto: 'O 1º cálculo roda amanhã.' } })
    const { container } = render(<SugestoesLista vista={v} acoes={null} modo="pagina" />)
    expect(cnt()).toBe('—')
    expect(container.textContent!.replace(cnt()!, '')).not.toMatch(/\b0\b/)
  })
  it('vazio de filtro tem "Ver todas (N)" que volta ao filtro todas', () => {
    const vz = { familia: 'calmo' as const, topo: 'x', titulo: 'Nenhum destino aberto agora.', texto: '' }
    const v = vista([linha('a', { kind: 'parecido' })], { filtro: { atual: 'todas', contagens: { todas: 1, destino: 0, parecido: 1 } } })
    render(<SugestoesLista vista={v} acoes={null} modo="pagina" />)
    fireEvent.click(screen.getByRole('button', { name: /Destinos \(0\)/ }))
    expect(screen.getByText(vz.titulo)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas (1)' }))
    expect(document.querySelectorAll('.sg-list > li')).toHaveLength(1)
  })
})

describe('Esqueleto e CSS', () => {
  it('esqueleto: título real, N "…", linhas aria-hidden com a forma da linha', () => {
    const { container } = render(<EsqueletoDaLista linhas={3} />)
    expect(screen.getByRole('heading', { name: /Sugestões/ })).toBeTruthy()
    expect(cnt()).toBe('…')
    expect(container.querySelectorAll('.sg-sk-row')).toHaveLength(3)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })
  const css = () => fs.readFileSync(path.join(DIR, 'sugestoes.css'), 'utf8')
  it('sem color-mix nem useJanelaEstreita nos arquivos novos', () => {
    for (const f of fs.readdirSync(DIR).filter((x) => /\.(tsx?|css)$/.test(x) && x !== 'view-model.ts')) {
      const t = fs.readFileSync(path.join(DIR, f), 'utf8')
      expect(t, f).not.toMatch(/color-mix|useJanelaEstreita/)
    }
  })
  it('cores literais só dentro dos seletores de tokens (.sg e [data-theme="light"] .sg)', () => {
    const texto = css()
    const fora = texto.replace(/(?:\[data-theme="light"\] )?\.sg\{[^}]*\}/g, (m) => (/^(\[data-theme="light"\] )?\.sg\{\s*--/.test(m) ? '' : m))
    expect(fora).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/)
    for (const t of ['--bg', '--surface', '--surface-2', '--sunk', '--border', '--border-subtle', '--border-strong', '--btn-line', '--text', '--muted', '--dim', '--accent', '--on-accent', '--nm', '--nm-line', '--nm-bg', '--warn', '--warn-bg', '--warn-line', '--ok', '--ok-bg', '--ok-line', '--err', '--err-line', '--yt', '--yt-bg', '--yt-line', '--skel', '--lado-n', '--lado-n-line', '--lado-n-bg']) {
      expect(texto, t).toMatch(new RegExp(`\\.sg\\{[^}]*${t}:`))
      expect(texto, t + ' claro').toMatch(new RegExp(`\\[data-theme="light"\\] \\.sg\\{[^}]*${t}:`))
    }
    expect(texto).not.toContain('--ln')
  })
  it('esqueleto: pulso só com prefers-reduced-motion:no-preference; sticky só na página', () => {
    const t = css()
    expect(t).toMatch(/@media \(prefers-reduced-motion:no-preference\)\{[^}]*animation/)
    expect(t).toContain('top:calc(var(--obs-topbar-h, 52px) + 8px)')
    expect(t).toMatch(/\.sg\[data-modo="bloco"\] \.sg-flt\{position:static/)
    expect(t).toContain('z-index:var(--z-grudado, 2)')
  })
  it('tokens do nicho acrescentados ao lado de --lado-n', () => {
    const t = fs.readFileSync(path.join(DIR, '../_chrome/tokens-telas.css'), 'utf8')
    expect(t).toContain('--lado-n-line:#8C7748'); expect(t).toContain('--lado-n-bg:rgba(217,192,143,.08)')
    expect(t).toContain('--lado-n-line:#9C8452'); expect(t).toContain('--lado-n-bg:rgba(122,92,20,.07)')
  })
})

// @vitest-environment jsdom
// A5 · E5a, 2ª leva, R3: componentes de Referências e Inscritos. Os dados são sintéticos; a RiView é montada à mão
// (o modelo é a R4). Nenhuma frase de dado nasce no componente.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import type { RiLinhaIns, RiLinhaRef, RiView } from '@/app/cms/(authed)/youtube/competitors/_canais/ri-tipos'

const replace = vi.fn(), refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(''),
}))
import { RiAtalhos, RiSecoes } from '@/app/cms/(authed)/youtube/competitors/_canais/ri-secoes'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_canais')
const TICKS = [{ pos: 3, rotulo: '1 mil' }, { pos: 32, rotulo: '10 mil' }, { pos: 62, rotulo: '100 mil' }, { pos: 91, rotulo: '1 mi' }]

const ref = (i: number, o: Partial<RiLinhaRef> = {}): RiLinhaRef => ({
  id: `c${i}`, nome: `Canal ${i}`, proprio: false, rank: null, valor: `${i} mil`, sub: 'faixa média · 3× · 8 vídeos',
  marca: 40 + i, faixa: { de: 30 + i, ate: 50 + i }, provisoria: false, pilula: null, ariaLabel: `Canal ${i}: mediana`, ...o,
})
const ins = (i: number, o: Partial<RiLinhaIns> = {}): RiLinhaIns => ({
  id: `c${i}`, nome: `Canal ${i}`, proprio: false, rank: null, classe: 'up', pct: `+${i},0%`, sub: `+${i} · ${i} mil no total`,
  barra: { pct: 10 * i, abs: 50 - 10 * i }, pilula: null, nota: null, ariaLabel: `Canal ${i}: subiu`, ...o,
})
const nmRef = (i: number): RiLinhaRef => ref(i, { marca: null, faixa: null, valor: null, sub: null, pilula: { tipo: 'nm', texto: 'sem medida · ainda não coletado' } })
const nmIns = (i: number): RiLinhaIns => ins(i, { classe: null, pct: null, sub: null, barra: null, pilula: { tipo: 'nm', texto: 'sem medida · contagem oculta' }, nota: 'O canal escondeu a contagem de inscritos.' })

function view(o: Partial<RiView> = {}, nRef = 3, nIns = 3): RiView {
  const lr = Array.from({ length: nRef }, (_, i) => ref(i + 1))
  const li = Array.from({ length: nIns }, (_, i) => ins(i + 1))
  return {
    aviso: null,
    atalhos: [{ href: '#referencias', rotulo: 'Referências' }, { href: '#inscritos', rotulo: 'Inscritos' }],
    referencias: {
      estado: 'ok', frase: [{ t: 'Nos últimos 90 dias, o vídeo típico de ' }, { t: 'Canal 1 tem 1 mil de views', b: true }, { t: '.' }],
      info: { titulo: 'Como as referências são calculadas', itens: ['Item um', 'Item dois'] }, linhas: lr,
      ordens: { mediana: { rotulo: 'Views do vídeo típico', ids: lr.map((l) => l.id) }, faixa: { rotulo: 'Faixa mais estreita', ids: [...lr].reverse().map((l) => l.id) } },
      legenda: ['vídeo típico (mediana)', 'faixa', 'provisória', 'sem medida'], n: lr.length,
    },
    inscritos: {
      estado: 'ok', frase: [{ t: 'Em 28 dias, ' }, { t: 'Canal 1', b: true }, { t: ' cresceu mais.' }],
      info: { titulo: 'Como o ganho é calculado', itens: ['Item um'] }, linhas: li,
      ordens: { pct: { rotulo: 'Ganho em %', ids: li.map((l) => l.id), legendaBarra: 'Barra: tamanho do ganho em %.' }, abs: { rotulo: 'Ganho em inscritos', ids: [...li].reverse().map((l) => l.id), legendaBarra: 'Barra: tamanho do ganho em inscritos.' } },
      legenda: ['subiu', 'caiu', 'sem variação', 'sem medida'], n: li.length,
    },
    ticks: TICKS, ordem: { ref: 'mediana', ins: 'pct' }, aba: 'ref', ...o,
  }
}

let store = new Map<string, string>()
const falha = { ler: false, gravar: false }
const armazenamento = {
  getItem: (k: string) => { if (falha.ler) throw new Error('bloqueado'); return store.get(k) ?? null },
  setItem: (k: string, v: string) => { if (falha.gravar) throw new Error('bloqueado'); store.set(k, v) },
  removeItem: (k: string) => { store.delete(k) },
}
beforeEach(() => { replace.mockClear(); refresh.mockClear(); store = new Map(); falha.ler = false; falha.gravar = false; vi.stubGlobal('localStorage', armazenamento); window.history.replaceState(null, '', '/cms/youtube/competitors?niche=viagem') })
afterEach(cleanup)

const nomesDe = (sec: HTMLElement) => [...sec.querySelectorAll('.ri-lst > li')].map((li) => li.querySelector('.n')?.textContent)

describe('RI · dado apagado', () => {
  it('seção com todas as linhas sem medida: nenhuma régua, nenhum "0", toda pílula com a classe nm2', () => {
    const v = view()
    if (v.referencias.estado !== 'ok' || v.inscritos.estado !== 'ok') throw new Error('fixture')
    const lr = [nmRef(1), nmRef(2)], li = [nmIns(1), nmIns(2)]
    v.referencias = { ...v.referencias, linhas: lr, n: 2, ordens: { mediana: { rotulo: 'a', ids: [] }, faixa: { rotulo: 'b', ids: [] } } }
    v.inscritos = { ...v.inscritos, linhas: li, n: 2, ordens: { pct: { rotulo: 'a', ids: [] }, abs: { rotulo: 'b', ids: [] } } }
    const { container } = render(<RiSecoes ri={v} ocupada={false} />)
    expect(container.querySelectorAll('.reg, .dv:not(.sm)')).toHaveLength(0)
    const pilulas = [...container.querySelectorAll('.ri-lst .pill')]
    expect(pilulas).toHaveLength(4)
    for (const p of pilulas) expect(p.className).toContain('nm2')
    expect(container.querySelector('.ri-lst')?.textContent ?? '').not.toMatch(/(^|\s)0(\s|$)|0%|sem variação/)
  })
  it('ultimaBoa nula: a oração "Última leitura boa" some', () => {
    const v = view({ referencias: { estado: 'erro', texto: 'Não foi possível carregar as referências. Seus dados não mudaram.', ultimaBoa: null } })
    render(<RiSecoes ri={v} ocupada={false} />)
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar as referências.')
    expect(screen.queryByText(/Última leitura boa/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })
  it('ultimaBoa preenchida: a oração aparece', () => {
    render(<RiSecoes ri={view({ inscritos: { estado: 'erro', texto: 'Falhou.', ultimaBoa: '14/10, 06:40' } })} ocupada={false} />)
    expect(screen.getByText('Última leitura boa: 14/10, 06:40')).toBeTruthy()
  })
  it('aviso nulo: nenhum aviso', () => {
    const { container } = render(<RiSecoes ri={view()} ocupada={false} />)
    expect(container.querySelector('.ri-aviso')).toBeNull()
    cleanup()
    const c2 = render(<RiSecoes ri={view({ aviso: 'Mostrando os dados de 11/10.' })} ocupada={false} />)
    expect(c2.container.querySelector('.ri-aviso')?.textContent).toBe('Mostrando os dados de 11/10.')
  })
})

describe('RI · fronteira', () => {
  it('ordenar troca a lista sem chamar o roteador e põe ordr na URL', () => {
    const { container } = render(<RiSecoes ri={view()} ocupada={false} />)
    const sec = container.querySelector<HTMLElement>('#referencias')!
    expect(nomesDe(sec)).toEqual(['Canal 1', 'Canal 2', 'Canal 3'])
    fireEvent.click(within(sec).getByRole('button', { name: 'Faixa mais estreita' }))
    expect(nomesDe(sec)).toEqual(['Canal 3', 'Canal 2', 'Canal 1'])
    expect(replace).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
    const u = new URL(window.location.href)
    expect(u.searchParams.get('ordr')).toBe('faixa')
    expect(u.searchParams.get('niche')).toBe('viagem')
    expect(within(sec).getByRole('button', { name: 'Faixa mais estreita' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(container.querySelector<HTMLElement>('#inscritos')!).getByRole('button', { name: 'Ganho em inscritos' }))
    expect(new URL(window.location.href).searchParams.get('ordi')).toBe('abs')
  })
  it('a aba vai ao localStorage e o localStorage que lança não quebra', () => {
    const { container } = render(<RiSecoes ri={view()} ocupada={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Inscritos', pressed: false }))
    expect(store.get('ri-aba')).toBe('ins')
    expect(container.querySelector('.ri')?.getAttribute('data-aba')).toBe('ins')
    expect(new URL(window.location.href).searchParams.get('aba')).toBe('ins')
    cleanup()
    falha.ler = true; falha.gravar = true
    window.history.replaceState(null, '', '/cms/youtube/competitors')
    const r2 = render(<RiSecoes ri={view()} ocupada={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Inscritos', pressed: false }))
    expect(r2.container.querySelector('.ri')?.getAttribute('data-aba')).toBe('ins')
  })
  it('aba guardada vale só sem ?aba= na URL', () => {
    store.set('ri-aba', 'ins')
    const { container } = render(<RiSecoes ri={view()} ocupada={false} />)
    expect(container.querySelector('.ri')?.getAttribute('data-aba')).toBe('ins')
    cleanup()
    window.history.replaceState(null, '', '/cms/youtube/competitors?aba=ref')
    const r2 = render(<RiSecoes ri={view()} ocupada={false} />)
    expect(r2.container.querySelector('.ri')?.getAttribute('data-aba')).toBe('ref')
  })
  it('27 linhas: 10 visíveis, o canal próprio na 14ª fica fixado, "Ver todos os 27"', () => {
    const v = view({}, 27, 3)
    if (v.referencias.estado !== 'ok') throw new Error('fixture')
    v.referencias.linhas[13] = { ...v.referencias.linhas[13], proprio: true }
    const { container } = render(<RiSecoes ri={v} ocupada={false} />)
    const sec = container.querySelector<HTMLElement>('#referencias')!
    const lis = [...sec.querySelectorAll<HTMLElement>('.ri-lst > li')]
    expect(lis).toHaveLength(27)
    expect(lis.filter((l) => l.className === '')).toHaveLength(10)
    expect(lis.filter((l) => l.className === 'extra')).toHaveLength(16)
    const pin = lis.filter((l) => l.className === 'extra pin')
    expect(pin).toHaveLength(1)
    expect(pin[0].textContent).toContain('seu canal')
    const mais = within(sec).getByRole('button', { name: 'Ver todos os 27' })
    expect(mais.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(mais)
    expect(container.querySelector('#referencias .ri-lst')?.className).toContain('all')
    const menos = within(sec).getByRole('button', { name: 'Ver só os 10 primeiros' })
    expect(menos.getAttribute('aria-expanded')).toBe('true')
    // com 10 linhas ou menos não há botão
    cleanup()
    render(<RiSecoes ri={view({}, 10, 3)} ocupada={false} />)
    expect(screen.queryByRole('button', { name: /Ver todos/ })).toBeNull()
  })
  it('o ⓘ abre, Esc fecha e o foco volta', () => {
    const abre = vi.fn(function (this: HTMLElement) { this.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'open' })) })
    const fecha = vi.fn(function (this: HTMLElement) { this.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'closed' })) })
    Object.defineProperty(HTMLElement.prototype, 'togglePopover', { configurable: true, value: abre })
    Object.defineProperty(HTMLElement.prototype, 'hidePopover', { configurable: true, value: fecha })
    try {
      const { container } = render(<RiSecoes ri={view()} ocupada={false} />)
      const botao = within(container.querySelector<HTMLElement>('#referencias')!).getByRole('button', { name: 'Como é calculado: Referências' })
      expect(botao.getAttribute('aria-expanded')).toBe('false')
      botao.focus()
      fireEvent.click(botao)
      expect(abre).toHaveBeenCalled()
      expect(botao.getAttribute('aria-expanded')).toBe('true')
      const pop = container.querySelector<HTMLElement>('#referencias [popover]')!
      expect(pop.getAttribute('popover')).toBe('auto')
      expect(pop.textContent).toContain('Item dois')
      ;(document.activeElement as HTMLElement).blur()
      fireEvent.keyDown(pop, { key: 'Escape' })
      expect(fecha).toHaveBeenCalled()
      expect(botao.getAttribute('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(botao)
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'togglePopover')
      Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover')
    }
  })
  it('classe eq desenha ＝ e "sem variação" vem do modelo', () => {
    const v = view()
    if (v.inscritos.estado !== 'ok') throw new Error('fixture')
    v.inscritos.linhas[0] = ins(1, { classe: 'eq', pct: 'sem variação', barra: 0, sub: '640 no total' })
    const { container } = render(<RiSecoes ri={v} ocupada={false} />)
    const val = container.querySelector('#inscritos .ri-lst li .dir.eq')!
    expect(val.textContent).toContain('＝')
    expect(val.textContent).toContain('sem variação')
    expect(container.querySelector('#inscritos .ri-lst li .dv .b.eq')).not.toBeNull()
    const src = fs.readFileSync(path.join(DIR, 'ri-secoes.tsx'), 'utf8')
    expect(src).not.toContain('sem variação')
  })
  it('nenhum texto dos estados carregando, lento, parcial ou restrito existe no componente', () => {
    for (const f of ['ri-secoes.tsx', 'ri-regua.tsx', 'ri-info.tsx']) {
      const src = fs.readFileSync(path.join(DIR, f), 'utf8')
      for (const t of ['Calculando', 'Está demorando', 'não carregaram', 'restrito']) expect(src, `${f}: ${t}`).not.toContain(t)
    }
  })
})

describe('RI · portão Yannis (I2, M13)', () => {
  it('I2: clicar "Ganho em inscritos" troca a largura da primeira barra e a legenda, sem roteador', () => {
    const { container } = render(<RiSecoes ri={view()} ocupada={false} />)
    const sec = container.querySelector<HTMLElement>('#inscritos')!
    const larg = () => sec.querySelector<HTMLElement>('.ri-lst > li .dv .b')!.style.width
    expect(larg()).toBe('10%')
    expect(within(sec).getByText('Barra: tamanho do ganho em %.')).toBeTruthy()
    fireEvent.click(within(sec).getByRole('button', { name: 'Ganho em inscritos' }))
    // ordem abs = c3, c2, c1; a primeira é c3 com barra.abs = 20
    expect(larg()).toBe('20%')
    expect(within(sec).getByText('Barra: tamanho do ganho em inscritos.')).toBeTruthy()
    const todas = [...sec.querySelectorAll<HTMLElement>('.ri-lst > li .dv .b')].map((b) => b.style.width)
    expect(todas).toEqual(['20%', '30%', '40%'])
    expect(replace).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })
  it('M13: depois de "Faixa mais estreita" o .ri-rk da 1ª linha é 1 (o canal mais estreito); a provisória mostra –', () => {
    const v = view()
    if (v.referencias.estado !== 'ok') throw new Error('fixture')
    const prov = ref(9, { provisoria: true, faixa: null, pilula: { tipo: 'prov', texto: 'provisória · 3 vídeos' } })
    v.referencias = { ...v.referencias, linhas: [...v.referencias.linhas, prov], n: 4 }
    const { container } = render(<RiSecoes ri={v} ocupada={false} />)
    const sec = container.querySelector<HTMLElement>('#referencias')!
    fireEvent.click(within(sec).getByRole('button', { name: 'Faixa mais estreita' }))
    const lis = [...sec.querySelectorAll('.ri-lst > li')]
    expect(lis[0]!.querySelector('.ri-rk')?.textContent).toBe('1')
    expect(lis[0]!.querySelector('.n')?.textContent).toBe('Canal 3')
    expect(lis[3]!.querySelector('.ri-rk')?.textContent).toBe('–')
  })
})

describe('RI · ocupada, rerender e atalhos', () => {
  it('aria-busy nas duas seções com ocupada', () => {
    const { container, rerender } = render(<RiSecoes ri={view()} ocupada />)
    expect(container.querySelector('#referencias')?.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('#inscritos')?.getAttribute('aria-busy')).toBe('true')
    rerender(<RiSecoes ri={view()} ocupada={false} />)
    expect(container.querySelector('#referencias')?.getAttribute('aria-busy')).toBe('false')
  })
  it('depois do replaceState, um rerender com o mesmo ri mantém a ordem escolhida', () => {
    const ri = view()
    const { container, rerender } = render(<RiSecoes ri={ri} ocupada={false} />)
    const sec = container.querySelector<HTMLElement>('#referencias')!
    fireEvent.click(within(sec).getByRole('button', { name: 'Faixa mais estreita' }))
    rerender(<RiSecoes ri={ri} ocupada />)
    expect(nomesDe(container.querySelector<HTMLElement>('#referencias')!)).toEqual(['Canal 3', 'Canal 2', 'Canal 1'])
  })
  it('RiAtalhos desenha os dois links', () => {
    render(<RiAtalhos ri={view()} />)
    expect(screen.getByRole('link', { name: 'Referências' }).getAttribute('href')).toBe('#referencias')
    expect(screen.getByRole('link', { name: 'Inscritos' }).getAttribute('href')).toBe('#inscritos')
  })
  it('a frase vem em trechos: o negrito só onde o modelo marcou', () => {
    const { container } = render(<RiSecoes ri={view()} ocupada={false} />)
    expect(container.querySelector('#referencias .ri-lead b')?.textContent).toBe('Canal 1 tem 1 mil de views')
  })
  it('provisória: marca vazada, trilho pontilhado, sem faixa; pílula "pont" na linha', () => {
    const v = view()
    if (v.referencias.estado !== 'ok') throw new Error('fixture')
    v.referencias.linhas[2] = ref(3, { provisoria: true, faixa: null, pilula: { tipo: 'prov', texto: 'provisória · 4 vídeos' }, sub: null })
    const { container } = render(<RiSecoes ri={v} ocupada={false} />)
    expect(container.querySelector('.reg.pt .mk.pv')).not.toBeNull()
    expect(container.querySelectorAll('.reg.pt .faixa')).toHaveLength(0)
    expect(container.querySelector('.pill.pont')?.textContent).toBe('provisória · 4 vídeos')
  })
})

describe('RI · CSS', () => {
  const css = fs.readFileSync(path.join(DIR, 'ri.css'), 'utf8')
  const semComentario = css.replace(/\/\*[\s\S]*?\*\//g, '')
  it('ri.css sem color-mix nem z-index numérico', () => {
    expect(css).not.toMatch(/color-mix/)
    expect(semComentario).not.toMatch(/z-index\s*:\s*-?\d/)
    expect(semComentario).toMatch(/z-index\s*:\s*var\(--z-grudado\)/)
  })
  it('ri.css não redefine .btn, .sec, .pop nem h1/h2', () => {
    const seletores = [...semComentario.matchAll(/([^{}]+)\{/g)].flatMap((m) => m[1].split(',').map((s) => s.trim()))
    for (const proibido of ['.btn', '.sec', '.pop', 'h1', 'h2']) expect(seletores, proibido).not.toContain(proibido)
  })
  it('as âncoras e a linha de atalhos existem', () => {
    expect(css).toMatch(/\.ri-atalhos/)
    const { container } = render(<RiSecoes ri={view()} ocupada={false} />)
    expect(container.querySelector('#referencias')).not.toBeNull()
    expect(container.querySelector('#inscritos')).not.toBeNull()
  })
})

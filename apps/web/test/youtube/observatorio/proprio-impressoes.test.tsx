// @vitest-environment jsdom
// A4 Tarefa 9: o gráfico "Impressões por dia" na tela (spec 16.6, 17.4, 20). O modelo já tem os seus testes; aqui se prova o que o
// navegador desenha e faz: um desenho por estado (barra, traço, coluna hachurada), a dica por mouse, foco e toque, o teclado (uma parada
// de Tab; setas, Home, End, Esc), a tabela equivalente com TODOS os dias, a repintura ao mudar a largura e a ressincronização quando os
// dias mudam (Next 16 não remonta o componente quando só a query muda). Os dias vêm da fixture do canal próprio, já montados.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, within, cleanup, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fs from 'node:fs'
import path from 'node:path'
import { renderToString } from 'react-dom/server'
import { montarDias, type DiaAlcance } from '@/lib/youtube/observatorio/proprio/dias'
import type { DiaYt } from '@/lib/youtube/observatorio/proprio/tipos'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { buildImpressoes, type ImpressoesView } from '@/app/cms/(authed)/youtube/competitors/_proprio/impressoes-model'
import { Impressoes } from '@/app/cms/(authed)/youtube/competitors/_proprio/impressoes'
import { alcanceCheio, alcanceCurto, alcanceNadaLido, alcanceSoVazios, alcanceVazio, alcanceComLinhas } from './proprio-fixture'

// o jsdom 25 não tem PointerEvent: sem ele o fireEvent perde clientX e pointerType
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventDeJsdom extends MouseEvent {
    readonly pointerType: string
    constructor(type: string, init: MouseEventInit & { pointerType?: string } = {}) { super(type, init); this.pointerType = init.pointerType ?? '' }
  }
  Object.defineProperty(window, 'PointerEvent', { value: PointerEventDeJsdom, configurable: true })
}

const dm = (d: DiaYt) => d.slice(8, 10) + '/' + d.slice(5, 7)
const HOJE: DiaYt = '2026-10-03'
const TITULO = 'Impressões por dia do canal'
const O = { escopo: 'canal' as const, alturaArea: 180, dm, acesso: 'ok' as const, hoje: HOJE }

const larguraOriginal = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')
let largura = 700
beforeEach(() => {
  largura = 700
  Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get() { return largura } })
})
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals()
  document.getElementById('flut')?.remove()
  if (larguraOriginal) Object.defineProperty(Element.prototype, 'clientWidth', larguraOriginal)
})

const cheio = (o: Partial<Parameters<typeof buildImpressoes>[2]> = {}): ImpressoesView => {
  const { dias, periodo } = montarDias(alcanceCheio('c', ['yt1', 'yt2'], HOJE))
  return buildImpressoes(dias, periodo, { ...O, ...o })
}
const de = (a: ReturnType<typeof alcanceCheio>, o: Partial<Parameters<typeof buildImpressoes>[2]> = {}): ImpressoesView => {
  const { dias, periodo } = montarDias(a)
  return buildImpressoes(dias, periodo, { ...O, ...o })
}
const montar = (view: ImpressoesView, titulo = TITULO) => render(<div data-obs=""><Impressoes view={view} titulo={titulo} /></div>)
const grupo = (c: ParentNode = document) => c.querySelector<HTMLElement>('[role="group"][tabindex="0"]')!
const flut = () => document.getElementById('flut')
const tips = () => [...(flut()?.querySelectorAll('[role="tooltip"]') ?? [])] as HTMLElement[]
const viva = (c: ParentNode = document) => c.querySelector('[aria-live]')!.textContent
const hit = (i: number) => document.querySelector<SVGRectElement>(`.ic-hit[data-i="${i}"]`)!
const svg = () => document.querySelector<SVGSVGElement>('svg.ic-svg')!

describe('os três estados têm forma própria, além da cor', () => {
  it('cada estado tem forma própria além da cor: barra, traço, coluna hachurada (classe e data-situacao distintos)', () => {
    const v = cheio()
    const { container } = montar(v)
    const cols = [...container.querySelectorAll<SVGGElement>('g[data-situacao]')]
    expect(cols).toHaveLength(v.colunas.length)
    const por = (s: string) => cols.filter(c => c.getAttribute('data-situacao') === s)
    expect(por('com-impressoes')).toHaveLength(11)
    expect(por('zero-medido')).toHaveLength(8)
    expect(por('nao-medido')).toHaveLength(2)
    // a barra: retângulo com a classe da barra e o número em cima
    for (const g of por('com-impressoes')) {
      expect(g.querySelector('rect.ic-bar')).not.toBeNull()
      expect(g.querySelector('rect.ic-zero, rect.ic-nm')).toBeNull()
      expect(g.querySelector('text.ic-val')!.textContent).toBe('17')
    }
    // o zero medido: um traço (line), sem barra e sem número em cima
    for (const g of por('zero-medido')) {
      expect(g.querySelector('rect.ic-zero')).not.toBeNull()
      expect(g.querySelector('rect.ic-bar, rect.ic-nm, text.ic-val')).toBeNull()
    }
    // o não medido: coluna hachurada (pattern) de cima a baixo, também na faixa dos cliques; nenhum número
    for (const g of por('nao-medido')) {
      const rs = [...g.querySelectorAll('rect.ic-nm')]
      expect(rs).toHaveLength(2)
      for (const r of rs) expect(r.getAttribute('fill')).toMatch(/^url\(#[A-Za-z0-9_-]+\)$/)
      expect(g.querySelector('rect.ic-zero, rect.ic-bar, text.ic-val, text.ic-cln, circle')).toBeNull()
    }
    // a hachura existe de verdade no SVG
    const pat = container.querySelector('pattern')!
    expect(pat.getAttribute('id')).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(rsFill(container)).toBe(pat.getAttribute('id'))
  })

  it('o não medido tem altura da área inteira; o zero medido 3 px; a barra, a proporção', () => {
    const v = cheio()
    const { container } = montar(v)
    const area = 180
    const nm = container.querySelector('g[data-situacao="nao-medido"] rect.ic-nm')!
    expect(Number(nm.getAttribute('height'))).toBe(area)
    const bar = container.querySelector('g[data-situacao="com-impressoes"] rect.ic-bar')!
    expect(Number(bar.getAttribute('height'))).toBeCloseTo(area * 17 / 20, 3)
    // o zero medido é uma caixa VAZADA assentada na linha de base (a barra cheia fica acima dela pela altura)
    const zero = container.querySelector('g[data-situacao="zero-medido"] rect.ic-zero')!
    expect(zero.getAttribute('fill')).toBe('none')
    expect(Number(zero.getAttribute('y')) + Number(zero.getAttribute('height'))).toBeCloseTo(Number(bar.getAttribute('y')) + Number(bar.getAttribute('height')), 3)
  })

  it('cliques: círculo na base da barra e o número na faixa "cliques" só nos dias com clique; dia sem CTR e dia não medido não ganham número', () => {
    const { container } = montar(cheio())
    const dots = container.querySelectorAll('circle.ic-dot')
    expect(dots).toHaveLength(11)
    const nums = [...container.querySelectorAll('text.ic-cln')].map(t => t.textContent)
    expect(nums).toHaveLength(11)
    expect(new Set(nums)).toEqual(new Set(['2']))
    expect(container.querySelector('g[data-situacao="nao-medido"] circle, g[data-situacao="zero-medido"] circle')).toBeNull()
  })

  it('I3 (revisão da T9) contraria o mockup: o zero medido tem FORMA própria (caixa vazada), diferente da barra mínima (cheia) e da coluna hachurada, mesmo com os rótulos omitidos', () => {
    // 29 dias em 300 px: ~8 px por coluna, os números em cima da barra somem
    largura = 300
    const dias: DiaAlcance[] = []
    for (let i = 0; i < 29; i++) dias.push(i === 3 ? { dia: addDays('2026-09-01', i), situacao: 'com-impressoes', motivo: null, imp: 1, cliques: 0 }
      : i === 4 ? { dia: addDays('2026-09-01', i), situacao: 'zero-medido', motivo: null, imp: 0, cliques: 0 }
      : i === 5 ? { dia: addDays('2026-09-01', i), situacao: 'nao-medido', motivo: 'sem-relatorio', imp: null, cliques: null }
      : { dia: addDays('2026-09-01', i), situacao: 'com-impressoes', motivo: null, imp: 400, cliques: 3 })
    const v = buildImpressoes(dias, { de: '2026-09-01', ate: '2026-09-29', dias: 29 }, O)
    const { container } = montar(v)
    expect(container.querySelectorAll('text.ic-val').length).toBeLessThan(29)   // rótulos omitidos quando apertam
    const g = (sit: string, i: number) => container.querySelectorAll<SVGElement>(`g[data-situacao="${sit}"]`)[i]!
    const minimo = g('com-impressoes', 3).querySelector('rect.ic-bar')!        // dia 4: 1 impressão
    const zero = g('zero-medido', 0).querySelector('rect.ic-zero')!
    const nao = g('nao-medido', 0)
    // 1) a mínima é barra CHEIA de 3 px, o zero é caixa vazada mais alta que ela (nada de retângulos de 3 px iguais)
    expect(minimo.getAttribute('height')).toBe('3')
    expect(minimo.getAttribute('fill')).toBeNull()                              // preenchida pela classe .ic-bar
    expect(zero.getAttribute('fill')).toBe('none')
    expect(Number(zero.getAttribute('height'))).toBeGreaterThan(3)
    expect(zero.getAttribute('class')).not.toBe(minimo.getAttribute('class'))
    expect(zero.getAttribute('stroke-width') ?? '').not.toBe('')
    // 2) o não medido é outra coisa: nenhum rect.ic-bar/ic-zero, só as colunas hachuradas
    expect(nao.querySelector('rect.ic-bar, rect.ic-zero')).toBeNull()
    expect(nao.querySelectorAll('rect.ic-nm')).toHaveLength(2)
    expect(nao.querySelector('rect.ic-nm')!.getAttribute('fill')).toMatch(/^url\(#/)
    // 3) a legenda segue: o zero tem amostra de caixa vazada (classe própria), não a barra
    expect(container.querySelector('.ic-sw.zero')).not.toBeNull()
    // 4) os três têm o mesmo x de coluna mas atributos de desenho diferentes (em escala de cinza ainda se separam pela forma)
    const assinatura = (e: Element) => `${e.tagName}|${e.getAttribute('class')}|${e.getAttribute('fill')}|${e.getAttribute('height')}`
    expect(new Set([assinatura(minimo), assinatura(zero), assinatura(nao.querySelector('rect.ic-nm')!)]).size).toBe(3)
  })

  it('o dia com impressão e CTR nulo mostra a marca hachurada na faixa de cliques (não medido), nunca "0"', () => {
    const a = alcanceComLinhas('c', HOJE, [{ ytId: 'yt1', dia: addDays(HOJE, -3), imp: 9, ctr: null }])
    const { container } = montar(de(a))
    const g = container.querySelector('g[data-situacao="com-impressoes"]')!
    expect(g.querySelector('rect.ic-bar')).not.toBeNull()
    expect(g.querySelector('circle.ic-dot, text.ic-cln')).toBeNull()
    expect(g.querySelector('rect.ic-nm-cl')).not.toBeNull()
  })

  it('o eixo vertical tem o nome "impressões" e três marcas; o eixo de datas tem poucas marcas legíveis', () => {
    const { container } = montar(cheio())
    expect(container.querySelector('text.ic-an')!.textContent).toBe('impressões')
    expect([...container.querySelectorAll('text.ic-ax-y')].map(t => t.textContent)).toEqual(['0', '10', '20'])
    const datas = [...container.querySelectorAll('text.ic-ax-x')].map(t => t.textContent)
    expect(datas).toEqual(cheio().colunas.filter(c => c.marca).map(c => c.rotulo))
    expect(datas).toHaveLength(4)
  })

  it('nenhum texto do SVG sai de 12 px e nada é NaN', () => {
    const { container } = montar(cheio())
    expect(container.innerHTML).not.toMatch(/NaN|undefined|Infinity/)
    const css = fs.readFileSync(path.join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_proprio/impressoes.css'), 'utf8')
    for (const m of css.matchAll(/font(?:-size)?:\s*(?:\d{3}\s+)?(\d+(?:\.\d+)?)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
  })
})

function rsFill(c: HTMLElement): string | null {
  const f = c.querySelector('rect.ic-nm')?.getAttribute('fill') ?? ''
  const m = /^url\(#(.+)\)$/.exec(f)
  return m ? m[1]! : null
}

describe('leitura de relance e nome acessível', () => {
  it('a frase-resumo está acima do gráfico e o grupo tem o nome com o título, o período e o resumo', () => {
    const v = cheio()
    const { container } = montar(v)
    const frase = screen.getByText(v.resumo!)
    const g = grupo(container)
    expect(frase.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const nome = g.getAttribute('aria-label')!
    expect(nome).toContain(TITULO)
    expect(nome).toContain(v.resumo!)
    expect(nome).toContain('setas')
  })

  it('escreve "dia do YouTube" uma vez, com o ⓘ', () => {
    montar(cheio())
    expect(screen.getAllByText(/dia do YouTube/)).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Como ler este gráfico' })).toBeTruthy()
  })

  it('o ⓘ abre o método (camada flutuante) e fecha com Esc', async () => {
    const user = userEvent.setup()
    montar(cheio())
    const b = screen.getByRole('button', { name: 'Como ler este gráfico' })
    expect(b.getAttribute('aria-expanded')).toBe('false')
    await user.click(b)
    expect(b.getAttribute('aria-expanded')).toBe('true')
    const dialogo = within(flut()!).getByRole('dialog')
    expect(dialogo.textContent).toMatch(/Pacífico/)
    expect(dialogo.textContent).toMatch(/linear/)
    await user.keyboard('{Escape}')
    expect(within(flut() ?? document.body).queryByRole('dialog')).toBeNull()
  })

  it('a legenda tem os quatro itens com texto e amostra, uma amostra por forma', () => {
    const { container } = montar(cheio())
    const itens = [...container.querySelectorAll('.ic-lg')]
    expect(itens.map(i => i.textContent)).toEqual(cheio().legenda.map(l => l.texto))
    expect(itens).toHaveLength(4)
    for (const i of itens) expect(i.querySelector('[aria-hidden="true"]')).not.toBeNull()
    expect(itens.map(i => i.querySelector('i')!.className)).toEqual(['ic-sw imp', 'ic-sw cl', 'ic-sw zero', 'ic-sw nm obs-ch-nm'])
  })

  it('os avisos aparecem como lista, acima do desenho', () => {
    const v = de(alcanceCurto('c', ['yt1'], HOJE))
    const { container } = montar(v)
    const li = container.querySelectorAll('.ic-avisos li')
    expect([...li].map(l => l.textContent)).toEqual(v.avisos)
    expect(v.avisos.length).toBeGreaterThan(0)
  })
})

describe('teclado: uma parada de Tab', () => {
  it('uma parada de Tab no gráfico; setas, Home e End percorrem os dias; Esc fecha a dica', async () => {
    const user = userEvent.setup()
    const v = cheio()
    const { container } = montar(v)
    const n = v.colunas.length
    // nada dentro do desenho é tabulável
    expect(container.querySelector('svg [tabindex]')).toBeNull()
    expect(container.querySelectorAll('[role="group"][tabindex="0"]')).toHaveLength(1)
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Como ler este gráfico' }))
    await user.tab()
    expect(document.activeElement).toBe(grupo(container))
    // ao receber o foco, a dica do primeiro dia aparece e é falada
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[0]!.dica])
    expect(viva(container)).toBe(v.colunas[0]!.dica)
    await user.keyboard('{ArrowRight}')
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[1]!.dica])
    expect(viva(container)).toBe(v.colunas[1]!.dica)
    await user.keyboard('{End}')
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[n - 1]!.dica])
    await user.keyboard('{ArrowRight}') // no último, fica no último
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[n - 1]!.dica])
    await user.keyboard('{ArrowLeft}')
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[n - 2]!.dica])
    await user.keyboard('{Home}')
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[0]!.dica])
    await user.keyboard('{ArrowLeft}') // no primeiro, fica no primeiro
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[0]!.dica])
    // a coluna do foco é marcada no desenho (forma, não só a dica)
    expect(hit(0).getAttribute('class')).toContain('on')
    expect(document.querySelectorAll('.ic-hit.on')).toHaveLength(1)
    await user.keyboard('{Escape}')
    expect(tips()).toHaveLength(0)
    expect(document.querySelectorAll('.ic-hit.on')).toHaveLength(0)
    // depois do Esc, a seta retoma de onde estava
    await user.keyboard('{ArrowRight}')
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[1]!.dica])
  })

  it('sair do gráfico com Tab fecha a dica e zera o ponto de partida', async () => {
    const user = userEvent.setup()
    const v = cheio()
    montar(v)
    await user.tab(); await user.tab()
    await user.keyboard('{End}')
    expect(tips()).toHaveLength(1)
    await user.tab()
    expect(tips()).toHaveLength(0)
    expect(viva(document)).toBe('')
    await user.tab({ shift: true })
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[0]!.dica]) // volta pelo começo, não pelo "End" de antes
  })

  it('a dica de cada estado diz o estado: com impressões, zero medido e não medido', async () => {
    const user = userEvent.setup()
    const v = cheio()
    montar(v)
    await user.tab(); await user.tab()
    const seen = new Set<string>()
    for (let i = 0; i < v.colunas.length; i++) {
      seen.add(v.colunas[i]!.situacao)
      expect(tips()[0]!.textContent).toBe(v.colunas[i]!.dica)
      await user.keyboard('{ArrowRight}')
    }
    expect(seen).toEqual(new Set(['com-impressoes', 'zero-medido', 'nao-medido']))
    const dicas = v.colunas.map(c => c.dica)
    expect(dicas.some(d => /nenhuma impressão/.test(d))).toBe(true)
    expect(dicas.some(d => /\(não medido\)/.test(d))).toBe(true)
  })
})

describe('mouse e toque', () => {
  it('mouse: a dica segue o dia sob o ponteiro e some quando ele sai', () => {
    const v = cheio()
    const { container } = montar(v)
    const g = grupo(container)
    fireEvent.pointerMove(hit(3), { pointerType: 'mouse' })
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[3]!.dica])
    fireEvent.pointerMove(hit(5), { pointerType: 'mouse' })
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[5]!.dica])
    fireEvent.pointerLeave(g, { pointerType: 'mouse' })
    expect(tips()).toHaveLength(0)
  })

  it('toque real: tocar a coluna abre a dica e ela fica depois de levantar o dedo; um toque fora fecha', () => {
    const v = cheio()
    const { container } = render(<div data-obs=""><button type="button">fora</button><Impressoes view={v} titulo={TITULO} /></div>)
    const g = grupo(container)
    fireEvent.pointerDown(hit(4), { pointerType: 'touch' })
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[4]!.dica])
    fireEvent.pointerLeave(g, { pointerType: 'touch' }) // levantar o dedo não esconde
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[4]!.dica])
    fireEvent.pointerDown(hit(9), { pointerType: 'touch' }) // outro dia: troca
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[9]!.dica])
    fireEvent.pointerDown(screen.getByRole('button', { name: 'fora' }), { pointerType: 'touch' })
    expect(tips()).toHaveLength(0)
  })

  it('o foco que o navegador dá ao toque não troca a dica tocada pela do primeiro dia', () => {
    const v = cheio()
    const { container } = montar(v)
    const g = grupo(container)
    fireEvent.pointerDown(hit(6), { pointerType: 'touch' })
    act(() => g.focus())
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[6]!.dica])
  })

  it('o ponteiro não rouba o dia do teclado: com foco, sair com o mouse volta para o dia do foco', async () => {
    const user = userEvent.setup()
    const v = cheio()
    const { container } = montar(v)
    await user.tab(); await user.tab()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    fireEvent.pointerMove(hit(9), { pointerType: 'mouse' })
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[9]!.dica])
    fireEvent.pointerLeave(grupo(container), { pointerType: 'mouse' })
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[2]!.dica])
  })
})

describe('tabela equivalente', () => {
  it('"Ver como tabela" mostra TODOS os dias do período, com dia, situação, impressões e cliques estimados', async () => {
    const user = userEvent.setup()
    const v = cheio()
    const { container } = montar(v)
    const detalhes = container.querySelector('details')!
    expect(detalhes.open).toBe(false)
    expect(within(detalhes).getByText('Ver como tabela')).toBeTruthy()
    await user.click(within(detalhes).getByText('Ver como tabela'))
    expect(detalhes.open).toBe(true)
    const cab = [...detalhes.querySelectorAll('thead th')].map(t => t.textContent)
    expect(cab).toEqual(['Dia', 'Impressões', 'Cliques estimados', 'Situação do relatório'])
    const linhas = [...detalhes.querySelectorAll('tbody tr')]
    expect(linhas).toHaveLength(v.colunas.length)
    linhas.forEach((tr, i) => {
      const c = v.colunas[i]!
      expect(tr.querySelector('th')!.textContent).toBe(c.rotulo)
      expect(tr.getAttribute('data-situacao')).toBe(c.situacao)
      const tds = [...tr.querySelectorAll('td')].map(t => t.textContent)
      expect(tds[2]).toBe(c.situacaoTexto)
      if (c.situacao === 'nao-medido') expect(tds.slice(0, 2)).toEqual(['não medido', 'não medido'])
      else expect(tds[0]).toBe(c.imp)
    })
    expect(detalhes.querySelector('caption')!.textContent).toBe(TITULO)
    // o não medido é a pastilha do kit (hachura + palavra), o zero medido é o número "0"
    expect(detalhes.querySelector('tr[data-situacao="nao-medido"] td .obs-ch-nm')!.textContent).toBe('não medido')
    expect(detalhes.querySelector('tr[data-situacao="zero-medido"] td')!.textContent).toBe('0')
  })

  it('a região rolável da tabela se alcança pelo teclado e tem nome', () => {
    const { container } = montar(cheio())
    const reg = container.querySelector<HTMLElement>('details [role="region"]')!
    expect(reg.getAttribute('tabindex')).toBe('0')
    expect(reg.getAttribute('aria-label')).toContain(TITULO)
  })

  it('o dia com CTR nulo diz "não medido" nos cliques da tabela, com as impressões', async () => {
    const a = alcanceComLinhas('c', HOJE, [{ ytId: 'yt1', dia: addDays(HOJE, -3), imp: 9, ctr: null }])
    const { container } = montar(de(a))
    const tr = container.querySelector('tbody tr[data-situacao="com-impressoes"]')!
    const tds = [...tr.querySelectorAll('td')]
    expect(tds[0]!.textContent).toBe('9')
    expect(tds[1]!.textContent).toBe('não medido')
  })
})

describe('repintura ao mudar a largura', () => {
  it('repinta ao mudar a largura (resize com 120 ms de espera) e mantém "Ver como tabela" aberto', () => {
    vi.useFakeTimers()
    const { container } = montar(cheio())
    expect(svg().getAttribute('width')).toBe('700')
    const detalhes = container.querySelector('details')!
    detalhes.open = true
    largura = 400
    act(() => { window.dispatchEvent(new Event('resize')) })
    act(() => { vi.advanceTimersByTime(119) })
    expect(svg().getAttribute('width')).toBe('700')
    act(() => { vi.advanceTimersByTime(1) })
    expect(svg().getAttribute('width')).toBe('400')
    expect(container.querySelector('details')).toBe(detalhes) // o mesmo nó, não remontou
    expect(detalhes.open).toBe(true)
    // vários resizes seguidos: só o último vale
    largura = 500
    act(() => { window.dispatchEvent(new Event('resize')) })
    act(() => { vi.advanceTimersByTime(100) })
    largura = 520
    act(() => { window.dispatchEvent(new Event('resize')) })
    act(() => { vi.advanceTimersByTime(119) })
    expect(svg().getAttribute('width')).toBe('400')
    act(() => { vi.advanceTimersByTime(1) })
    expect(svg().getAttribute('width')).toBe('520')
  })

  it('girar o aparelho (orientationchange) repinta com 250 ms de espera', () => {
    vi.useFakeTimers()
    montar(cheio())
    largura = 360
    act(() => { window.dispatchEvent(new Event('orientationchange')) })
    act(() => { vi.advanceTimersByTime(249) })
    expect(svg().getAttribute('width')).toBe('700')
    act(() => { vi.advanceTimersByTime(1) })
    expect(svg().getAttribute('width')).toBe('360')
  })

  it('abaixo de 560 px o desenho cabe na coluna (mínimo 300) e o texto do SVG continua em 12 px: nada de viewBox encolhido', () => {
    largura = 334
    montar(cheio())
    expect(svg().getAttribute('width')).toBe('334')
    expect(svg().getAttribute('viewBox')).toBe(`0 0 334 ${svg().getAttribute('height')}`)
    cleanup()
    largura = 280
    montar(cheio())
    expect(svg().getAttribute('width')).toBe('300') // mínimo; a caixa rola por dentro, a tela não
    cleanup()
    largura = 1400
    montar(cheio())
    expect(svg().getAttribute('width')).toBe('860') // máximo
  })

  it('o ouvinte é removido ao desmontar (nenhuma repintura depois)', () => {
    vi.useFakeTimers()
    const rm = vi.spyOn(window, 'removeEventListener')
    const { unmount } = montar(cheio())
    unmount()
    expect(rm.mock.calls.filter(c => c[0] === 'resize')).toHaveLength(1)
    expect(rm.mock.calls.filter(c => c[0] === 'orientationchange')).toHaveLength(1)
    expect(() => { window.dispatchEvent(new Event('resize')); vi.advanceTimersByTime(500) }).not.toThrow()
  })
})

describe('Next 16: a mesma árvore com outros dias', () => {
  it('trocar os dias (outro canal ou período) zera a dica e o dia do foco: o estado não fica preso ao conjunto antigo', async () => {
    const user = userEvent.setup()
    const longo = cheio()
    const curto = de(alcanceCurto('c', ['yt1'], HOJE))
    const { rerender, container } = render(<div data-obs=""><Impressoes view={longo} titulo={TITULO} /></div>)
    await user.tab(); await user.tab()
    await user.keyboard('{End}')
    expect(tips().map(t => t.textContent)).toEqual([longo.colunas[longo.colunas.length - 1]!.dica])
    rerender(<div data-obs=""><Impressoes view={curto} titulo="Impressões por dia deste vídeo" /></div>)
    expect(container.querySelectorAll('rect.ic-hit')).toHaveLength(curto.colunas.length)
    expect(tips()).toHaveLength(0)
    expect(viva(container)).toBe('')
    expect(document.querySelectorAll('.ic-hit.on')).toHaveLength(0)
    // o foco continua no mesmo grupo (não remontou); a seta parte do começo da série nova, sem índice fora dela
    expect(document.activeElement).toBe(grupo(container))
    await user.keyboard('{ArrowRight}')
    expect(tips().map(t => t.textContent)).toEqual([curto.colunas[0]!.dica])
    await user.keyboard('{End}')
    expect(tips().map(t => t.textContent)).toEqual([curto.colunas[curto.colunas.length - 1]!.dica])
  })

  it('o mesmo conjunto de dias com os números mudados mostra a dica nova (a dica lê a view atual)', () => {
    const v1 = cheio()
    const { rerender } = render(<div data-obs=""><Impressoes view={v1} titulo={TITULO} /></div>)
    fireEvent.pointerMove(hit(3), { pointerType: 'mouse' })
    const novo: ImpressoesView = { ...v1, colunas: v1.colunas.map((c, i) => (i === 3 ? { ...c, dica: 'texto novo do dia' } : c)) }
    rerender(<div data-obs=""><Impressoes view={novo} titulo={TITULO} /></div>)
    expect(tips().map(t => t.textContent)).toEqual(['texto novo do dia'])
  })
})

describe('estados da série', () => {
  it('sem relatório (tabela vazia): a frase, sem desenho, sem legenda, sem tabela e sem 0 em lugar nenhum', () => {
    const { container } = montar(de(alcanceVazio('c')))
    expect(screen.getByText('Ainda não há relatório de alcance deste canal.')).toBeTruthy()
    expect(container.querySelector('svg, details, .ic-leg, [role="group"]')).toBeNull()
    expect(container.textContent).not.toMatch(/\b0\b/)
  })

  it('acesso negado: "Só quem edita o site vê as impressões." e nenhum desenho', () => {
    const v = buildImpressoes(montarDias(alcanceCheio('c', ['yt1'], HOJE)).dias, null, { ...O, acesso: 'negado' })
    const { container } = montar(v)
    expect(screen.getByText('Só quem edita o site vê as impressões.')).toBeTruthy()
    expect(container.querySelector('svg, details, [role="group"]')).toBeNull()
    expect(container.textContent).not.toMatch(/\d{2,}/)
  })

  it('nenhum dia lido: o desenho é todo hachurado e a frase diz que nada foi medido (não é uma linha de zeros)', () => {
    const v = de(alcanceNadaLido('c', HOJE))
    const { container } = montar(v)
    expect(screen.getByText('Nenhum dos 3 dias do período tem relatório lido: impressões e cliques não medidos.')).toBeTruthy()
    expect(container.querySelectorAll('g[data-situacao="nao-medido"]')).toHaveLength(3)
    expect(container.querySelector('rect.ic-zero, rect.ic-bar')).toBeNull()
  })

  it('todos os dias lidos em zero: só traços, com "Nenhuma impressão" na frase', () => {
    const v = de(alcanceSoVazios('c', HOJE, 10))
    const { container } = montar(v)
    expect(screen.getByText(/^Nenhuma impressão em 10 dias/)).toBeTruthy()
    expect(container.querySelectorAll('g[data-situacao="zero-medido"] rect.ic-zero')).toHaveLength(10)
    expect(container.querySelector('rect.ic-bar, rect.ic-nm')).toBeNull()
    expect(container.innerHTML).not.toMatch(/NaN/)
  })

  it('série de 1 dia: uma coluna com largura limitada (não estica pela tela toda), com o aviso', () => {
    const a = alcanceComLinhas('c', HOJE, [])
    const v = buildImpressoes([{ dia: '2026-10-01', situacao: 'com-impressoes', motivo: null, imp: 6, cliques: 1 }], { de: '2026-10-01', ate: '2026-10-01', dias: 1 }, O)
    expect(a).toBeTruthy()
    const { container } = montar(v)
    expect(container.querySelectorAll('g[data-situacao]')).toHaveLength(1)
    const bar = container.querySelector('rect.ic-bar')!
    expect(Number(bar.getAttribute('width'))).toBeLessThanOrEqual(40)
    expect(screen.getByText('Menos de 7 dias medidos (1): ainda é pouco para ver um padrão.')).toBeTruthy()
    fireEvent.pointerMove(hit(0), { pointerType: 'mouse' })
    expect(tips().map(t => t.textContent)).toEqual(['01/10: 6 impressões, 1 clique estimado'])
  })

  it('série curta (2 dias): duas colunas, aviso de poucos dias', () => {
    const v = de(alcanceCurto('c', ['yt1'], HOJE))
    const { container } = montar(v)
    expect(container.querySelectorAll('g[data-situacao]')).toHaveLength(2)
    expect(screen.getByText('Menos de 7 dias medidos (2): ainda é pouco para ver um padrão.')).toBeTruthy()
  })

  it('série com buracos: os dias não medidos ficam no lugar e o aviso diz que não contam como zero', () => {
    const v = cheio()
    const { container } = montar(v)
    expect(screen.getByText('Dias não medidos não contam como zero nem entram nas somas.')).toBeTruthy()
    const situacoes = [...container.querySelectorAll('g[data-situacao]')].map(g => g.getAttribute('data-situacao'))
    expect(situacoes.slice(-2)).toEqual(['nao-medido', 'nao-medido'])
  })

  it('coleta parada: o aviso "parou em dd/mm" aparece', () => {
    const { dias, periodo } = montarDias(alcanceCheio('c', ['yt1', 'yt2'], HOJE))
    const v = buildImpressoes(dias, periodo, { ...O, hoje: addDays(HOJE, 15) })
    montar(v)
    expect(screen.getByText(`A coleta de relatórios deste canal parou em ${dm(periodo!.ate)}.`)).toBeTruthy()
  })

  it('no vídeo: o zero medido diz "o relatório do dia não trouxe este vídeo" na dica e a altura da área é 110', () => {
    const v = de(alcanceCheio('c', ['yt1', 'yt2'], HOJE), { escopo: 'video', alturaArea: 110 })
    const { container } = montar(v, 'Impressões por dia deste vídeo')
    expect(Number(svg().getAttribute('height'))).toBeLessThan(180 + 90)
    expect(container.querySelector('g[data-situacao="nao-medido"] rect.ic-nm')!.getAttribute('height')).toBe('110')
    const iz = v.colunas.findIndex(c => c.situacao === 'zero-medido')
    fireEvent.pointerMove(hit(iz), { pointerType: 'mouse' })
    expect(tips()[0]!.textContent).toMatch(/o relatório do dia não trouxe este vídeo \(nenhuma impressão\)$/)
  })

  it('rótulos dos valores não se atropelam: com 29 colunas em 300 px alguns valores são omitidos, a dica e a tabela os têm todos', () => {
    largura = 300
    const dias = Array.from({ length: 29 }, (_, i) => ({ dia: addDays('2026-09-01', i), situacao: 'com-impressoes' as const, motivo: null, imp: 100 + i * 37, cliques: 3 }))
    const v = buildImpressoes(dias, { de: '2026-09-01', ate: '2026-09-29', dias: 29 }, O)
    const { container } = montar(v)
    const rotulos = container.querySelectorAll('text.ic-val')
    expect(rotulos.length).toBeGreaterThan(0)
    expect(rotulos.length).toBeLessThan(29)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(29)
  })
})

describe('servidor e cliente', () => {
  it('renderiza no servidor sem tocar em document, janela nem relógio, com o mesmo HTML do primeiro render do cliente', () => {
    const v = cheio()
    const servidor = renderToString(<div data-obs=""><Impressoes view={v} titulo={TITULO} /></div>)
    expect(servidor).toContain('<svg')
    expect(servidor).toContain('width="760"') // sem medida, a largura é a de partida (hidratação idêntica)
    largura = 0
    const { container } = montar(v)
    expect(container.querySelector('svg.ic-svg')!.getAttribute('width')).toBe('760')
  })

  it('o componente e o modelo não usam new Date nem Date.now (o dia é a data UTC que já veio pronta)', () => {
    const dir = path.join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_proprio')
    for (const f of ['impressoes.tsx', 'impressoes-model.ts']) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8')
      expect(src, f).not.toMatch(/new Date\(|Date\.now\(/)
      expect(src, f).not.toMatch(/proprio\/ler|proprio\/edicao|_proprio\/dados|server-only/)
    }
  })
})

describe('regras do CSS', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_proprio/impressoes.css'), 'utf8')
  it('sem color-mix, sem z-index numérico, sem cor de estado fora dos tokens', () => {
    expect(css).not.toMatch(/color-mix\(/)
    expect(css).not.toMatch(/z-index\s*:\s*-?\d/)
    expect(css).toMatch(/var\(--lado-o\)/)
    expect(css).toMatch(/var\(--im-zero\)/)
    expect(css).toMatch(/var\(--nm\)/)
    expect(css).toMatch(/var\(--im-cl\)/)
  })
  it('alvo de toque de 44 px em pointer:coarse para o resumo da tabela e o ⓘ, e a hachura do kit', () => {
    expect(css).toMatch(/@media \(pointer:coarse\)[^}]*\{[^]*44px/)
    expect(css).toMatch(/\.ic-info/)
    expect(css).toMatch(/var\(--nm-bg\)/)
  })
  it('a caixa do desenho rola por dentro (a tela não)', () => {
    expect(css).toMatch(/\.ic-sc\{[^}]*overflow-x:auto/)
  })
})

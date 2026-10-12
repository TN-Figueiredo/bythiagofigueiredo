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
    }
    // o número em cima da barra mora na camada final (depois de todas as colunas), um por dia com impressões
    expect([...container.querySelectorAll('.ic-topo text.ic-val')].map(t => t.textContent)).toEqual(Array(11).fill('17'))
    // o zero medido: um traço (line), sem barra e sem número em cima
    for (const g of por('zero-medido')) {
      expect(g.querySelector('rect.ic-zero')).not.toBeNull()
      expect(g.querySelector('rect.ic-bar, rect.ic-nm, text.ic-val')).toBeNull()
    }
    // o não medido: bloco hachurado (pattern) na base da coluna, também na faixa dos cliques; nenhum número
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

  it('o não medido é o BLOCO do mockup (24 px assentados na base, não a coluna inteira); o zero medido 6 px; a barra, a proporção', () => {
    const v = cheio()
    const { container } = montar(v)
    const area = 180
    const nm = container.querySelector('g[data-situacao="nao-medido"] rect.ic-nm')!
    expect(Number(nm.getAttribute('height'))).toBe(24)            // round(min(24, altura da área * 0,25)) do mockup aprovado (A.serieDia)
    expect(Number(nm.getAttribute('height'))).toBeLessThan(area)  // nunca a coluna inteira de cima a baixo
    const bar = container.querySelector('g[data-situacao="com-impressoes"] rect.ic-bar')!
    expect(Number(bar.getAttribute('height'))).toBeCloseTo(area * 17 / 20, 3)
    // o zero medido é uma caixa VAZADA assentada na linha de base (a barra cheia fica acima dela pela altura)
    const zero = container.querySelector('g[data-situacao="zero-medido"] rect.ic-zero')!
    expect(zero.getAttribute('fill')).toBe('none')
    expect(Number(zero.getAttribute('y')) + Number(zero.getAttribute('height'))).toBeCloseTo(Number(bar.getAttribute('y')) + Number(bar.getAttribute('height')), 3)
    // o bloco hachurado assenta na MESMA linha de base da barra e do zero medido
    expect(Number(nm.getAttribute('y')) + Number(nm.getAttribute('height'))).toBeCloseTo(Number(bar.getAttribute('y')) + Number(bar.getAttribute('height')), 3)
  })

  it('cliques: um ponto por dia com clique e o número na faixa sob as datas; dia sem CTR e dia não medido não ganham ponto nem número', () => {
    const { container } = montar(cheio())
    const dots = container.querySelectorAll('circle.ic-dot')
    expect(dots).toHaveLength(11)
    const nums = [...container.querySelectorAll('text.ic-cln')].map(t => t.textContent)
    expect(nums).toHaveLength(11)
    expect(new Set(nums)).toEqual(new Set(['2']))
    expect(container.querySelector('g[data-situacao="nao-medido"] circle, g[data-situacao="zero-medido"] circle')).toBeNull()
  })

  it('D2 (fecho da A4): a 300 px (colunas de ~8 px) o MAIOR valor da série, no meio, fica com rótulo de impressões e de cliques; os rótulos que sobram não se sobrepõem', () => {
    largura = 300
    const dias: DiaAlcance[] = []
    for (let i = 0; i < 29; i++) dias.push({ dia: addDays('2026-09-01', i), situacao: 'com-impressoes', motivo: null, imp: i === 10 ? 19983 : 120 + (i % 5), cliques: i === 10 ? 1139 : 3 + (i % 4) })
    const { container } = montar(buildImpressoes(dias, { de: '2026-09-01', ate: '2026-09-29', dias: 29 }, O))
    const imp = [...container.querySelectorAll('text.ic-val')].map(t => t.textContent)
    const cl = [...container.querySelectorAll('text.ic-cln')].map(t => t.textContent)
    expect(imp, 'impressões: o maior tem rótulo').toContain('19.983')
    expect(cl, 'cliques: o maior tem rótulo').toContain('1.139')
    expect(imp.length, 'os outros entram enquanto couberem').toBeGreaterThan(1)
    expect(imp.length).toBeLessThan(29)
    // sem sobreposição: cada rótulo ocupa o seu intervalo de x (largura = caracteres × 7,4) separado do vizinho por 3 px
    const caixas = [...container.querySelectorAll<SVGTextElement>('text.ic-val')].map(t => { const x = Number(t.getAttribute('x')), w = (t.textContent ?? '').length * 7.4; return [x - w / 2, x + w / 2] as const }).sort((a, b) => a[0] - b[0])
    for (let i = 1; i < caixas.length; i++) expect(caixas[i]![0], `rótulo ${i} esbarra no anterior`).toBeGreaterThanOrEqual(caixas[i - 1]![1] + 3 - 1e-9)
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

  it('sair do gráfico (Shift+Tab, para fora dos botões de passo) fecha a dica e zera o ponto de partida', async () => {
    const user = userEvent.setup()
    const v = cheio()
    montar(v)
    await user.tab(); await user.tab()
    await user.keyboard('{End}')
    expect(tips()).toHaveLength(1)
    await user.tab({ shift: true })
    expect(tips()).toHaveLength(0)
    // a região do dia não fica vazia: volta a dizer como ler um dia (a ajuda de mouse e a de toque)
    expect(viva(document)).toContain('Use os botões para ler um dia de cada vez.')
    expect(viva(document)).not.toContain(v.colunas[v.colunas.length - 1]!.dica)
    await user.tab()
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
    // a região do dia volta a dizer como ler um dia (nenhuma frase de dia da série antiga sobra)
    expect(viva(container)).toContain('Use os botões para ler um dia de cada vez.')
    expect(viva(container)).not.toMatch(/\d\d\/\d\d:/)
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
    expect(screen.getByText('Nenhum dos 3 dias do período foi medido: impressões e cliques não medidos.')).toBeTruthy()
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
    expect(container.querySelector('g[data-situacao="nao-medido"] rect.ic-nm')!.getAttribute('height')).toBe('24')   // round(min(24, 110 * 0,25)): o bloco do mockup
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

// ---------------------------------------------------------------------------------------------------------------------------------
// A4 Tarefa 13.2: faixa própria de cliques, botões "Dia anterior / Dia seguinte", última data sem corte, views por dia, dia da publicação.
// ---------------------------------------------------------------------------------------------------------------------------------
const diaCom = (i: number, imp: number, cliques: number | null): DiaAlcance => ({ dia: addDays('2026-09-01', i), situacao: 'com-impressoes', motivo: null, imp, cliques })
const diaZero = (i: number): DiaAlcance => ({ dia: addDays('2026-09-01', i), situacao: 'zero-medido', motivo: null, imp: 0, cliques: 0 })
const diaNm = (i: number): DiaAlcance => ({ dia: addDays('2026-09-01', i), situacao: 'nao-medido', motivo: 'sem-relatorio', imp: null, cliques: null })
const periodoDe = (n: number) => ({ de: '2026-09-01', ate: addDays('2026-09-01', n - 1), dias: n })
const serie = (dias: DiaAlcance[], o: Partial<Parameters<typeof buildImpressoes>[2]> = {}): ImpressoesView => buildImpressoes(dias, periodoDe(dias.length), { ...O, ...o })
const trinta = (): DiaAlcance[] => Array.from({ length: 30 }, (_, i) => (i === 7 ? diaZero(i) : i === 8 ? diaNm(i) : diaCom(i, 40 + i * 13, 1 + (i % 5) * 3)))
const num = (e: Element, a: string) => Number(e.getAttribute(a))

describe('13.2: os cliques moram numa faixa própria sob as datas (a altura não mede nada)', () => {
  it('todos os pontos na mesma linha, abaixo das datas e fora de qualquer barra, mesmo com cliques e impressões muito diferentes', () => {
    const dias = [diaCom(0, 400, 40), diaCom(1, 20, 1), diaCom(2, 3000, 1139), diaCom(3, 9, 0.4), diaZero(4), diaCom(5, 90, 12), diaNm(6), diaCom(7, 2500, 5)]
    const { container } = montar(serie(dias))
    const dots = [...container.querySelectorAll('circle.ic-dot')]
    expect(dots).toHaveLength(6)               // 0,4 arredonda a 0 mas é > 0: ponto com "<1"; zero medido, não medido e o dia com 0 clique não têm ponto
    expect(new Set(dots.map(d => d.getAttribute('cy'))).size).toBe(1)
    const cy = num(dots[0]!, 'cy')
    const baseBarras = Math.max(...[...container.querySelectorAll('rect.ic-bar')].map(r => num(r, 'y') + num(r, 'height')))
    const datas = [...container.querySelectorAll('text.ic-ax-x')].map(t => num(t, 'y'))
    expect(cy).toBeGreaterThan(baseBarras)
    expect(cy).toBeGreaterThan(Math.max(...datas))
    // o número fica LOGO ABAIXO do ponto, todos na mesma linha também
    const nums = [...container.querySelectorAll('text.ic-cln')]
    expect(new Set(nums.map(t => t.getAttribute('y'))).size).toBe(1)
    expect(num(nums[0]!, 'y')).toBeGreaterThan(cy)
    // nada de ponto dentro de uma barra: a antiga posição (4,5 px acima da base) não existe mais
    expect(container.querySelector('.ic-topo circle.ic-dot')).not.toBeNull()
    for (const d of dots) expect(num(d, 'cy')).not.toBeCloseTo(baseBarras - 4.5, 1)
  })

  it('o retângulo rebaixado tem 48 px, o rótulo "cliques estimados por dia" dentro e começa logo sob a linha das datas', () => {
    const { container } = montar(serie(trinta()))
    const faixa = container.querySelector('rect.ic-strip')!
    expect(num(faixa, 'height')).toBe(48)
    const rotulo = container.querySelector('text.ic-stl')!
    expect(rotulo.textContent).toBe('cliques estimados por dia')
    const topo = num(faixa, 'y')
    expect(num(rotulo, 'y')).toBeGreaterThan(topo)
    expect(num(rotulo, 'y')).toBeLessThan(topo + 48)
    expect(num(rotulo, 'x')).toBeGreaterThan(num(faixa, 'x'))
    // o ponto e o número também ficam dentro dela
    for (const e of container.querySelectorAll('circle.ic-dot')) { expect(num(e, 'cy')).toBeGreaterThan(topo); expect(num(e, 'cy')).toBeLessThan(topo + 48) }
    for (const e of container.querySelectorAll('text.ic-cln')) { expect(num(e, 'y')).toBeGreaterThan(topo); expect(num(e, 'y')).toBeLessThan(topo + 48) }
    // a faixa começa depois das datas; o desenho cresce o suficiente para ela caber
    expect(topo).toBeGreaterThan(Math.max(...[...container.querySelectorAll('text.ic-ax-x')].map(t => num(t, 'y'))))
    expect(num(svg(), 'height')).toBeGreaterThanOrEqual(topo + 48)
    // a anotação "cliques" antiga, na margem esquerda, saiu: o rótulo mora dentro da faixa
    expect([...container.querySelectorAll('text')].filter(t => t.textContent === 'cliques')).toHaveLength(0)
  })

  it('o número da faixa tem separador de milhar ("1.139") e "<1" para menos de 1 clique', () => {
    largura = 700
    const { container } = montar(serie([diaCom(0, 9000, 1139.4), diaCom(1, 9000, 0.3), diaCom(2, 9000, 25)]))
    expect([...container.querySelectorAll('text.ic-cln')].map(t => t.textContent)).toEqual(['1.139', '<1', '25'])
  })

  it('números da faixa: só os que não encostam no anterior (3 px de folga) e nenhum passa da borda direita', () => {
    largura = 390
    const { container } = montar(serie(trinta()))
    const W = num(svg(), 'width')
    const nums = [...container.querySelectorAll('text.ic-cln')]
    expect(nums.length).toBeGreaterThan(0)
    expect(nums.length).toBeLessThan(container.querySelectorAll('circle.ic-dot').length + 1)
    let fim = -Infinity
    for (const t of nums) {
      const w = (t.textContent ?? '').length * 7.4
      const x = num(t, 'x')
      expect(x - w / 2).toBeGreaterThanOrEqual(fim + 3)
      expect(x + w / 2).toBeLessThanOrEqual(W)
      fim = x + w / 2
    }
  })

  it('abaixo de 7,5 px por dia não há ponto (nem número); a tabela e a dica seguem com todos os cliques', async () => {
    largura = 300
    const dias = Array.from({ length: 45 }, (_, i) => diaCom(i, 100 + i, 3))
    const { container } = montar(serie(dias))
    expect(container.querySelectorAll('circle.ic-dot')).toHaveLength(0)
    expect(container.querySelectorAll('text.ic-cln')).toHaveLength(0)
    expect(container.querySelector('rect.ic-strip')).not.toBeNull()
    expect(container.querySelectorAll('tbody tr')).toHaveLength(45)
  })

  it('dia com impressão e CTR nulo: hachura na faixa e nenhum ponto nem "0"; o não medido hachura a faixa também', () => {
    const { container } = montar(serie([diaCom(0, 90, null), diaNm(1), diaCom(2, 50, 4)]))
    const comImp = container.querySelectorAll('g[data-situacao="com-impressoes"]')
    expect(comImp[0]!.querySelector('rect.ic-nm-cl')!.getAttribute('fill')).toMatch(/^url\(#/)
    expect(comImp[0]!.querySelector('circle.ic-dot, text.ic-cln')).toBeNull()
    expect(container.querySelector('g[data-situacao="nao-medido"] rect.ic-nm:nth-of-type(2)')).not.toBeNull()
    const faixa = container.querySelector('rect.ic-strip')!
    const hachuras = [...container.querySelectorAll('rect.ic-nm-cl, g[data-situacao="nao-medido"] rect.ic-nm')].filter(r => num(r, 'y') >= num(faixa, 'y'))
    expect(hachuras).toHaveLength(2)
    for (const r of hachuras) expect(num(r, 'y') + num(r, 'height')).toBeLessThanOrEqual(num(faixa, 'y') + 48)
  })

  it('a legenda dos cliques tem amostra neutra e texto curto; a explicação da altura vive no ⓘ', async () => {
    const user = userEvent.setup()
    const { container } = montar(serie(trinta()))
    const itens = [...container.querySelectorAll('.ic-lg')].map(i => i.textContent)
    expect(itens).toContain('cliques estimados do dia')
    expect(itens.join(' ')).not.toMatch(/altura/)
    await user.click(screen.getByRole('button', { name: 'Como ler este gráfico' }))
    expect(within(flut()!).getByRole('dialog').textContent).toMatch(/a altura do ponto não mede nada/)
  })
})

describe('13.2: botões "Dia anterior" e "Dia seguinte" e a frase do dia', () => {
  const status = (c: ParentNode = document) => c.querySelector<HTMLElement>('[role="status"]')!
  const botoes = () => ({ ant: screen.getByRole('button', { name: 'Dia anterior' }), seg: screen.getByRole('button', { name: 'Dia seguinte' }) })

  it('há uma região role=status aria-live=polite entre os dois botões, com as duas frases de ajuda (mouse e toque) enquanto nenhum dia está escolhido', () => {
    const { container } = montar(cheio())
    const { ant, seg } = botoes()
    const s = status(container)
    expect(s.getAttribute('aria-live')).toBe('polite')
    expect(s.querySelector('.ic-out-m')!.textContent).toBe('Passe o mouse sobre o gráfico ou use as setas para ler um dia.')
    expect(s.querySelector('.ic-out-t')!.textContent).toBe('Use os botões para ler um dia de cada vez.')
    // ordem no documento: botão anterior, região, botão seguinte (a frase fica ENTRE os dois), tudo depois do gráfico
    expect(ant.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(s.compareDocumentPosition(seg) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(grupo(container).compareDocumentPosition(ant) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(ant.getAttribute('type')).toBe('button')
    expect(container.querySelectorAll('.ic-step button')).toHaveLength(2)
  })

  it('sem dia escolhido, o seguinte vai ao primeiro dia e o anterior ao último; a frase é a dica do dia', async () => {
    const user = userEvent.setup()
    const v = cheio()
    const { container } = montar(v)
    const { ant, seg } = botoes()
    await user.click(seg)
    expect(status(container).textContent).toBe(v.colunas[0]!.dica)
    expect(document.querySelectorAll('.ic-hit.on')).toHaveLength(1)
    expect(hit(0).getAttribute('class')).toContain('on')
    cleanup()
    const v2 = cheio()
    const m2 = montar(v2)
    await user.click(botoes().ant)
    expect(status(m2.container).textContent).toBe(v2.colunas[v2.colunas.length - 1]!.dica)
    void ant
  })

  it('o botão anda de dia em dia e para nas pontas com aria-disabled (nunca disabled: o foco não some)', async () => {
    const user = userEvent.setup()
    const v = cheio()
    const n = v.colunas.length
    const { container } = montar(v)
    const { ant, seg } = botoes()
    await user.click(seg)                       // dia 0
    expect(ant.getAttribute('aria-disabled')).toBe('true')
    expect(seg.getAttribute('aria-disabled')).toBe('false')
    expect(ant.hasAttribute('disabled')).toBe(false)
    await user.click(ant)                       // continua no 0
    expect(status(container).textContent).toBe(v.colunas[0]!.dica)
    await user.click(seg); await user.click(seg)
    expect(status(container).textContent).toBe(v.colunas[2]!.dica)
    await user.click(ant)
    expect(status(container).textContent).toBe(v.colunas[1]!.dica)
    for (let i = 1; i < n; i++) await user.click(seg)
    expect(status(container).textContent).toBe(v.colunas[n - 1]!.dica)
    expect(seg.getAttribute('aria-disabled')).toBe('true')
    expect(ant.getAttribute('aria-disabled')).toBe('false')
    expect(seg.hasAttribute('disabled')).toBe(false)
    await user.click(seg)                       // não passa do último
    expect(status(container).textContent).toBe(v.colunas[n - 1]!.dica)
    // o botão desabilitado continua alcançável por Tab (foco não some)
    seg.focus()
    expect(document.activeElement).toBe(seg)
  })

  it('a MESMA frase do dia vem pelas setas, pelo botão, pelo mouse e pela tabela (rótulo, valor e cliques do mesmo dia)', async () => {
    const user = userEvent.setup()
    const v = cheio()
    const { container } = montar(v)
    const { seg } = botoes()
    const dias = [0, 3, 8]
    // pelo botão
    for (let i = 0; i <= 8; i++) {
      await user.click(seg)
      if (dias.includes(i)) expect(status(container).textContent).toBe(v.colunas[i]!.dica)
    }
    // pelas setas (com o grupo focado), do mesmo ponto
    act(() => grupo(container).focus())
    for (const i of [0, 3, 8]) {
      await user.keyboard('{Home}')
      for (let k = 0; k < i; k++) await user.keyboard('{ArrowRight}')
      expect(status(container).textContent).toBe(v.colunas[i]!.dica)
    }
    // pelo mouse
    fireEvent.pointerMove(hit(3), { pointerType: 'mouse' })
    expect(status(container).textContent).toBe(v.colunas[3]!.dica)
    // pela tabela: a mesma linha do dia traz o mesmo rótulo e os mesmos números da frase
    await user.click(within(container.querySelector('details')!).getByText('Ver como tabela'))
    for (const i of dias) {
      const tr = container.querySelectorAll('tbody tr')[i]!
      const c = v.colunas[i]!
      expect(c.dica.startsWith(tr.querySelector('th')!.textContent + ':')).toBe(true)
      if (c.imp) expect(c.dica).toContain(c.imp)
      expect(tr.querySelectorAll('td')[0]!.textContent).toBe(c.imp ?? 'não medido')
    }
  })

  it('o dia escolhido pelo botão marca a coluna e escreve a frase embaixo, mas não abre a dica flutuante sobre o gráfico (o teclado e o mouse seguem abrindo)', async () => {
    const user = userEvent.setup()
    const v = cheio()
    const { container } = montar(v)
    await user.click(botoes().seg)
    expect(status(container).textContent).toBe(v.colunas[0]!.dica)
    expect(hit(0).getAttribute('class')).toContain('on')
    expect(tips()).toHaveLength(0)
    fireEvent.pointerMove(hit(3), { pointerType: 'mouse' })
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[3]!.dica])
    await user.click(botoes().seg)
    expect(tips()).toHaveLength(0)
    act(() => grupo(container).focus())
    await user.keyboard('{ArrowRight}')
    expect(tips()).toHaveLength(1)
  })

  it('o toque numa coluna seguido do botão anda a partir dela (o botão não fecha o dia tocado)', async () => {
    const user = userEvent.setup()
    const v = cheio()
    const { container } = montar(v)
    fireEvent.pointerDown(hit(5), { pointerType: 'touch' })
    expect(status(container).textContent).toBe(v.colunas[5]!.dica)
    await user.click(botoes().seg)               // o clique no botão (fora do grupo) NÃO fecha o dia tocado: anda a partir dele
    expect(status(container).textContent).toBe(v.colunas[6]!.dica)
    await user.click(botoes().ant); await user.click(botoes().ant)
    expect(status(container).textContent).toBe(v.colunas[4]!.dica)
  })

  it('Esc no gráfico volta a região para a ajuda; trocar os dias zera a frase (Next 16)', async () => {
    const user = userEvent.setup()
    const v = cheio()
    const { container, rerender } = montar(v)
    act(() => grupo(container).focus())
    await user.keyboard('{ArrowRight}')
    expect(status(container).textContent).toBe(v.colunas[1]!.dica)
    await user.keyboard('{Escape}')
    expect(status(container).textContent).toContain('Use os botões para ler um dia de cada vez.')
    expect(status(container).textContent).not.toMatch(/\d\d\/\d\d:/)
    await user.click(botoes().seg)
    expect(status(container).textContent).toBe(v.colunas[0]!.dica)
    rerender(<div data-obs=""><Impressoes view={de(alcanceCurto('c', ['yt1'], HOJE))} titulo={TITULO} /></div>)
    expect(status(container).textContent).toContain('Use os botões para ler um dia de cada vez.')
    expect(status(container).textContent).not.toMatch(/\d\d\/\d\d:/)
  })

  it('sem permissão ou com erro, nem botões nem número: só a frase', () => {
    const negado = buildImpressoes(montarDias(alcanceCheio('c', ['yt1', 'yt2'], HOJE)).dias, periodoDe(21), { ...O, acesso: 'negado' })
    const { container } = montar(negado)
    expect(screen.queryByRole('button', { name: 'Dia anterior' })).toBeNull()
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
    expect(container.textContent).toContain('Só quem edita o site vê as impressões.')
    expect(container.textContent).not.toMatch(/\d{2}\/\d{2}/)
  })

  it('renderiza no servidor com os dois botões e as duas ajudas (hidratação idêntica)', () => {
    const html = renderToString(<div data-obs=""><Impressoes view={cheio()} titulo={TITULO} /></div>)
    expect(html).toContain('aria-label="Dia anterior"')
    expect(html).toContain('aria-label="Dia seguinte"')
    expect(html).toContain('role="status"')
    expect(html).toContain('Use os botões para ler um dia de cada vez.')
  })
})

describe('13.2: a última data do eixo nunca sai cortada (bordaFinal), no canal e no vídeo', () => {
  for (const escopo of ['canal', 'video'] as const) {
    it(`a 390 px a última etiqueta cabe no SVG e fica a no máximo 9 px do centro da coluna (${escopo})`, () => {
      largura = 390
      const dias = Array.from({ length: 30 }, (_, i) => diaCom(i, 20 + i, 2))
      const { container } = montar(serie(dias, { escopo, alturaArea: escopo === 'video' ? 110 : 180 }))
      const W = num(svg(), 'width')
      const rotulos = [...container.querySelectorAll('text.ic-ax-x')]
      const ultimo = rotulos[rotulos.length - 1]!
      expect(ultimo.textContent).toBe('30/09')
      const meia = (ultimo.textContent ?? '').length * 7.2 / 2
      const x = num(ultimo, 'x')
      expect(ultimo.getAttribute('text-anchor')).toBe('middle')
      expect(x + meia).toBeLessThanOrEqual(W)
      expect(x - meia).toBeGreaterThan(0)
      const centroColuna = num(hit(29), 'x') + num(hit(29), 'width') / 2
      expect(Math.abs(centroColuna - x)).toBeLessThanOrEqual(9)
      // sem encostar na etiqueta anterior
      const pen = rotulos[rotulos.length - 2]!
      expect(x - meia - (num(pen, 'x') + meia)).toBeGreaterThanOrEqual(4)
    })
  }

  it('com largura sobrando, a etiqueta final fica no centro da coluna (não é puxada)', () => {
    largura = 760
    const { container } = montar(serie(Array.from({ length: 10 }, (_, i) => diaCom(i, 20 + i, 2))))
    const rotulos = [...container.querySelectorAll('text.ic-ax-x')]
    const ultimo = rotulos[rotulos.length - 1]!
    const h = hit(9)
    expect(num(ultimo, 'x')).toBeCloseTo(num(h, 'x') + num(h, 'width') / 2, 3)
  })

  it('nunca sai do SVG com larguras de 300 a 560 px nem com séries de 1 a 45 dias', () => {
    for (const w of [300, 334, 360, 390, 430, 520, 559]) {
      for (const n of [1, 2, 8, 21, 30, 45]) {
        largura = w
        const { container, unmount } = montar(serie(Array.from({ length: n }, (_, i) => diaCom(i, 20 + i, 2))))
        const W = num(svg(), 'width')
        for (const t of container.querySelectorAll('text.ic-ax-x')) {
          const meia = (t.textContent ?? '').length * 7.2 / 2
          expect(num(t, 'x') + meia, `${w}px ${n} dias`).toBeLessThanOrEqual(W)
          expect(num(t, 'x') - meia, `${w}px ${n} dias`).toBeGreaterThanOrEqual(0)
        }
        unmount()
      }
    }
  })
})

describe('13.2: o mesmo gráfico desenha "Views por dia" (sem faixa de cliques)', () => {
  const V = { unidade: 'views' as const }
  const viewsDias = (): DiaAlcance[] => [diaCom(0, 1100, null), diaCom(1, 39, null), diaZero(2), diaNm(3), diaCom(4, 1, null)]

  it('escopo views: sem faixa, sem ponto, sem número de clique, altura de desenho menor; a anotação do eixo diz "views"', () => {
    const imp = montar(serie(viewsDias()))
    const alturaImp = num(svg(), 'height')
    cleanup()
    const { container } = montar(serie(viewsDias(), V), 'Views por dia, soma dos vídeos')
    expect(container.querySelector('rect.ic-strip, text.ic-stl, circle.ic-dot, text.ic-cln, rect.ic-nm-cl')).toBeNull()
    expect(container.querySelector('text.ic-an')!.textContent).toBe('views')
    expect(num(svg(), 'height')).toBeLessThan(alturaImp - 40)
    void imp
  })

  it('os três estados seguem com forma própria: barra cheia, caixa vazada e coluna hachurada (uma só, sem a faixa)', () => {
    const { container } = montar(serie(viewsDias(), V))
    const g = (s: string) => container.querySelectorAll(`g[data-situacao="${s}"]`)
    expect(g('com-impressoes')).toHaveLength(3)
    expect(g('zero-medido')).toHaveLength(1)
    expect(g('nao-medido')).toHaveLength(1)
    expect(g('zero-medido')[0]!.querySelector('rect.ic-zero')!.getAttribute('fill')).toBe('none')
    expect(g('nao-medido')[0]!.querySelectorAll('rect.ic-nm')).toHaveLength(1)
    expect(g('nao-medido')[0]!.querySelector('rect.ic-nm')!.getAttribute('fill')).toMatch(/^url\(#/)
    expect([...container.querySelectorAll('text.ic-val')].map(t => t.textContent)).toContain('1.100')
  })

  it('a legenda e a tabela falam de views (e não de relatório, impressão ou clique)', async () => {
    const user = userEvent.setup()
    const { container } = montar(serie(viewsDias(), V), 'Views por dia, soma dos vídeos')
    expect([...container.querySelectorAll('.ic-lg')].map(i => i.textContent)).toEqual([
      'views do dia (barra cheia)', 'zero medido (caixa vazada): o YouTube registrou nenhuma view', 'não medido (hachura): o YouTube não entregou o dia',
    ])
    await user.click(within(container.querySelector('details')!).getByText('Ver como tabela'))
    expect([...container.querySelectorAll('thead th')].map(t => t.textContent)).toEqual(['Dia', 'Views', 'Situação do dia'])
    const nm = container.querySelector('tr[data-situacao="nao-medido"]')!
    expect([...nm.querySelectorAll('td')].map(t => t.textContent)).toEqual(['não medido', 'o YouTube não entregou o dia: não medido'])
    expect(container.textContent).not.toMatch(/relatório|impressõ|clique/i)
  })

  it('os botões, as setas e a frase do dia funcionam do mesmo jeito em views', async () => {
    const user = userEvent.setup()
    const v = serie(viewsDias(), V)
    const { container } = montar(v)
    await user.click(screen.getByRole('button', { name: 'Dia seguinte' }))
    expect(container.querySelector('[role="status"]')!.textContent).toBe('01/09: 1.100 views')
    await user.click(screen.getByRole('button', { name: 'Dia seguinte' })); await user.click(screen.getByRole('button', { name: 'Dia seguinte' }))
    expect(container.querySelector('[role="status"]')!.textContent).toBe('03/09: o YouTube registrou nenhuma view')
  })

  it('coleta parada: o aviso de views fala de views, nunca de relatórios', () => {
    const dias = viewsDias()
    const v = serie(dias, { ...V, hoje: addDays('2026-09-05', 9) })
    expect(v.avisos).toContain('A coleta de views parou em 05/09.')
    expect(v.avisos.join(' ')).not.toMatch(/relatório/)
    expect(serie(dias, { ...V, hoje: '2026-09-06' }).avisos.join(' ')).not.toMatch(/parou/)
  })

  it('a última data também cabe a 390 px em views', () => {
    largura = 390
    const dias = Array.from({ length: 28 }, (_, i) => diaCom(i, 10 + i, null))
    const { container } = montar(serie(dias, V))
    const W = num(svg(), 'width')
    const rot = [...container.querySelectorAll('text.ic-ax-x')]
    expect(num(rot[rot.length - 1]!, 'x') + 18).toBeLessThanOrEqual(W)
  })
})

describe('13.2: o dia da publicação', () => {
  it('uma linha tracejada na coluna do dia e o item da legenda, só quando o dia está no período', () => {
    const dias = Array.from({ length: 10 }, (_, i) => diaCom(i, 10 + i, 1))
    const { container } = montar(serie(dias, { publicadoEm: addDays('2026-09-01', 4) }))
    const linhas = container.querySelectorAll('line.ic-pub')
    expect(linhas).toHaveLength(1)
    const h = hit(4)
    expect(num(linhas[0]!, 'x1')).toBeCloseTo(num(h, 'x') + num(h, 'width') / 2, 3)
    expect([...container.querySelectorAll('.ic-lg')].map(i => i.textContent)).toContain('dia da publicação')
    expect(container.querySelector('.ic-sw.pub')).not.toBeNull()
    cleanup()
    const { container: c2 } = montar(serie(dias, { publicadoEm: '2020-01-01' }))
    expect(c2.querySelector('line.ic-pub')).toBeNull()
    expect([...c2.querySelectorAll('.ic-lg')].map(i => i.textContent)).not.toContain('dia da publicação')
  })
})

describe('13.2: regras do CSS do desenho aprovado', () => {
  const dir = path.join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors')
  const css = fs.readFileSync(path.join(dir, '_proprio/impressoes.css'), 'utf8')
  const tokens = fs.readFileSync(path.join(dir, '_chrome/tokens-telas.css'), 'utf8')

  it('cliques estimados: marca clara neutra no escuro e escura no claro, nunca mais o azul', () => {
    expect(tokens).toMatch(/--im-cl:#F5EFE6/)
    expect(tokens).toMatch(/\[data-theme="light"\] \[data-obs\]\{[^}]*--im-cl:#231C14/)
    expect(tokens).not.toMatch(/#38BDF8/i)
    expect(css).not.toMatch(/#38BDF8|#0B6BA8/i)
    expect(css).not.toMatch(/--ic-cl:#/)       // a cor vem do token nos dois temas
  })

  it('botões do passo com 44 x 44 px fixos (não só no toque) e a região do dia com 44 px de altura mínima', () => {
    expect(css).toMatch(/\.ic-step button\{[^}]*width:44px[^}]*height:44px/)
    expect(css).toMatch(/\.ic-out\{[^}]*min-height:44px/)
    expect(css).toMatch(/\.ic-step\{[^}]*grid-template-columns:44px minmax\(0,1fr\) 44px/)
  })

  it('a ajuda de mouse só aparece com hover e tela larga; a de toque no resto', () => {
    expect(css).toMatch(/\.ic-out-m\{display:none\}/)
    expect(css).toMatch(/@media \(min-width:901px\) and \(hover:hover\)\{[^}]*\.ic-out-m\{display:inline\}[^}]*\.ic-out-t\{display:none\}/)
  })

  it('o botão no limite não some nem usa cor sozinha (aria-disabled, cursor, opacidade e cor do token)', () => {
    expect(css).toMatch(/\.ic-step button\[aria-disabled="true"\]\{[^}]*cursor:not-allowed/)
    expect(css).toMatch(/\.ic-step button\[aria-disabled="true"\]\{[^}]*opacity:\.7/)
    expect(css).toMatch(/\.ic-step button\[aria-disabled="true"\]\{[^}]*color:var\(--dim\)/)
  })

  it('a faixa, o rótulo e a linha da publicação usam só token (sem color-mix, sem z-index, texto >= 12 px)', () => {
    expect(css).toMatch(/\.ic-strip\{/)
    expect(css).toMatch(/\.ic-stl\{/)
    expect(css).toMatch(/\.ic-pub\{/)
    expect(css).not.toMatch(/color-mix\(/)
    expect(css).not.toMatch(/z-index\s*:\s*-?\d/)
  })

  it('a caixa do desenho não estoura a coluna de 390 px (o contêiner rola por dentro) e o ⓘ tem alvo de 44 px no toque', () => {
    expect(css).toMatch(/\.ic-sc\{[^}]*overflow-x:auto/)
    expect(css).toMatch(/@media \(pointer:coarse\)\{[^}]*\.ic-info\{width:44px;height:44px;margin:-10px 0\}/)
  })
})

// ---------------------------------------------------------------------------------------------------------------------------------
// A4 Tarefa 13.2, ondas de consertos da revisão (I1 a I5 e M1, M4, M5): nada cobre texto; "não medido" é o bloco do mockup; Tab até o botão guarda o dia.
// ---------------------------------------------------------------------------------------------------------------------------------
const ordem = (a: Node, b: Node): 'antes' | 'depois' => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? 'antes' : 'depois')
const status = (c: ParentNode = document) => c.querySelector<HTMLElement>('[role="status"]')!
const T_TOPO = 30   // o espaço dos números em cima da barra mais alta (constante T do componente)

describe('13.2 consertos: o não medido é o bloco do mockup aprovado (I4)', () => {
  it('um bloco de até 24 px assentado na base, na largura da barra; nunca a coluna inteira; cor só por token do kit (hachura)', () => {
    const { container } = montar(serie([diaCom(0, 90, 4), diaNm(1), diaCom(2, 50, 2)]))
    const g = container.querySelector('g[data-situacao="nao-medido"]')!
    const [bloco, faixa] = [...g.querySelectorAll('rect.ic-nm')]
    const base = T_TOPO + 180
    expect(num(bloco!, 'height')).toBe(24)
    expect(num(bloco!, 'y') + num(bloco!, 'height')).toBe(base)
    expect(num(bloco!, 'y')).toBeGreaterThan(T_TOPO)   // não começa no topo da área
    expect(bloco!.getAttribute('fill')).toMatch(/^url\(#/)
    // a largura é a da barra do vizinho (a coluna hachurada não vira uma faixa mais larga que a barra)
    const barra = container.querySelector('rect.ic-bar')!
    expect(num(bloco!, 'width')).toBeCloseTo(num(barra, 'width'), 3)
    // a faixa de cliques segue hachurada (não medido nunca vira vazio)
    expect(num(faixa!, 'y')).toBeGreaterThan(base)
  })

  it('numa área baixa o bloco é 25% dela (o mesmo arredondamento do mockup: round(min(24, altura * 0,25)))', () => {
    const { container } = montar(serie([diaCom(0, 90, null), diaNm(1)], { alturaArea: 60, unidade: 'views' }))
    expect(num(container.querySelector('g[data-situacao="nao-medido"] rect.ic-nm')!, 'height')).toBe(15)
  })

  it('só o dia escolhido ganha a linha pontilhada que sobe do bloco até o topo da área', () => {
    const { container } = montar(serie([diaCom(0, 90, 4), diaNm(1), diaCom(2, 50, 2)]))
    expect(container.querySelector('line.ic-nmlin')).toBeNull()
    fireEvent.pointerMove(hit(1), { pointerType: 'mouse' })
    const l = container.querySelector('line.ic-nmlin')!
    expect(l).not.toBeNull()
    expect(num(l, 'y1')).toBe(T_TOPO)
    expect(num(l, 'y2')).toBe(T_TOPO + 180 - 24)
    fireEvent.pointerMove(hit(0), { pointerType: 'mouse' })
    expect(container.querySelector('line.ic-nmlin')).toBeNull()
  })

  it('a hachura tem as cores do mockup nos dois temas, em token literal (fundo --nm-bg, linha --nm, 1,6 px)', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_proprio/impressoes.css'), 'utf8')
    const tokens = fs.readFileSync(path.join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_chrome/tokens-telas.css'), 'utf8')
    expect(css).toMatch(/\.ic-hb\{fill:var\(--nm-bg\)\}/)
    expect(css).toMatch(/\.ic-hl\{stroke:var\(--nm\);stroke-width:1\.6\}/)
    expect(css).toMatch(/\.ic-nmlin\{[^}]*stroke:var\(--nm-line\)[^}]*stroke-dasharray:2 3/)
    expect(tokens).toMatch(/--nm:#E59CC0;--nm-line:#B0678F;--nm-bg:#3A2232/)
    expect(tokens).toMatch(/\[data-theme="light"\] \[data-obs\]\{--nm:#8E2A62;--nm-line:#A85585;--nm-bg:#F7E1EC[;}]/)
    expect(css).not.toMatch(/color-mix\(/)
  })
})

describe('13.2 consertos: nada pode cobrir texto (I1, I2) e a linha da publicação não cruza o rótulo (I5)', () => {
  /** Poucos dias medidos entre muitos não medidos, rótulos de 4 dígitos ("1.234") e cliques de 4 dígitos ("1.139"): o caso real do dono. */
  const real = (): DiaAlcance[] => Array.from({ length: 30 }, (_, i) => (i === 3 || i === 9 ? diaCom(i, 1234 + i, 1139) : i === 15 ? diaCom(i, 40, 25) : i === 20 ? diaCom(i, 31, null) : diaNm(i)))

  it('a camada final: todo ponto, número de clique e rótulo de valor vem DEPOIS de qualquer barra, caixa e hachura', () => {
    largura = 390
    const { container } = montar(serie(real()))
    const topos = [...container.querySelectorAll('text.ic-val, text.ic-cln, circle.ic-dot')]
    const baixos = [...container.querySelectorAll('rect.ic-bar, rect.ic-zero, rect.ic-nm, rect.ic-nm-cl, rect.ic-strip')]
    expect(topos.length).toBeGreaterThan(4)
    expect(baixos.length).toBeGreaterThan(30)
    for (const t of topos) for (const b of baixos) expect(ordem(b, t), `${t.getAttribute('class')} deve vir depois de ${b.getAttribute('class')}`).toBe('antes')
  })

  it('cada rótulo e cada número de clique tem a caixa livre: nenhum retângulo ou ponto desenhado depois cai em cima dele (390 px, rótulos de 2 dígitos ou mais)', () => {
    largura = 390
    const { container } = montar(serie(real()))
    const caixa = (t: Element) => { const w = (t.textContent ?? '').length * 7.4, x = num(t, 'x'), y = num(t, 'y'); return { x0: x - w / 2, x1: x + w / 2, y0: y - 12, y1: y + 3 } }
    const textos = [...container.querySelectorAll('text.ic-val, text.ic-cln')]
    expect(textos.length).toBeGreaterThanOrEqual(4)
    expect(textos.some(t => (t.textContent ?? '').length >= 2)).toBe(true)
    const depois = (t: Element) => [...container.querySelectorAll('svg.ic-svg rect:not(.ic-hit), svg.ic-svg circle')].filter(e => ordem(t, e) === 'antes' && !e.closest('pattern'))
    for (const t of textos) {
      const c = caixa(t)
      for (const e of depois(t)) {
        const b = e.tagName === 'circle'
          ? { x0: num(e, 'cx') - num(e, 'r'), x1: num(e, 'cx') + num(e, 'r'), y0: num(e, 'cy') - num(e, 'r'), y1: num(e, 'cy') + num(e, 'r') }
          : { x0: num(e, 'x'), x1: num(e, 'x') + num(e, 'width'), y0: num(e, 'y'), y1: num(e, 'y') + num(e, 'height') }
        const cruza = c.x0 < b.x1 && c.x1 > b.x0 && c.y0 < b.y1 && c.y1 > b.y0
        expect(cruza, `"${t.textContent}" (${t.getAttribute('class')}) coberto por ${e.getAttribute('class')}`).toBe(false)
      }
    }
  })

  it('o número da faixa ("1.139") não é coberto pela hachura do dia seguinte, mesmo largo', () => {
    largura = 390
    const dias = [diaCom(0, 9000, 1139), diaNm(1), diaCom(2, 9000, 1139), diaCom(3, 9000, null), diaNm(4)]
    const { container } = montar(serie(dias))
    const n = [...container.querySelectorAll('text.ic-cln')].find(t => t.textContent === '1.139')!
    expect(n).toBeDefined()
    for (const h of container.querySelectorAll('rect.ic-nm, rect.ic-nm-cl')) expect(ordem(n, h)).toBe('depois')
  })

  it('a linha da publicação vem ANTES da barra e do rótulo da própria coluna, e o rótulo ganha um halo literal nos dois temas', () => {
    const dias = Array.from({ length: 10 }, (_, i) => diaCom(i, 100 + i * 10, 3))
    const { container } = montar(serie(dias, { publicadoEm: addDays('2026-09-01', 0) }))
    const linha = container.querySelector('line.ic-pub')!
    const barra = container.querySelector('g[data-situacao] rect.ic-bar')!
    const rotulo = container.querySelector('text.ic-val')!
    expect(ordem(linha, barra)).toBe('antes')
    expect(ordem(linha, rotulo)).toBe('antes')
    const css = fs.readFileSync(path.join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_proprio/impressoes.css'), 'utf8')
    expect(css).toMatch(/\.ic-val\{[^}]*paint-order:stroke[^}]*stroke:var\(--ic-halo\)/)
    expect(css).toMatch(/\.ic\{[^}]*--ic-halo:#[0-9A-Fa-f]{6}/)
    expect(css).toMatch(/\[data-theme="light"\] \.ic\{[^}]*--ic-halo:#[0-9A-Fa-f]{6}/)
    expect(css).toMatch(/\.ic-cln\{[^}]*paint-order:stroke/)
    expect(css).not.toMatch(/color-mix\(/)
  })
})

describe('13.2 consertos: Tab do gráfico até os botões de passo guarda o dia (I3)', () => {
  it('Tab do gráfico para "Dia seguinte" não zera o dia: o botão continua do dia seguinte, não do primeiro', async () => {
    const user = userEvent.setup()
    const v = cheio()
    const { container } = montar(v)
    await user.tab(); await user.tab()                 // ⓘ, depois o gráfico
    expect(document.activeElement).toBe(grupo(container))
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(status(container).textContent).toBe(v.colunas[3]!.dica)
    await user.tab()                                   // "Dia anterior"
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Dia anterior' }))
    expect(status(container).textContent).toBe(v.colunas[3]!.dica)   // o dia não foi apagado nem a ajuda voltou à região viva
    await user.tab()                                   // "Dia seguinte"
    await user.keyboard('{Enter}')
    expect(status(container).textContent).toBe(v.colunas[4]!.dica)
    await user.keyboard('{Enter}')
    expect(status(container).textContent).toBe(v.colunas[5]!.dica)
  })

  it('e a volta (Shift+Tab até o gráfico) retoma o mesmo dia; sair de verdade (para o ⓘ) ainda zera', async () => {
    const user = userEvent.setup()
    const v = cheio()
    const { container } = montar(v)
    await user.tab(); await user.tab()
    await user.keyboard('{End}')
    await user.tab()
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(grupo(container))
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[v.colunas.length - 1]!.dica])
    await user.tab({ shift: true })                    // ⓘ: fora dos botões de passo
    expect(tips()).toHaveLength(0)
    expect(status(container).textContent).toContain('Use os botões para ler um dia de cada vez.')
    await user.tab()
    expect(tips().map(t => t.textContent)).toEqual([v.colunas[0]!.dica])
  })
})

describe('13.2 consertos: dia com impressão sem valor (M1) e frases de views (M4, M5)', () => {
  it('um dia "com impressões" sem valor (imp nulo) é NÃO MEDIDO, nunca uma barra mínima com "0" (impressões e views)', () => {
    for (const unidade of ['impressoes', 'views'] as const) {
      const sem: DiaAlcance = { dia: '2026-10-02', situacao: 'com-impressoes', motivo: null, imp: null, cliques: null }
      const v = buildImpressoes([dia0('2026-10-01', 9), sem], { de: '2026-10-01', ate: '2026-10-02', dias: 2 }, { ...O, unidade })
      const c = v.colunas[1]!
      expect(c.situacao).toBe('nao-medido')
      expect(c.imp).toBeNull()
      expect(c.cliques).toBeNull()
      expect(c.alturaPx).toBe(180)
      expect(c.dica).toMatch(/não medido|relatório ainda não baixado/)
      expect(c.dica).not.toMatch(/\b0\b/)
      expect(v.resumo).not.toMatch(/2 dias/)   // o dia sem valor não entra nos dias medidos
    }
  })

  it('na tela, esse dia vira coluna hachurada e a tabela diz "não medido" (nunca "0")', () => {
    const sem: DiaAlcance = { dia: addDays('2026-09-01', 1), situacao: 'com-impressoes', motivo: null, imp: null, cliques: null }
    const { container } = montar(serie([diaCom(0, 9, 1), sem], { unidade: 'views' }))
    expect(container.querySelectorAll('g[data-situacao="nao-medido"]')).toHaveLength(1)
    expect(container.querySelectorAll('rect.ic-bar')).toHaveLength(1)
  })

  it('M5: views com publicadoEm: a dica do dia da publicação, a linha e o item da legenda aparecem na tela', async () => {
    const dias = Array.from({ length: 6 }, (_, i) => diaCom(i, 10 + i, null))
    const { container } = montar(serie(dias, { unidade: 'views', publicadoEm: addDays('2026-09-01', 2) }), 'Views por dia deste vídeo')
    expect(container.querySelectorAll('line.ic-pub')).toHaveLength(1)
    fireEvent.pointerMove(hit(2), { pointerType: 'mouse' })
    expect(tips().map(t => t.textContent)).toEqual(['03/09: 12 views. Dia da publicação do vídeo'])
    expect([...container.querySelectorAll('.ic-lg')].map(i => i.textContent)).toContain('dia da publicação')
  })
})

const dia0 = (d: string, imp: number): DiaAlcance => ({ dia: d as DiaAlcance['dia'], situacao: 'com-impressoes', motivo: null, imp, cliques: 1 })

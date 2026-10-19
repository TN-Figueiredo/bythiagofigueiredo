// @vitest-environment jsdom
// A nota do ritmo na tela (mockup de 19/10): sufixo "· sobre N d" e ⓘ na lista, no cabeçalho do canal e no Comparar; a faixa "fora do
// período" diferente do zero; "—" no canal novo; textos de 13 semanas ligados à base real. Dado sintético.
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { a3World } from './a3-fixture'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CadenceView, Strip, algumaNotaDoRitmo } from '@/app/cms/(authed)/youtube/competitors/_canais/cells'
import type { CadenceCell } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CelulasDoCabecalho } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/celulas'
import type { CelulaDoCabecalho } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/cabecalho-model'
import { numerosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import { notaDoRitmo } from '@/lib/youtube/observatorio/ritmo-nota'
import { baseDoRitmoTexto } from '@/lib/youtube/observatorio/channels'
import { readFileSync } from 'node:fs'

const DAY = 86_400_000
const CH = 'leo-khev'
// canal criado há `dias`: nenhum vídeo guardado é mais velho que o canal (a criação posterior ao vídeo mais antigo perde para ele)
const mundo = (dias: number | null) => a3World(ds => {
  if (dias === null) return
  ds.channels.find(c => c.id === CH)!.createdMs = ds.now - dias * DAY
  ds.videos = ds.videos.filter(v => v.ch !== CH || v.ageDays <= dias)
})
const celula = (obs: ReturnType<typeof a3World>['obs'], id = CH) => {
  const v = buildCanaisView(obs, { niche: 'todos', limit: 75, fmt: 'longos' })
  const r = [...v.list.ranked, ...v.list.unranked].find(x => x.id === id)!
  return r.cells.cadence
}

beforeEach(() => { cleanup() })

describe('nota do ritmo: o modelo', () => {
  it('canal de 81 dias: sufixo "· sobre 81 d" e causa de criação; a base cheia não tem nota', () => {
    const c = celula(mundo(81).obs)
    expect(c.kind).toBe('ok')
    if (c.kind !== 'ok') return
    expect(c.nota).toMatchObject({ tipo: 'base', sufixo: '· sobre 81 d', corte: 'criacao' })
    expect(c.nota!.causa).toContain('81 dias')
    const cheio = celula(mundo(null).obs)
    expect(cheio.kind === 'ok' && cheio.nota).toBeNull()
  })
  it('canal novo (18 dias): estado "não medido", sem número, e a nota de piso', () => {
    const c = celula(mundo(18).obs)
    if (c.kind !== 'ok') throw new Error('esperava ok')
    expect(c.pw).toBe('—')
    expect(c.nota).toMatchObject({ tipo: 'piso', sufixo: 'canal com menos de 4 sem' })
  })
  it('as semanas antes da criação chegam como null (fora do período), não como zero', () => {
    const c = celula(mundo(30).obs)
    if (c.kind !== 'ok') throw new Error('esperava ok')
    expect(c.weeks[0]).toEqual({ long: null, short: null })
    expect(c.weeks.at(-1)!.long).not.toBeNull()
  })
  it('a segunda medida de "Todos" não repete a nota', () => {
    const w = mundo(81)
    const v = buildCanaisView(w.obs, { niche: 'todos', limit: 75, fmt: 'todos' })
    const r = [...v.list.ranked, ...v.list.unranked].find(x => x.id === CH)!
    expect(r.cells.cadence2 && r.cells.cadence2.kind === 'ok' && r.cells.cadence2.nota).toBeNull()
  })
})

describe('nota do ritmo: textos com a base real (sem "13 semanas" fixas)', () => {
  it('"nenhum em ..." e o rótulo do cabeçalho do painel dizem a base do canal', () => {
    const w = a3World(ds => {
      ds.channels.find(c => c.id === CH)!.createdMs = ds.now - 81 * DAY
      ds.videos = ds.videos.filter(v => v.ch !== CH)
    })
    const v = buildCanaisView(w.obs, { niche: 'todos', limit: 75, fmt: 'longos' })
    const r = [...v.list.ranked, ...v.list.unranked].find(x => x.id === CH)
    const c = r?.cells.cadence
    if (c && c.kind === 'ok' && c.sub) expect(c.sub).not.toContain('13 semanas')
    const kl = w.obs.cadence(CH, 'long')
    expect(baseDoRitmoTexto(kl, 13).periodo).toBe('81 dias, desde a criação')
    expect(baseDoRitmoTexto(kl, 13).curto).toBe('81 d')
    expect(baseDoRitmoTexto({ corte: null, diasBase: 91 }, 13).curto).toBe('13 sem')
  })
  it('o texto fixo saiu do view-model', () => {
    const src = readFileSync('src/app/cms/(authed)/youtube/competitors/_canais/view-model.ts', 'utf8')
    expect(src).not.toMatch(/Ritmo, 13\$\{NB\}sem/)
    expect(src).not.toContain("'nenhum em 13 semanas'")
    expect(src).not.toContain('TODO Logan')
  })
})

const ok = (nota: CadenceCell extends infer T ? (T extends { kind: 'ok' } ? T['nota'] : never) : never, weeks: Array<{ long: number | null; short: number | null }>): CadenceCell =>
  ({ kind: 'ok', weeks, nota, label: '2 vídeos longos e 0 Shorts em 81 dias', pw: '0,4', unit: 'longos/sem', sub: null, paused: null })
const FORA = { long: null, short: null }
const SEMANAS = [FORA, { long: 0, short: 0 }, { long: 1, short: 0 }, ...Array.from({ length: 10 }, () => ({ long: 0, short: 0 }))] as Array<{ long: number | null; short: number | null }>
const nota81 = notaDoRitmo({ corte: 'criacao', dias: 81, abaixoDoPiso: false, semanasDaRegra: 13 })

describe('nota do ritmo: a lista', () => {
  it('o sufixo âmbar e o ⓘ aparecem; o número fica fora da nota; o ⓘ abre por clique e fecha por Esc', () => {
    render(<CadenceView c={ok(nota81, SEMANAS)} />)
    const t = document.querySelector('.obs-nr-t')!
    expect(t.textContent).toBe('· sobre 81 d')
    expect(document.querySelector('[data-k="pw"]')!.textContent).toBe('0,4')
    expect(document.querySelector('[data-k="pw"]')!.closest('.obs-nr')).toBeNull()
    const b = screen.getByRole('button', { name: /Ritmo sobre 81 dias/ })
    expect(b.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(b)
    expect(b.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('.obs-nr-p')!.hasAttribute('hidden')).toBe(false)
    fireEvent.keyDown(b, { key: 'Escape' })
    expect(b.getAttribute('aria-expanded')).toBe('false')
  })
  it('canal novo: "—" de não medido e "canal com menos de 4 sem", sem número nem unidade', () => {
    const piso = notaDoRitmo({ corte: 'criacao', dias: 18, abaixoDoPiso: true, semanasDaRegra: 13 })
    render(<CadenceView c={{ ...ok(piso, SEMANAS), pw: '—' }} />)
    const nm = document.querySelector('[data-k="pw"]')!
    expect(nm.textContent).toBe('—')
    expect(nm.getAttribute('aria-label')).toBe('não medido')
    expect(document.querySelector('.obs-nr-t')!.textContent).toBe('canal com menos de 4 sem')
    expect(document.querySelector('.u')).toBeNull()
  })
  it('a coluna do sufixo só é reservada quando alguma linha à vista tem nota', () => {
    const sem = ok(null, SEMANAS)
    const { rerender } = render(<CadenceView c={sem} reservar={false} />)
    expect(document.querySelector('.obs-nr')).toBeNull()
    rerender(<CadenceView c={sem} reservar />)
    expect(document.querySelector('.obs-nr.ph')).not.toBeNull()
    expect(algumaNotaDoRitmo([{ cells: { cadence: sem } }])).toBe(false)
    expect(algumaNotaDoRitmo([{ cells: { cadence: sem } }, { cells: { cadence: ok(nota81, SEMANAS) } }])).toBe(true)
  })
})

describe('nota do ritmo: o gráfico', () => {
  it('uma faixa tracejada para as semanas consecutivas fora do período, de forma diferente do zero', () => {
    const w = [FORA, FORA, { long: 0, short: 0 }, { long: 1, short: 0 }, ...Array.from({ length: 9 }, () => ({ long: 0, short: 0 }))] as Array<{ long: number | null; short: number | null }>
    const { container } = render(<Strip cell={ok(nota81, w)} />)
    const fora = container.querySelectorAll('rect[data-fora]')
    expect(fora).toHaveLength(1)
    expect(fora[0]!.getAttribute('stroke')).toBe('var(--out-line)')
    expect(fora[0]!.getAttribute('stroke-dasharray')).toBeTruthy()
    expect(Number(fora[0]!.getAttribute('width'))).toBeGreaterThan(10) // cobre as duas semanas
    expect(Number(fora[0]!.getAttribute('height'))).toBeGreaterThan(20) // altura cheia
    const zero = container.querySelector('rect[data-zero]')!
    expect(zero.getAttribute('height')).toBe('2') // traço de 2 px
    expect(zero.getAttribute('stroke-dasharray')).toBeNull()
    expect(container.querySelector('svg')!.getAttribute('aria-label')).toContain('2 semanas fora do período')
  })
  it('sem semana fora do período não há faixa nem definição de hachura', () => {
    const { container } = render(<Strip cell={ok(null, SEMANAS.map(s => (s.long === null ? { long: 0, short: 0 } : s)))} />)
    expect(container.querySelector('rect[data-fora]')).toBeNull()
    expect(container.querySelector('pattern')).toBeNull()
  })
  it('o token --out-line existe nos dois temas e o Shorts claro passa a #8F5A16', () => {
    const css = readFileSync('src/app/cms/(authed)/youtube/competitors/_canais/canais.css', 'utf8')
    expect(css.match(/--out-line:/g)).toHaveLength(2)
    expect(css).toContain('--strip-short:#8F5A16')
    expect(css).not.toContain('#A86E22')
  })
})

describe('nota do ritmo: o cabeçalho do canal', () => {
  const cel = (nota: ReturnType<typeof notaDoRitmo>, valor: 'medido' | 'nao_medido'): CelulaDoCabecalho =>
    ({ chave: 'ritmo', rotulo: 'Ritmo', valor, base: 'base', motivo: null, detalhe: { chave: 'ritmo', porSemana: valor === 'medido' ? '0,4' : '', nota } }) as CelulaDoCabecalho
  it('mede sobre 81 dias: número + "por semana" + sufixo e ⓘ', () => {
    render(<dl><CelulasDoCabecalho celulas={[cel(nota81, 'medido')]} /></dl>)
    expect(document.querySelector('.v .num')!.textContent).toBe('0,4')
    expect(document.querySelector('.obs-nr-t')!.textContent).toBe('· sobre 81 d')
    expect(document.querySelector('.obs-nr-i')).not.toBeNull()
  })
  it('canal novo: "—" e "canal com menos de 4 sem"', () => {
    render(<dl><CelulasDoCabecalho celulas={[cel(notaDoRitmo({ corte: 'criacao', dias: null, abaixoDoPiso: true, semanasDaRegra: 13 }), 'nao_medido')]} /></dl>)
    expect(document.querySelector('.obs-ch-nm')!.textContent).toBe('—')
    expect(document.querySelector('.obs-nr-t')!.textContent).toBe('canal com menos de 4 sem')
  })
  it('sem nota, a célula é a de antes', () => {
    render(<dl><CelulasDoCabecalho celulas={[cel(null, 'medido')]} /></dl>)
    expect(document.querySelector('.obs-nr')).toBeNull()
  })
})

describe('nota do ritmo: o Comparar', () => {
  it('canal de 81 dias: o número do ritmo leva a nota; canal de base cheia, não', () => {
    const n = numerosDoCanal(mundo(81).obs, CH).ritmo
    expect(n.x).not.toBeNull()
    expect(n.ritmoNota).toMatchObject({ tipo: 'base', sufixo: '· sobre 81 d' })
    expect(numerosDoCanal(mundo(null).obs, CH).ritmo.ritmoNota).toBeUndefined()
  })
  it('canal novo: não medido, com a frase curta e a nota de piso', () => {
    const n = numerosDoCanal(mundo(18).obs, CH).ritmo
    expect(n.x).toBeNull()
    expect(n.motivo).toBe('canal com menos de 4 sem')
    expect(n.ritmoNota).toMatchObject({ tipo: 'piso' })
  })
})

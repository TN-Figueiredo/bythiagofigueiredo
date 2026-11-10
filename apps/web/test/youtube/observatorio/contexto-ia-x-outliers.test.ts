// @vitest-environment node
/**
 * A5 F0.5a-T2: o `x` na origem da tela Destaques (outliers). Mesmas provas da T1 (Canais): (1) toda célula medida tem x, (2) o formatador da unidade
 * da coluna aplicado a x dá o texto, (3) x é o número do modelo, (4) chaves; mais o motivo do "sem número" (views/dia que a tela escreve em palavras).
 */
import { describe, it, expect } from 'vitest'
import { casosDeOutliers, OBS_DAS_TELAS as OBS } from './contexto-ia-x-telas-fixture'
import { medidas, semX } from './contexto-ia-x-fixture'
import { empacotarOutliers } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-outliers'

const CASOS = casosDeOutliers()
const F = OBS.fmt
const nb = (s: string) => s.replace(/ /g, ' ')
type Cel = { texto: string; x?: number | null; semXMotivo?: string }

describe('outliers: toda célula medida tem x finito (1)', () => {
  it.each(CASOS.map((c) => [c.nome, c] as const))('%s', (_n, caso) => {
    const faltam = medidas(caso.pacote).filter(({ c }) => !semX(c) && !(c.papel === 'numero' && 'x' in c && typeof c.x === 'number' && Number.isFinite(c.x))).map((m) => `${m.caminho}: x ${String((m.c as { x?: unknown }).x)}`)
    expect(faltam, 'células medidas sem x').toEqual([])
  })
})

describe('outliers: o formatador da unidade da coluna aplicado a x dá o texto (2)', () => {
  const FORMATADOR: Record<string, (x: number) => string> = {
    'idades/Outliers': (x) => String(x),
    'grupos/Outliers': (x) => String(x),
    'outliers/Múltiplo': (x) => F.mult(x),
    'outliers/Views': (x) => F.num(x),
    'outliers/Views/dia (7 dias)': (x) => F.num(x),
    'outliers-reuso/Views/dia (7 dias)': (x) => F.num(x),
    'outliers-reuso/Mediana do canal (views/dia)': (x) => F.num(x),
  }
  it.each(CASOS.map((c) => [c.nome, c] as const))('%s: cada coluna numérica tem formatador e o x reescreve o texto', (_n, caso) => {
    const sem: string[] = [], erradas: string[] = []
    for (const m of medidas(caso.pacote)) {
      const c = m.c as Cel
      const f = FORMATADOR[`${m.tabela}/${m.coluna}`]
      if (!f) { sem.push(m.caminho); continue }
      if (typeof c.x !== 'number') continue
      if (nb(c.texto) !== nb(f(c.x))) erradas.push(`${m.caminho}: texto "${c.texto}" ≠ f(x=${c.x}) "${f(c.x)}"`)
    }
    expect(sem, 'coluna numérica sem formatador no teste').toEqual([])
    expect(erradas).toEqual([])
  })
  it('o teste não passa vazio: a matriz confere centenas de células de Múltiplo, Views e Views/dia', () => {
    const n = (col: string) => CASOS.reduce((s, c) => s + medidas(c.pacote).filter((m) => `${m.tabela}/${m.coluna}` === col && typeof (m.c as Cel).x === 'number').length, 0)
    expect(n('outliers/Múltiplo')).toBeGreaterThan(100)
    expect(n('outliers/Views')).toBeGreaterThan(100)
    expect(n('outliers/Views/dia (7 dias)')).toBeGreaterThan(50)
    expect(n('outliers-reuso/Views/dia (7 dias)')).toBeGreaterThan(0)
    expect(n('outliers-reuso/Mediana do canal (views/dia)')).toBeGreaterThan(0)
    expect(n('idades/Outliers')).toBeGreaterThan(10)
    expect(n('grupos/Outliers')).toBeGreaterThan(0)
  })
  it('(2b) múltiplo "4,2×" → x === 4.2 e views "15,2 mil" vêm do inteiro do modelo, não do texto', () => {
    const caso = casosDeOutliers().find((c) => c.nome === 'padrão')!
    const card = caso.modelo.groups.flatMap((g) => g.cards)[0]!
    ;(card as { mult: string; multN: number | null }).mult = '4,2×'
    ;(card as { multN: number | null }).multN = 4.2
    const t = empacotarOutliers(caso.modelo).tabelas.find((x) => x.id === 'outliers')!
    const lin = t.linhas[0]! as unknown as Cel[]
    expect(lin[4]).toMatchObject({ texto: '4,2×', x: 4.2 })
    expect(Number.isInteger((lin[6] as Cel).x)).toBe(true)
  })
})

describe('outliers: x é o número do modelo (3)', () => {
  it('Múltiplo === multN do cartão; Views === views do vídeo; Views/dia === vpd7 (ou a média, sem 7 dias); contagens === as do modelo', () => {
    let vistos = { mult: 0, views: 0, vpd: 0, cont: 0 }
    for (const caso of CASOS) {
      const m = caso.modelo
      const cards = m.groups.flatMap((g) => g.cards)
      const t = caso.pacote.tabelas.find((x) => x.id === 'outliers')
      if (t) t.linhas.forEach((l, i) => {
        const card = cards[i]!, v = OBS.video(card.id)!
        expect((l[4] as Cel).x, `mult ${card.id}`).toBe(Number((card.multN as number).toPrecision(12))); vistos.mult += 1
        expect((l[6] as Cel).x, `views ${card.id}`).toBe(v.views); vistos.views += 1
        const vpd = (l[7] as Cel).x
        if (typeof vpd === 'number') { expect(vpd, `vpd ${card.id}`).toBe(Number(((v.vpd7 ?? v.vpd) as number).toPrecision(12))); vistos.vpd += 1 }
      })
      const idades = caso.pacote.tabelas.find((x) => x.id === 'idades')
      if (idades) { expect(idades.linhas.map((l) => (l[1] as Cel).x)).toEqual([m.shortcut.count, ...m.timeline.map((w) => w.count), m.allCount]); vistos.cont += 1 }
    }
    for (const [k, n] of Object.entries(vistos)) expect(n, k).toBeGreaterThan(0)
  })
})

describe('outliers: views/dia que a tela escreve em palavras (D11 de Destaques)', () => {
  it('"sem views/dia recentes" e "menos de 1 dia no ar" continuam medido (estado igual) e saem sem x, com o motivo; nunca 0', () => {
    const achadas: string[] = []
    for (const caso of CASOS) {
      const t = caso.pacote.tabelas.find((x) => x.id === 'outliers')
      t?.linhas.forEach((l) => {
        const c = l[7] as Cel & { estado: string }
        if (/^(sem views\/dia recentes|menos de 1 dia no ar)$/.test(c.texto)) {
          expect(c.estado).toBe('medido'); expect(c.x).toBeUndefined(); expect(c.semXMotivo, c.texto).toMatch(/\S/)
          achadas.push(c.texto)
        }
      })
    }
    expect(new Set(achadas)).toEqual(new Set(['sem views/dia recentes', 'menos de 1 dia no ar']))
  })
})

describe('outliers: chaves (4)', () => {
  it('toda tabela declara chaves paralelas a colunas, únicas e snake_case', () => {
    const mapa: Record<string, string[] | undefined> = {}
    for (const caso of CASOS) for (const t of caso.pacote.tabelas) {
      expect(t.chaves, `${t.id}: sem chaves`).toBeDefined()
      expect(t.chaves!.length, `${t.id}: chaves.length`).toBe(t.colunas.length)
      expect(new Set(t.chaves).size, `${t.id}: chaves repetidas`).toBe(t.chaves!.length)
      for (const k of t.chaves!) expect(k, `${t.id}: ${k}`).toMatch(/^[a-z][a-z0-9_]*$/)
      mapa[t.id] = t.chaves
    }
    expect(Object.fromEntries(Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b)))).toMatchInlineSnapshot(`
      {
        "canais-com-problema": [
          "canal",
          "situacao",
        ],
        "forja-desde-entao": [
          "leitura",
          "desde_entao",
        ],
        "forja-do-site": [
          "leitura",
          "do_site",
        ],
        "grupos": [
          "grupo",
          "outliers",
        ],
        "grupos-notas": [
          "grupo",
          "nota",
        ],
        "idades": [
          "faixa_de_idade",
          "outliers",
        ],
        "outliers": [
          "grupo",
          "video",
          "canal",
          "nicho",
          "multiplicador",
          "base_do_multiplicador",
          "views",
          "views_dia_7d",
          "publicado",
          "duracao",
        ],
        "outliers-avisos": [
          "video",
          "aviso",
        ],
        "outliers-reuso": [
          "video",
          "mes_do_assunto",
          "views_dia_7d",
          "mediana_do_canal_views_dia",
        ],
      }
    `)
  })
  it('a principal tem as chaves do plano e o gráfico sugerido de cada tabela numérica', () => {
    const p = CASOS[0]!.pacote
    expect(p.tabelas.find((x) => x.id === 'outliers')!.chaves).toEqual(['grupo', 'video', 'canal', 'nicho', 'multiplicador', 'base_do_multiplicador', 'views', 'views_dia_7d', 'publicado', 'duracao'])
    expect(Object.fromEntries(p.tabelas.map((t) => [t.id, t.grafico]))).toMatchObject({ outliers: 'barra', idades: 'nenhum' })
  })
})

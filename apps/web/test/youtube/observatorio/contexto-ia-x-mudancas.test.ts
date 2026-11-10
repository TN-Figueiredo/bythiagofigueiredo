// @vitest-environment node
/**
 * A5 F0.5a-T3: o `x` na origem da tela Mudanças. Mesmas provas da T1/T2: (1) toda célula medida tem x, (2) o formatador da unidade da coluna
 * aplicado a x dá o texto (percentual em pontos: o modelo guarda fração, o x vai ×100), (2b) ordem de grandeza, (3) x é o número do motor, (4) chaves.
 */
import { describe, it, expect } from 'vitest'
import { casosDeMudancas, OBS_DAS_TELAS as OBS } from './contexto-ia-x-telas-fixture'
import { medidas, semX } from './contexto-ia-x-fixture'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildMudancasView } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'
import { empacotarMudancas, modeloDeMudancas } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-mudancas'

const CASOS = casosDeMudancas()
const F = OBS.fmt
const nb = (s: string) => s.replace(/ /g, ' ')
type Cel = { texto: string; x?: number | null; semXMotivo?: string }
const g12 = (v: number) => Number(v.toPrecision(12))

describe('mudanças: toda célula medida tem x finito (1)', () => {
  it.each(CASOS.map((c) => [c.nome, c] as const))('%s', (_n, caso) => {
    const faltam = medidas(caso.pacote).filter(({ c }) => !semX(c) && !(c.papel === 'numero' && 'x' in c && typeof c.x === 'number' && Number.isFinite(c.x))).map((m) => `${m.caminho}: x ${String((m.c as { x?: unknown }).x)}`)
    expect(faltam, 'células medidas sem x').toEqual([])
  })
})

describe('mudanças: o formatador da unidade da coluna aplicado a x dá o texto (2) e (2b)', () => {
  /** O modelo guarda fração (`F.pct` multiplica por 100); o `x` está em pontos, na unidade do título. */
  const FORMATADOR: Record<string, (x: number) => string> = {
    'trocas-efeito/Observado': (x) => F.pct(x / 100),
    'trocas-efeito/Antes (views/dia)': (x) => F.num(x),
    'trocas-efeito/Depois (views/dia)': (x) => F.num(x),
    'trocas-esperado/Esperado sem a troca': (x) => F.pct(x / 100),
    'trocas-esperado/Efeito': (x) => F.pp(x),
    'trocas-faixa/Limite da faixa': (x) => F.pct(x / 100),
    'trocas-base/Vídeos na base (n)': (x) => String(x),
    'trocas-descricoes/Linhas novas': (x) => String(x),
    'trocas-descricoes/Linhas removidas': (x) => String(x),
    'trocas-descricoes/Trocas de UTM ocultas': (x) => String(x),
    'quadro-de-efeito/Trocas do nicho na janela': (x) => String(x),
    'quadro-de-efeito/Com veredito (n)': (x) => String(x),
    'quadro-de-efeito/Mediana do efeito': (x) => F.pp(x),
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
  it('o teste não passa vazio: a matriz confere células de cada coluna (exceto a mediana do quadro, que nenhuma fixture mede)', () => {
    const n = (col: string) => CASOS.reduce((s, c) => s + medidas(c.pacote).filter((m) => `${m.tabela}/${m.coluna}` === col && typeof (m.c as Cel).x === 'number').length, 0)
    for (const col of Object.keys(FORMATADOR).filter((k) => k !== 'quadro-de-efeito/Mediana do efeito')) expect(n(col), col).toBeGreaterThan(0)
  })
  it('(2b) observado "+12%" → x === 12 (pontos, não 0,12); a mediana do quadro "+5 pp" → x === 5', () => {
    const caso = casosDeMudancas().find((c) => c.nome === '90 dias')!
    const h = caso.modelo.heroes.find((x) => x.effect.rows !== null && x.effect.rows.observed !== '—')!
    ;(h.effect.rows as { observed: string }).observed = '+12%'
    ;(h.effect as unknown as { rowsN: { observed: number } }).rowsN.observed = 12
    const linha = (p: ReturnType<typeof empacotarMudancas>) => p.tabelas.find((t) => t.id === 'trocas-efeito')!.linhas.find((l) => (l[0] as { texto: string }).texto === h.video.title)!
    expect((linha(empacotarMudancas(caso.modelo))[3] as Cel)).toMatchObject({ texto: '+12%', x: 12 })
    const med = caso.modelo.ledger.medians[0]!
    ;(med as { median: string | null }).median = '+5 pp'
    ;(med as { medianN: number | null }).medianN = 5
    const q = empacotarMudancas(caso.modelo).tabelas.find((t) => t.id === 'quadro-de-efeito')!
    expect(q.linhas[0]![3]).toMatchObject({ estado: 'medido', texto: '+5 pp', x: 5 })
  })
})

describe('mudanças: x é o número do motor (3)', () => {
  it('Observado, Antes, Depois, Esperado, Faixa e Efeito saem de `obs.effect` (fração ×100, médias, pontos); contagens saem do modelo', () => {
    const visto = { obs: 0, de: 0, ate: 0, esp: 0, pp: 0, faixa: 0, n: 0, quadro: 0 }
    for (const caso of CASOS) {
      const porTitulo = (id: string) => caso.pacote.tabelas.find((t) => t.id === id)?.linhas ?? []
      const heroes = caso.modelo.heroes
      // o mesmo vídeo pode ter várias trocas: a troca é a da `origem` da célula (`modelo.heroes[i]...`), não a do título
      const doHero = (l: unknown[]) => heroes[Number(/heroes\[(\d+)\]/.exec((l[1] as { origem: string }).origem)![1])]!
      for (const l of porTitulo('trocas-efeito')) {
        const h = doHero(l), e = OBS.effect(h.id)!
        expect((l[3] as Cel).x, `obs ${h.id}`).toBe(g12(e.observed! * 100)); visto.obs += 1
        expect((l[4] as Cel).x, `de ${h.id}`).toBe(g12(e.beforeAvg!)); visto.de += 1
        expect((l[5] as Cel).x, `ate ${h.id}`).toBe(g12(e.afterAvg!)); visto.ate += 1
      }
      for (const l of porTitulo('trocas-esperado')) {
        const h = doHero(l), e = OBS.effect(h.id)!
        expect((l[1] as Cel).x, `esp ${h.id}`).toBe(g12(e.expected! * 100)); visto.esp += 1
        expect((l[2] as Cel).x, `pp ${h.id}`).toBe(g12(e.effectPp!)); visto.pp += 1
      }
      const faixa = porTitulo('trocas-faixa')
      for (let k = 0; k < faixa.length; k += 1) {
        const h = doHero(faixa[k]!), e = OBS.effect(h.id)!
        expect((faixa[k]![1] as Cel).x, `faixa ${h.id}`).toBe(g12(e.iqr![k % 2]! * 100)); visto.faixa += 1
      }
      for (const l of porTitulo('trocas-base')) { const h = doHero(l); expect((l[1] as Cel).x).toBe(OBS.effect(h.id)!.n); visto.n += 1 }
      const quadro = porTitulo('quadro-de-efeito')
      quadro.forEach((l, i) => { const m = caso.modelo.ledger.medians[i]!; expect([(l[1] as Cel).x, (l[2] as Cel).x]).toEqual([m.poolN, m.n]); visto.quadro += 1 })
    }
    for (const [k, n] of Object.entries(visto)) expect(n, k).toBeGreaterThan(0)
  })
})

describe('mudanças: a mediana do quadro com n suficiente (nenhuma fixture de n ≥ 5 a mede)', () => {
  it('com o mínimo de vereditos baixado, a célula da mediana é medida e o x é a mediana em pontos, sem o arredondamento da tela', () => {
    // `RULES` é a constante do módulo, compartilhada por todo o arquivo: baixa o mínimo só aqui e devolve no `finally`.
    const regra = OBS.RULES.effect as { minN: number }
    const antes = regra.minN
    try {
      regra.minN = 2
      const view = buildMudancasView(OBS, { win: '90' }, new Set())
      const linha = view.ledger.medians.findIndex((m) => m.type === 'thumb')
      const m = view.ledger.medians[linha]!
      const cel = empacotarMudancas(modeloDeMudancas(view, 'Todos')).tabelas.find((t) => t.id === 'quadro-de-efeito')!.linhas[linha]![3] as Cel & { estado: string }
      expect(cel.estado).toBe('medido')
      expect(m.n, 'as 4 trocas de capa com veredito e sem ressalva').toBe(4)
      expect(OBS.fmt.pp(cel.x as number)).toBe(m.median)
      // Oráculo escrito à mão: as duas do meio, em pontos, são +0,873025885963 (neutro) e +28,7771104143 (ganhou); a mediana de 4 é a média delas.
      // Fracionária de propósito: arredondada para a tela daria 15, e o `x` é o número sem esse arredondamento.
      expect(cel.x).toBeCloseTo(14.8250681501, 8)
      expect(Number.isInteger(cel.x as number)).toBe(false)
    } finally {
      regra.minN = antes
    }
  })
})

describe('mudanças: chaves (4)', () => {
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
        "forja-do-site": [
          "nicho",
          "do_site",
        ],
        "quadro-de-efeito": [
          "tipo",
          "trocas_do_nicho_na_janela",
          "com_veredito_n",
          "mediana_do_efeito_pp",
          "resultado",
        ],
        "trocas": [
          "video",
          "canal",
          "nicho",
          "tipo",
          "quando",
          "visto",
        ],
        "trocas-base": [
          "video",
          "videos_na_base",
          "faixa_de_idade",
          "metodo",
        ],
        "trocas-descricoes": [
          "video",
          "linhas_novas",
          "linhas_removidas",
          "trocas_de_utm_ocultas",
        ],
        "trocas-efeito": [
          "video",
          "tipo",
          "veredito",
          "observado_pct",
          "antes_views_dia",
          "depois_views_dia",
        ],
        "trocas-esperado": [
          "video",
          "esperado_sem_a_troca_pct",
          "efeito_pp",
        ],
        "trocas-faixa": [
          "video",
          "limite_da_faixa_pct",
        ],
        "trocas-notas": [
          "video",
          "nota",
        ],
        "trocas-thumbs": [
          "video",
          "imagem",
          "periodo",
        ],
        "trocas-titulos": [
          "video",
          "titulo_de_antes",
          "titulo_de_depois",
        ],
      }
    `)
  })
  it('as chaves de `trocas` e `trocas-efeito` são as do plano', () => {
    const p = CASOS.find((c) => c.nome === '90 dias')!.pacote
    expect(p.tabelas.find((x) => x.id === 'trocas')!.chaves).toEqual(['video', 'canal', 'nicho', 'tipo', 'quando', 'visto'])
    expect(p.tabelas.find((x) => x.id === 'trocas-efeito')!.chaves).toEqual(['video', 'tipo', 'veredito', 'observado_pct', 'antes_views_dia', 'depois_views_dia'])
  })
})

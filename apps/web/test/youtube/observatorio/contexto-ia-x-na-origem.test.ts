// @vitest-environment node
/**
 * A5 F0.5a, commit 0: a REDE da regra "a F0.5 não muda estado de célula" (Yannis I1, Phil) e a linha de base do portão do JSON do diálogo (D3).
 * Gravado contra o código de ANTES do conserto; depois dele tem de continuar verde sem regravar o arquivo de estados.
 */
import { describe, it, expect } from 'vitest'
import { casosDeCanais, mundoComCanais, pacoteDe, modeloDe, privadoDe, extrasDe, type CasoCanais } from './contexto-ia-x-fixture'
import { nbMilMi, numNb } from '@/app/cms/(authed)/youtube/competitors/_canal/formato'
import { vpdText } from '@/app/cms/(authed)/youtube/competitors/_canal/numeros'
import { empacotarCanais } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canais'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { CONTEXTO_IA_RULES } from '@/lib/youtube/observatorio/contexto-ia/regras'
import type { Celula, PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { CONTEXTO } from './contexto-ia-fixture'

const LETRA: Record<string, string> = { medido: 'M', zero_medido: 'Z', nao_medido: 'n', falhou: 'f', restrito: 'r' }
const letra = (c: Celula): string => (c.papel === 'numero' ? LETRA[c.estado]! : '.')

/** tabela/coluna → uma letra por linha (M medido, Z zero medido, n não medido, f falhou, r restrito, . não é número). Texto de célula medida entra junto (muda-se o estado ou o texto, cai). */
export function mapaDeEstados(p: PacoteModelo): string[] {
  return p.tabelas.flatMap((t) => t.colunas.map((col, j) => {
    const letras = t.linhas.map((l) => letra(l[j]!)).join('')
    const textos = t.linhas.map((l) => { const c = l[j]!; return c.papel === 'numero' && (c.estado === 'medido' || c.estado === 'zero_medido') ? c.texto : '' }).join('|')
    return `${t.id}/${col}: ${letras} ${textos}`
  }))
}

describe('canais: estados iguais (rede da F0.5a)', () => {
  it('o mapa tabela/coluna/linha → estado e texto das fixtures é o de antes do conserto', async () => {
    const saida = casosDeCanais().map((c) => `## ${c.nome}\n${mapaDeEstados(pacoteDe(c)).join('\n')}`).join('\n\n') + '\n'
    await expect(saida).toMatchFileSnapshot('__snapshots__/contexto-ia-x-estados-canais.txt')
  })
  it('a rede enxerga: trocar o estado de uma célula muda o mapa', () => {
    const c = casosDeCanais()[0]!
    const p = pacoteDe(c)
    const antes = mapaDeEstados(p).join('\n')
    const cel = p.tabelas.find((t) => t.id === 'canais')!.linhas[0]!.find((x) => x.papel === 'numero')!
    ;(cel as { estado: string }).estado = cel.estado === 'medido' ? 'zero_medido' : 'medido'
    expect(mapaDeEstados(p).join('\n')).not.toBe(antes)
  })
})

describe('portão do JSON do diálogo (D3): linhas da principal que ficam no diálogo `todos`', () => {
  const PERGUNTA = ''
  /** Linhas da tabela principal `canais` que sobram no texto da cópia (degrau do corte e linhas de fato no bloco estruturado). */
  const medir = (n: number) => {
    const w = mundoComCanais(n)
    const pacote = pacoteDe({ nome: `${n}`, obs: w.obs, sp: {}, extras: extrasDe(w.obs), privado: privadoDe(w.obs, 'ok') })
    const seg = segmentar(pacote, CONTEXTO)
    const t = montarTexto(seg, PERGUNTA, CONTEXTO_IA_RULES.limiteCopia, 'todos')
    const linhasNoJson = (t.texto.match(/"tabela":\s*"canais"/g) ?? []).length
    const tabelaCanais = pacote.tabelas.find((x) => x.id === 'canais')!
    return { canais: w.obs.channels.length, linhasDaPrincipal: tabelaCanais.linhas.length, degrau: t.degrau, linhasNoJson, caracteres: t.caracteres, totalSemCorte: t.totalSemCorte }
  }
  it('com x no JSON, o diálogo `todos` mantém as mesmas linhas da principal de antes (60 e 200 canais): degrau 3, 3 linhas no JSON', () => {
    const r = { n60: medir(60), n200: medir(200) }
    console.info('portao', JSON.stringify(r))
    expect(r.n60.canais).toBeGreaterThanOrEqual(60)
    expect(r.n200.canais).toBeGreaterThanOrEqual(200)
    // medido no commit 0, antes de qualquer conserto: 58 e 198 linhas na principal, degrau 3, 3 linhas no JSON
    expect([r.n60.linhasDaPrincipal, r.n60.degrau, r.n60.linhasNoJson]).toEqual([58, 3, 3])
    expect([r.n200.linhasDaPrincipal, r.n200.degrau, r.n200.linhasNoJson]).toEqual([198, 3, 3])
    for (const m of [r.n60, r.n200]) expect(m.caracteres).toBeLessThanOrEqual(CONTEXTO_IA_RULES.limiteCopia)
    // o oráculo de tamanhos remedido com o x no JSON (antes: 23.127 / 350.817 com 60 canais e 23.193 / 1.161.863 com 200)
    expect({ n60: [r.n60.caracteres, r.n60.totalSemCorte], n200: [r.n200.caracteres, r.n200.totalSemCorte] }).toEqual({ n60: [23646, 359200], n200: [23714, 1190256] })
  })
  it('o JSON do diálogo leva "x" em cada número medido (K3)', () => {
    const w = mundoComCanais(60)
    const pacote = pacoteDe({ nome: 'x', obs: w.obs, sp: {}, extras: extrasDe(w.obs), privado: privadoDe(w.obs, 'ok') })
    const t = montarTexto(segmentar(pacote, CONTEXTO), '', CONTEXTO_IA_RULES.limiteCopia, 'todos')
    expect(t.texto).toMatch(/"x":\s*-?\d/)
  })
})

// ───────────────────────── o x na origem (T1: tela Canais)
const MENOS = '\u2212'
/** Todas as células numéricas medidas, com o caminho `tabela/coluna/linha`. */
function medidas(p: PacoteModelo) {
  return p.tabelas.flatMap((t) => t.linhas.flatMap((l, i) => l.flatMap((c, j) => (c.papel === 'numero' && (c.estado === 'medido' || c.estado === 'zero_medido') ? [{ t, tabela: t.id.replace(/^privado-/, ''), coluna: t.colunas[j]!, i, j, c, caminho: `${t.id}/${t.colunas[j]}/${i + 1}` }] : []))))
}
const semX = (c: Celula) => c.papel === 'numero' && (c.estado === 'medido' || c.estado === 'zero_medido') && 'semXMotivo' in c && typeof c.semXMotivo === 'string'
const todosOsCasos = (): CasoCanais[] => {
  const w60 = mundoComCanais(60)
  return [...casosDeCanais(),
    { nome: '60 canais, longos', obs: w60.obs, sp: {}, extras: extrasDe(w60.obs), privado: privadoDe(w60.obs, 'ok') },
    { nome: '60 canais, todos', obs: w60.obs, sp: { fmt: 'todos' }, extras: extrasDe(w60.obs), privado: privadoDe(w60.obs, 'ok') }]
}

describe('canais: toda célula medida tem x finito (1)', () => {
  it.each(todosOsCasos().map((c) => [c.nome, c] as const))('%s', (_n, caso) => {
    const faltam = medidas(pacoteDe(caso)).filter(({ c }) => !semX(c) && !(c.papel === 'numero' && 'x' in c && typeof c.x === 'number' && Number.isFinite(c.x))).map((m) => `${m.caminho}: x ${String((m.c as { x?: unknown }).x)}`)
    expect(faltam, 'células medidas sem x').toEqual([])
  })
})

describe('canais: o formatador da unidade da coluna aplicado a x dá o texto (2) e (2b)', () => {
  const caso = casosDeCanais().find((c) => c.nome === 'todos')!
  const F = caso.obs.fmt
  const sinal = (n: number) => (n > 0 ? '+' : n < 0 ? MENOS : '')
  const vpd = (x: number) => nbMilMi(vpdText(x, F.num) ?? F.num(x))
  const pw = (x: number) => F.dec1(x)
  /** coluna (sem o prefixo privado-) → como a tela escreve o número, na unidade do título da coluna. */
  const FORMATADOR: Record<string, (x: number) => string> = {
    'canais/Posição': (x) => `${x}º`,
    'canais/Inscritos': (x) => nbMilMi(F.subs(x)),
    'canais/Direção': (x) => `${sinal(Math.round(x))}${Math.abs(Math.round(x))}%`,
    'canais/Ritmo (uploads por semana, 13 semanas)': pw,
    'canais/Views/dia por mil inscritos': vpd,
    'canais/Views/dia, mediana dos vídeos': vpd,
    'canais/Outliers': (x) => F.mult(x),
    'canais/Trocas': (x) => String(x),
    'canais/Crescimento': (x) => `${sinal(x)}${F.dec1(Math.abs(x))}%`,
    'canais-direcao-numeros/Views nos últimos 28 dias': (x) => numNb(F, x),
    'canais-direcao-numeros/Views nos 28 dias anteriores': (x) => numNb(F, x),
    'canais-views-por-dia/Views por dia, valor absoluto': vpd,
    'canais-views-por-dia/Vídeos na base': (x) => String(x),
    'canais-maior-outlier/Vídeos comparados': (x) => String(x),
    'canais-shorts/Ritmo dos Shorts': pw,
    'canais-shorts/Views por dia dos Shorts': vpd,
    'canais-shorts/Outliers dos Shorts': (x) => F.mult(x),
    'canais-shorts-views-por-dia/Views por dia dos Shorts, valor absoluto': vpd,
    'canais-shorts-views-por-dia/Vídeos na base dos Shorts': (x) => String(x),
    'canais-resumo-direcao/Canais': (x) => String(x),
    'canais-resumo-estado/Canais': (x) => String(x),
    'canais-inscritos/Ganho em 28 dias': (x) => `${sinal(x)}${F.dec1(Math.abs(x))}%`,
  }
  it('cada coluna numérica tem formatador e o x reescreve o texto da célula', () => {
    const p = pacoteDe(caso)
    const sem: string[] = [], erradas: string[] = []
    let checadas = 0
    for (const m of medidas(p)) {
      const f = FORMATADOR[`${m.tabela}/${m.coluna}`]
      if (!f) { if (!['canais-referencias/Views do vídeo típico'].includes(`${m.tabela}/${m.coluna}`)) sem.push(m.caminho); continue }
      const c = m.c as { texto: string; x?: number | null; semXMotivo?: string }
      if (typeof c.x !== 'number') continue // o teste (1) acusa a falta; a contagem abaixo impede o verde vazio
      checadas += 1
      const texto = c.texto === 'sem variação' ? 'sem variação' : c.texto.replace(/\u00a0/g, ' ')
      const esperado = f(c.x).replace(/\u00a0/g, ' ')
      if (texto !== esperado && !(texto === 'sem variação' && c.x === 0)) erradas.push(`${m.caminho}: texto "${texto}" ≠ f(x=${c.x}) "${esperado}"`)
    }
    expect(sem, 'coluna numérica sem formatador no teste').toEqual([])
    expect(checadas, 'células conferidas pelo formatador (sem isso o teste passa vazio)').toBeGreaterThan(100)
    expect(erradas).toEqual([])
  })
  it('(2b) ordem de grandeza: coluna em % com texto ≥ 1% tem |x| ≥ 1 (a fração 0,123 no lugar de 12,3 cai aqui)', () => {
    let vistas = 0
    for (const m of medidas(pacoteDe(caso))) {
      const c = m.c as { texto: string; x?: number | null }
      const pct = /^[+\u2212-]?(\d+(?:,\d+)?)%$/.exec(c.texto)
      if (!pct || typeof c.x !== 'number') continue
      vistas += 1
      if (Number(pct[1]!.replace(',', '.')) >= 1) expect(Math.abs(c.x), m.caminho).toBeGreaterThanOrEqual(1)
    }
    expect(vistas, 'a fixture tem coluna em %').toBeGreaterThan(0)
  })
  it('(2b) crescimento "+12,3%" → x === 12.3 (o empacotador copia o gêmeo do modelo ×100, normalizado)', () => {
    const m = modeloDe(caso)
    const r = [...m.list.ranked, ...m.list.unranked].find((x) => !x.own && x.cells.growth.kind === 'ok')!
    const g = r.cells.growth
    if (g.kind !== 'ok') throw new Error('sem crescimento ok na fixture')
    expect((g as { growthPctN?: number }).growthPctN).toBe(Number((g.pct * 100).toPrecision(12)))
    ;(g as { big: string; growthPctN: number }).big = '+12,3%'
    ;(g as { growthPctN: number }).growthPctN = 12.3
    const cel = empacotarCanais(m, caso.privado).tabelas.find((t) => t.id === 'canais')!.linhas.find((l) => (l[2] as { texto: string }).texto === r.id)![9]! as { texto: string; x: number }
    expect(cel.texto).toBe('+12,3%')
    expect(cel.x).toBe(12.3)
  })
})

describe('canais: x é o número do modelo (3)', () => {
  const caso = casosDeCanais().find((c) => c.nome === 'longos')!
  it('Inscritos === subs do canal; Trocas === c.swap.n; Direção é a exata (D12); Posição é r.numero.pos', () => {
    const m = modeloDe(caso)
    const p = pacoteDe(caso)
    const t = p.tabelas.find((x) => x.id === 'canais')!
    const col = (n: string) => t.colunas.indexOf(n)
    let visto = { subs: 0, swap: 0, dir: 0, pos: 0 }
    for (const l of t.linhas) {
      const id = (l[col('Id')] as { texto: string }).texto
      const r = [...m.list.ranked, ...m.list.unranked].find((x) => x.id === id)!
      const x = (c: unknown) => (c as { x?: number | null }).x
      if (r.subsOculto === false) { expect(x(l[col('Inscritos')]), `subs ${id}`).toBe(caso.obs.channels.find((c) => c.id === id)!.subs); visto.subs += 1 }
      if (r.cells.swap.kind === 'ok') { expect(x(l[col('Trocas')]), `trocas ${id}`).toBe(r.cells.swap.n); visto.swap += 1 }
      if (r.direcao.tipo === 'medido') {
        const d = r.direcao
        expect(x(l[col('Direção')]), `direção ${id}`).toBe(Number((((d.ganhoRecente - d.ganhoAnterior) / d.ganhoAnterior) * 100).toPrecision(12))); visto.dir += 1
      }
      if (r.numero) { expect(x(l[col('Posição')]), `posição ${id}`).toBe(r.numero.pos); visto.pos += 1 }
    }
    expect(visto.subs).toBeGreaterThan(0); expect(visto.swap).toBeGreaterThan(0); expect(visto.dir).toBeGreaterThan(0); expect(visto.pos).toBeGreaterThan(0)
  })
})

describe('canais: Direção exata (D12)', () => {
  it('x é a variação exata (23,4), não o inteiro que a tela escreve (23)', () => {
    const caso = casosDeCanais().find((c) => c.nome === 'longos')!
    const m = modeloDe(caso)
    const r = [...m.list.ranked, ...m.list.unranked].find((x) => x.direcao.tipo === 'medido')!
    if (r.direcao.tipo !== 'medido') throw new Error('sem direção medida')
    Object.assign(r.direcao, { ganhoRecente: 1234, ganhoAnterior: 1000, pct: 23, texto: '+23%' })
    const t = empacotarCanais(m, caso.privado).tabelas.find((x) => x.id === 'canais')!
    const l = t.linhas.find((y) => (y[2] as { texto: string }).texto === r.id)!
    expect((l[4] as { x?: number }).x).toBe(23.4)
  })
})

describe('canais: chaves (4)', () => {
  it('toda tabela declara chaves paralelas a colunas, únicas e snake_case', () => {
    const mapa: Record<string, string[] | undefined> = {}
    for (const caso of todosOsCasos()) for (const t of pacoteDe(caso).tabelas) {
      expect(t.chaves, `${t.id}: sem chaves`).toBeDefined()
      expect(t.chaves!.length, `${t.id}: chaves.length`).toBe(t.colunas.length)
      expect(new Set(t.chaves).size, `${t.id}: chaves repetidas`).toBe(t.chaves!.length)
      for (const k of t.chaves!) expect(k, `${t.id}: ${k}`).toMatch(/^[a-z][a-z0-9_]*$/)
      mapa[t.id.replace(/^privado-/, '')] = t.chaves
    }
    expect(Object.fromEntries(Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b)))).toMatchInlineSnapshot(`
      {
        "canais": [
          "posicao",
          "canal",
          "id",
          "inscritos",
          "direcao_pct",
          "ritmo_por_semana",
          "views_dia_por_mil",
          "maior_outlier_mult",
          "trocas",
          "crescimento_pct",
          "sincronizacao",
        ],
        "canais-dicas": [
          "canal",
          "dica",
        ],
        "canais-direcao-numeros": [
          "canal",
          "views_ultimos_28_dias",
          "views_28_dias_anteriores",
        ],
        "canais-estado": [
          "canal",
          "estado",
        ],
        "canais-inscritos": [
          "canal",
          "ganho_28_dias_pct",
        ],
        "canais-inscritos-notas": [
          "canal",
          "nota",
        ],
        "canais-maior-outlier": [
          "canal",
          "video",
          "videos_comparados",
          "publicado",
          "contagem",
        ],
        "canais-nicho": [
          "canal",
          "nicho",
        ],
        "canais-notas": [
          "canal",
          "nota",
        ],
        "canais-outliers-contagem": [
          "canal",
          "contagem",
        ],
        "canais-referencias": [
          "canal",
          "views_video_tipico",
        ],
        "canais-referencias-notas": [
          "canal",
          "nota",
        ],
        "canais-resumo-direcao": [
          "direcao",
          "canais",
        ],
        "canais-resumo-estado": [
          "estado",
          "canais",
        ],
        "canais-shorts": [
          "canal",
          "ritmo_shorts",
          "views_dia_shorts",
          "outliers_shorts",
        ],
        "canais-shorts-views-por-dia": [
          "canal",
          "views_dia_shorts_valor_absoluto",
          "videos_na_base_shorts",
        ],
        "canais-views-por-dia": [
          "canal",
          "views_dia_valor_absoluto",
          "videos_na_base",
        ],
      }
    `)
  })
  it('as chaves da principal são as do plano', () => {
    const t = pacoteDe(casosDeCanais()[0]!).tabelas.find((x) => x.id === 'canais')!
    expect(t.chaves).toEqual(['posicao', 'canal', 'id', 'inscritos', 'direcao_pct', 'ritmo_por_semana', 'views_dia_por_mil', 'maior_outlier_mult', 'trocas', 'crescimento_pct', 'sincronizacao'])
  })
})

describe('canais: crescimento "sem variação" (7, D11)', () => {
  const caso = casosDeCanais().find((c) => c.nome === 'longos')!
  const celula = (limite: number) => {
    const m = modeloDe(caso)
    const r = [...m.list.ranked, ...m.list.unranked].find((x) => !x.own && x.cells.growth.kind !== 'na')!
    r.cells.growth = { kind: 'flat', big: 'sem variação', cap: 'x', limite, antes: 1, depois: 1, de: 1, ate: 2, atrasadoAte: null, abs: 0, passo: 1000, growthPctN: limite > 0 ? null : 0 } as never
    const t = empacotarCanais(m, caso.privado).tabelas.find((x) => x.id === 'canais')!
    return t.linhas.find((l) => (l[2] as { texto: string }).texto === r.id)![9]! as { estado: string; texto: string; x?: number | null; semXMotivo?: string }
  }
  it('com limiteArred > 0: medido sem x (undefined, nunca 0) e o motivo cita ±1.000; texto não muda', () => {
    const c = celula(1000)
    expect(c.estado).toBe('medido'); expect(c.texto).toBe('sem variação')
    expect(c.x).toBeUndefined()
    expect(c.semXMotivo).toMatch(/±1\.000/)
  })
  it('com limiteArred === 0: x === 0, estado medido', () => {
    const c = celula(0)
    expect(c.estado).toBe('medido'); expect(c.x).toBe(0); expect(c.semXMotivo).toBeUndefined()
  })
})

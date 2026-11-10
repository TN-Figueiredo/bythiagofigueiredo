// @vitest-environment node
/**
 * A7a T2: o corte do acesso pela IA em estágios (a lista principal fica inteira; o corte começa nas notas e dicas).
 * Mundo: o oráculo de `a3World` com N canais concorrentes clonados; o empacotador é o REAL (`empacotarCanais`), não um modelo à mão.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ empacotar: {} as Record<string, ReturnType<typeof import('vitest')['vi']['fn']>>, captured: [] as unknown[], montar: { n: 0 } }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => m.captured.push(a), captureException: (...a: unknown[]) => m.captured.push(a) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({ EMPACOTAR: m.empacotar }))
// A7b T9: o custo da busca de `k` se prova por contagem de montagens, nunca por relógio
vi.mock('@/lib/youtube/observatorio/contexto-ia/montar-texto', async (original) => {
  const mod = await original<typeof import('@/lib/youtube/observatorio/contexto-ia/montar-texto')>()
  return { ...mod, montarTexto: (...a: Parameters<typeof mod.montarTexto>) => { m.montar.n += 1; return mod.montarTexto(...a) } }
})
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { a3World } from './a3-fixture'
import { medidasDoOraculo } from './canais-e5a-fixture'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { buildRiView } from '@/app/cms/(authed)/youtube/competitors/_canais/ri-model'
import { empacotarCanais, modeloDeCanais } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canais'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import type { PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { AGORA, CONTEXTO, base, medido, modeloCheio, modeloEstresseMudancas, rotulo, terceiros } from './contexto-ia-fixture'
import { CLASSES_NA_IA, classeDa, escolherCorte, fixarLinhas, janela } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/corte-da-ia'
import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import type { Tabela, TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'

/** O oráculo com `n` canais ao todo: os concorrentes do oráculo são clonados (com os vídeos) até dar `n`. */
function mundoCom(n: number) {
  return a3World((ds: Dataset) => {
    const concorrentes = ds.channels.filter((c) => !c.own)
    const videos = ds.videos
    let i = 0
    while (ds.channels.length < n) {
      const molde = concorrentes[i % concorrentes.length]!
      const id = `${molde.id}-c${i}`
      ds.channels.push({ ...structuredClone(molde), id, name: `${molde.name} ${i + 2}`, fullName: `${molde.fullName} ${i + 2}` })
      for (const v of videos.filter((x) => x.ch === molde.id)) ds.videos.push({ ...structuredClone(v), id: `${v.id}-c${i}`, ch: id })
      i += 1
    }
    ds.channels = ds.channels.slice(0, Math.max(n, ds.channels.filter((c) => c.own).length))
  })
}

function modeloDe(n: number): PacoteModelo {
  const { obs } = mundoCom(n)
  const view = buildCanaisView(obs, { niche: 'todos', limit: 200, fmt: 'longos', medidas: medidasDoOraculo(obs) }, undefined)
  const ri = buildRiView(obs, { agoraMs: obs.NOW, niche: 'todos', fmt: 'long', meuCanalLembrado: null, retratosProprios: new Map() }).view
  return empacotarCanais(modeloDeCanais(view, ri), { acessoPorCanal: {}, negativa: null })
}


const tam = (mod: PacoteModelo): number => segmentar(mod, CONTEXTO).segmentos.reduce((a, x) => a + x.texto.length + 1, 0)
const TETO = 60_000
/** Quantas linhas de dados a tabela de título `titulo` tem no texto (0 = a tabela não está). */
function linhasNoTexto(texto: string, titulo: string): number {
  const l = texto.split('\n')
  const i = l.findIndex((x) => x.startsWith(`### ${titulo}`))
  if (i < 0) return 0
  let k = i + 3
  while (l[k]?.startsWith('| ')) k += 1
  return k - i - 3
}

/** Tabela sintética: `linhas` linhas de `tamanho` caracteres cada. */
function lista(id: string, titulo: string, linhas: number, tamanho: number): Tabela {
  return {
    id, titulo, tipo: 'lista', nomeNoCorte: `tabela ${id}`, privada: false, colunas: ['Item', 'Valor'],
    linhas: Array.from({ length: linhas }, (_, i) => [terceiros(`Item ${i + 1} ${'x'.repeat(tamanho)}`, `p.${id}[${i}].n`), medido(`${i + 1}`, i + 1, `p.${id}[${i}].v`)]),
  }
}
const sintetico = (tela: TelaId, tabelas: Tabela[]): PacoteModelo => ({ ...modeloCheio(), tela, tabelas, citados: [], foco: [], definicoes: [], avisos: [] })

describe('A7a T2 passo 1: o medido (34, 60 e 75 canais, empacotador real; ia, 200 por janela)', () => {
  // Medido em 09/11 com `console.info('medido'…)` neste arquivo. Por canal: principal ~160 caracteres, colunas ~205 (5 tabelas), texto (notas + dicas) 1.100 a 1.130.
  const MEDIDO = {
    34: { fixoMaisFixas: 5_174, principal: 5_542, coluna: 6_948, texto: 38_042, por_nome: 6_300, escolha: { estagio: 'E1', chars: 55_631, degrau: 200 } },
    60: { fixoMaisFixas: 5_176, principal: 9_639, coluna: 12_263, texto: 67_591, por_nome: 11_246, escolha: { estagio: 'E1', chars: 55_858, degrau: 100 } },
    75: { fixoMaisFixas: 5_177, principal: 11_929, coluna: 15_392, texto: 84_768, por_nome: 14_083, escolha: { estagio: 'E1', chars: 55_860, degrau: 50 } },
  } as const
  it.each([34, 60, 75] as const)('%i canais: os tamanhos por classe e a escolha, com e sem reserva', (n) => {
    const mod = modeloDe(n)
    const por: Record<string, number> = {}
    for (const t of mod.tabelas) if (t.tipo === 'lista') por[classeDa('canais', t)] = (por[classeDa('canais', t)] ?? 0) + tam({ ...mod, tabelas: [t] }) - tam({ ...mod, tabelas: [] })
    const fixo = tam({ ...mod, tabelas: mod.tabelas.filter((t) => t.tipo === 'fixa') })
    console.info('medido', n, JSON.stringify({ fixoMaisFixas: fixo, ...por }))
    const e = MEDIDO[n]
    expect({ fixoMaisFixas: fixo, principal: por.principal, coluna: por.coluna, texto: por.texto, por_nome: por.por_nome }).toEqual({ fixoMaisFixas: e.fixoMaisFixas, principal: e.principal, coluna: e.coluna, texto: e.texto, por_nome: e.por_nome })
    // sem reserva, com a Cobertura (1.802) e com a Cobertura + 2.000 de resumo (estimativa da T10): a principal sai inteira, no mesmo estágio
    for (const reserva of [0, 1_802, 3_802]) {
      const c = escolherCorte(mod, CONTEXTO, 200, TETO - reserva)
      expect({ estagio: c.estagio, chars: c.texto.caracteres, degrau: c.texto.degrau }).toEqual(e.escolha)
      expect(c.linhasDaPrincipal).toBe(n)
      expect(c.totalDaPrincipal).toBe(n)
      expect(c.principalCortada).toBe(false)
    }
  })
})

describe('A7a T2: escolherCorte', () => {
  it('(1) 75 canais, 583 dicas e 335 notas: a principal sai inteira, o texto cabe, as notas e dicas caem em degrau', () => {
    const c = escolherCorte(modeloDe(75), CONTEXTO, 200, TETO)
    expect(linhasNoTexto(c.texto.texto, 'Os canais acompanhados')).toBe(75)
    expect(linhasNoTexto(c.texto.texto, 'A dica de cada medida')).toBe(50)
    expect(linhasNoTexto(c.texto.texto, 'Notas de cada canal')).toBe(50)
    expect(c.texto.caracteres).toBeLessThanOrEqual(TETO)
    expect(c.principalCortada).toBe(false)
    expect(c.texto.texto).not.toContain('saíram 25')
    expect(c.texto.texto).not.toContain('há 75 canais')
    expect(c.texto.texto).not.toContain('saíram')
  })

  it('(2) E0 capado: um E0 que só "cabe" cortando a principal não vale; o estágio é E1', () => {
    const mod = modeloDe(75)
    const solto = montarTexto(segmentar(mod, CONTEXTO), '', TETO, 'todos', undefined, { ia: true })
    expect(solto.cabe).toBe(false) // o corte livre existe e atinge a principal (corte por degrau)...
    expect(solto.cortes.some((x) => x.rotulo.includes('linhas'))).toBe(true)
    expect(escolherCorte(mod, CONTEXTO, 200, TETO).estagio).toBe('E1') // ...e o escolherCorte não o aceita como E0
  })

  it.each([1_802, 3_802])('(3) 34 canais com reserva de %i: a principal sai inteira, estágio até E2b, sem principal_cortada', (reserva) => {
    const c = escolherCorte(modeloDe(34), CONTEXTO, 200, TETO - reserva)
    expect(['E0', 'E1', 'E2', 'E2b']).toContain(c.estagio)
    expect(linhasNoTexto(c.texto.texto, 'Os canais acompanhados')).toBe(34)
    expect(c.principalCortada).toBe(false)
  })

  it('(4) E3: principal de 1.000 linhas de 200 caracteres não cabe: corta pelos degraus e avisa', () => {
    const c = escolherCorte(sintetico('canais', [lista('canais', 'Os canais acompanhados', 1_000, 200)]), CONTEXTO, 200, TETO)
    expect(c.estagio).toBe('E3')
    expect(c.principalCortada).toBe(true)
    expect(c.texto.cortes.length).toBeGreaterThan(0)
    expect(c.texto.caracteres).toBeLessThanOrEqual(TETO)
    const k = linhasNoTexto(c.texto.texto, 'Os canais acompanhados')
    expect(k).toBeGreaterThan(0)
    expect(k).toBeLessThan(1_000)
    expect(c.linhasDaPrincipal).toBe(k)
    expect(c.totalDaPrincipal).toBe(1_000)
    expect(c.texto.texto).toContain(`há 1000 canais; saíram ${k}, na ordem da tela`)
  })

  it('(5) inventário: todo id de lista dos empacotadores das três telas tem classe; toda tabela fixa é resumo-da-tela', () => {
    const dir = resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_contexto-ia')
    const achar = (arquivo: string, ctor: 'tabelaLista' | 'tabelaFixa'): string[] =>
      [...readFileSync(join(dir, arquivo), 'utf8').matchAll(new RegExp(`${ctor}\\((?:\`\\$\\{pre\\}([^\`]+)\`|'([^']+)')`, 'g'))].map((x) => (x[1] ?? x[2])!)
    const telas = { canais: 'empacotar-canais.ts', outliers: 'empacotar-outliers.ts', mudancas: 'empacotar-mudancas.ts' } as const
    for (const [tela, arquivo] of Object.entries(telas) as Array<[keyof typeof telas, string]>) {
      const listas = achar(arquivo, 'tabelaLista')
      expect(listas.length, `${tela}: o varredor achou as listas`).toBeGreaterThan(3)
      for (const id of listas) expect(Object.keys(CLASSES_NA_IA[tela]), `${tela}: id de lista sem classe: ${id}`).toContain(id)
      for (const id of achar(arquivo, 'tabelaFixa')) expect(classeDa(tela, { id, tipo: 'fixa' })).toBe('resumo-da-tela')
    }
    // o empacotador real de Canais, com 75 canais, também só devolve ids com classe
    for (const t of modeloDe(75).tabelas) {
      if (t.tipo === 'lista') expect(Object.keys(CLASSES_NA_IA.canais), `id real sem classe: ${t.id}`).toContain(t.id)
      else expect(classeDa('canais', t)).toBe('resumo-da-tela')
    }
  })

  it('(6) classeDa: id de lista fora do mapa é geral, privado-* é geral, fixa é resumo-da-tela; fixarLinhas tira o corte só das tabelas pedidas', () => {
    expect(classeDa('canais', { id: 'id-novo', tipo: 'lista' })).toBe('geral')
    expect(classeDa('canais', { id: 'privado-canais', tipo: 'lista' })).toBe('geral')
    expect(classeDa('canais', { id: 'canais', tipo: 'lista' })).toBe('principal')
    expect(classeDa('mudancas', { id: 'quadro-de-efeito', tipo: 'fixa' })).toBe('resumo-da-tela')
    const p = segmentar(sintetico('canais', [lista('canais', 'Principal', 4, 10), lista('canais-dicas', 'Dicas', 4, 10)]), CONTEXTO)
    const f = fixarLinhas(p, new Set(['canais']))
    const cortes = (x: typeof p, id: string) => x.segmentos.filter((s) => s.corte?.classe === 'linha_de_lista' && s.corte.tabela === id).length
    expect(cortes(p, 'canais')).toBe(4)
    expect(cortes(f, 'canais')).toBe(0)
    expect(cortes(f, 'canais-dicas')).toBe(4)
  })

  describe('(7) o texto exato do aviso de cada estágio', () => {
    it('E1 (canais): texto em degrau; o aviso diz quantas linhas do texto não couberam', () => {
      const c = escolherCorte(sintetico('canais', [lista('canais', 'Principal', 10, 100), lista('canais-dicas', 'Dicas', 100, 100)]), CONTEXTO, 200, 9_000)
      expect(c.estagio).toBe('E1')
      expect(c.texto.degrau).not.toBeNull()
      expect(c.avisos).toEqual([`tabela "Dicas": ${100 - c.texto.degrau!} linhas não couberam; peça a ação canal com o Id para as de um item`])
      expect(c.texto.texto).toContain(c.avisos[0])
      expect(linhasNoTexto(c.texto.texto, 'Principal')).toBe(10)
    })
    it('E2 (canais): o texto sai inteiro, com um aviso por tabela; o por_nome segue nos degraus', () => {
      const c = escolherCorte(sintetico('canais', [lista('canais', 'Principal', 10, 100), lista('canais-dicas', 'Dicas', 50, 100), lista('canais-referencias', 'Referências', 30, 300)]), CONTEXTO, 200, 11_900)
      expect(c.estagio).toBe('E2')
      expect(c.avisos).toEqual(['tabela "Dicas": 50 linhas não couberam; peça a ação canal com o Id para as de um item'])
      expect(c.texto.texto).not.toContain('### Dicas')
      expect(linhasNoTexto(c.texto.texto, 'Principal')).toBe(10)
      expect(linhasNoTexto(c.texto.texto, 'Referências')).toBeGreaterThan(0)
    })
    it('E2b (canais): as colunas caem antes da principal, e o aviso diz de quantos canais', () => {
      const c = escolherCorte(sintetico('canais', [lista('canais', 'Principal', 10, 100), lista('canais-nicho', 'Nichos', 30, 300)]), CONTEXTO, 200, 8_000)
      expect(c.estagio).toBe('E2b')
      expect(c.avisos).toEqual([`tabela "Nichos": colunas de ${30 - c.texto.degrau!} canais não couberam`])
      expect(linhasNoTexto(c.texto.texto, 'Principal')).toBe(10)
      expect(c.principalCortada).toBe(false)
    })
    it('E2 (outliers): o aviso manda para a tela Destaques, sem ação nem id', () => {
      const c = escolherCorte(sintetico('outliers', [lista('outliers', 'Vídeos', 10, 100), lista('outliers-avisos', 'Avisos da tela', 100, 100), lista('outliers-reuso', 'Reuso', 30, 300)]), CONTEXTO, 50, 11_900)
      expect(c.estagio).toBe('E2')
      expect(c.avisos).toEqual(['tabela "Avisos da tela": 100 linhas não couberam; o detalhe aparece na tela Destaques'])
    })
  })

  it('o E0 vence quando nada precisa sair (e não leva aviso)', () => {
    const c = escolherCorte(sintetico('canais', [lista('canais', 'Principal', 5, 20)]), CONTEXTO, 200, TETO)
    expect(c.estagio).toBe('E0')
    expect(c.avisos).toEqual([])
    expect(c.texto.cortes).toEqual([])
  })

  it('tela sem a tabela principal: nenhum estágio fixa nada; a principal é 0 de 0', () => {
    const c = escolherCorte(sintetico('canais', [lista('canais-dicas', 'Dicas', 5, 20)]), CONTEXTO, 200, TETO)
    expect(c.totalDaPrincipal).toBe(0)
    expect(c.linhasDaPrincipal).toBe(0)
  })
})

describe('A7a T2: responder usa o corte e grava linhas e total', () => {
  const abrir = ABRIDOR_DE_SESSAO
  const RECENTE = '13/10/2026 09:10'
  const dobra = (tela: TelaId, modelo: PacoteModelo) => (m.empacotar[tela] as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ modelo, recente: RECENTE, estado: {} }))
  beforeEach(() => {
    m.captured.length = 0
    for (const t of ['canais', 'outliers', 'mudancas', 'canal', 'canal-proprio']) m.empacotar[t] = vi.fn(async () => null)
  })

  it('(8) listar_canais com 34 canais: as 34 linhas, linhas = total = 34, nenhum principal_cortada', async () => {
    dobra('canais', modeloDe(34))
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(linhasNoTexto(r.texto, 'Os canais acompanhados')).toBe(34)
    expect(r.params.linhas).toBe(34)
    expect(r.params.total).toBe(34)
    expect(JSON.stringify(m.captured)).not.toContain('principal_cortada')
    expect(r.texto.length).toBeLessThanOrEqual(TETO)
  })

  it('(8) destaques com 120 vídeos: linhas 50 de total 120 (o limite da ação nunca vira total)', async () => {
    dobra('outliers', sintetico('outliers', [lista('outliers', 'Vídeos', 120, 20)]))
    const r = await responder({ acao: 'destaques' }, abrir, AGORA)
    expect(r.params.linhas).toBe(50)
    expect(r.params.total).toBe(120)
  })

  it('principal grande demais (200 linhas de 400 caracteres): o responder entrega uma janela com k exato, sem principal_cortada, e oferece a próxima', async () => {
    dobra('canais', sintetico('canais', [lista('canais', 'Os canais acompanhados', 200, 400)]))
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(JSON.stringify(m.captured)).not.toContain('principal_cortada')
    expect(r.params.total).toBe(200)
    expect(r.params.linhas).toBeLessThan(200)
    expect(r.params.linhas).toBe(linhasNoTexto(r.texto, 'Os canais acompanhados'))
    expect(r.params.completa).toBe(false)
    expect(r.texto).toContain(`"a_partir_da_linha":${Number(r.params.linhas) + 1}`)
  })
})

describe('A7a Fatia 1, conserto do parecer (I1, I2, I3, M1, M2), sempre pelo responder', () => {
  const abrir = ABRIDOR_DE_SESSAO
  const dobra = (tela: TelaId, modelo: PacoteModelo) => (m.empacotar[tela] as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ modelo, recente: '13/10/2026 09:10', estado: {} }))
  beforeEach(() => {
    m.captured.length = 0
    for (const t of ['canais', 'outliers', 'mudancas', 'canal', 'canal-proprio']) m.empacotar[t] = vi.fn(async () => null)
  })

  it('I1: 75 canais, 583 dicas: as dicas ficam fora da janela e a Cobertura conta as linhas reais (A7b)', async () => {
    dobra('canais', modeloDe(75))
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(linhasNoTexto(r.texto, 'A dica de cada medida')).toBe(0)
    expect(r.texto).toContain('tabela "A dica de cada medida":')
    expect(r.texto.split('\n').filter((x) => /Dica.*saíram 200/.test(x))).toEqual([])
    expect(r.texto).toMatch(/Notas e dicas: 0 de \d+ linhas; para um canal, peça canal com o Id/)
  })

  it('I1: Dicas sintéticas de 300 linhas: o aviso diz 300 menos o que está no texto', async () => {
    dobra('canais', sintetico('canais', [lista('canais', 'Os canais acompanhados', 70, 100), lista('canais-dicas', 'Dicas', 300, 400)]))
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    const noTexto = linhasNoTexto(r.texto, 'Dicas')
    expect(noTexto).toBeLessThan(200)
    expect(r.texto).not.toMatch(/Dicas.*saíram 200/)
    expect(r.texto).toContain(`tabela "Dicas": ${300 - noTexto} linhas não couberam`)
  })

  it('I2: Mudanças com 40 trocas de 5.000 caracteres: a janela leva as linhas com as descrições delas, nada de principal_cortada', async () => {
    dobra('mudancas', modeloEstresseMudancas())
    const r = await responder({ acao: 'mudancas' }, abrir, AGORA)
    expect(linhasNoTexto(r.texto, 'Trocas de descrição')).toBe(Number(r.params.linhas))
    expect(Number(r.params.linhas)).toBe(40)
    expect(r.params.completa).toBe(false)
    expect(JSON.stringify(m.captured)).not.toContain('principal_cortada')
    expect(r.texto).toContain('descrição nova do vídeo 1')
    expect(r.texto.length).toBeLessThanOrEqual(45_000)
  })

  it('I2 (direto): escolherCorte não passa de E2b e a principal não é cortada', () => {
    const c = escolherCorte(modeloEstresseMudancas(), CONTEXTO, 100, TETO)
    expect(c.estagio).not.toBe('E3')
    expect(c.principalCortada).toBe(false)
  })

  it('I3: E2 que tira a tabela de texto não diz "Por tamanho: nada" e conta em cortes', async () => {
    const mod = (tam: number) => sintetico('canais', [lista('canais', 'Os canais acompanhados', 10, tam), lista('canais-dicas', 'Dicas', 50, 100), lista('canais-referencias', 'Refs', 3, 10)])
    // varre o tamanho das linhas da principal: em toda a faixa em que a tabela inteira sai (E2), o texto tem de dizer o que cortou e o registro tem de contar
    let achou = 0
    // a Cobertura reserva 1.802 do teto (180 por linha de 10), então a faixa do E2 desceu
    for (let tam = 5_000; tam <= 6_100; tam += 2) {
      dobra('canais', mod(tam))
      const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
      if (!r.texto.includes('tabela "Dicas": 50 linhas não couberam')) continue
      achou += 1
      expect(r.texto).not.toContain('Por tamanho: nada')
      expect(r.texto).toContain('cortei')
      expect(r.params.cortes).toBeGreaterThanOrEqual(1)
    }
    expect(achou).toBeGreaterThan(0)
  })

  it('M1/M2: 4 tabelas de texto, varrendo o teto: o número de cada aviso bate com as linhas que estão no texto', () => {
    const textos = [['canais-notas', 'Notas'], ['canais-dicas', 'Dicas'], ['outra-a', 'Geral A'], ['outra-b', 'Geral B']] as const
    const mod = sintetico('canais', [lista('canais', 'Os canais acompanhados', 10, 50), ...textos.map(([id, t]) => lista(id, t, 300, 80))])
    const avisoDaPrincipal = 'há 10 canais; saíram 10, na ordem da tela' // frase de outro tipo no modelo: só o E3 a tira, por identidade
    for (let teto = 3_000; teto <= 40_000; teto += 997) {
      const c = escolherCorte({ ...mod, avisos: ['aviso do empacotador: há 5 coisas; saíram 2'] }, CONTEXTO, 200, teto, undefined, avisoDaPrincipal)
      expect(c.texto.texto).toContain('aviso do empacotador: há 5 coisas; saíram 2') // M2: nunca some por casamento de texto
      for (const [, titulo] of textos.slice(0, 2)) {
        const noTexto = linhasNoTexto(c.texto.texto, titulo)
        const achou = c.texto.texto.match(new RegExp(`tabela "${titulo}": (\\d+) linhas não couberam`))
        if (c.estagio === 'E1' && noTexto < 300) expect(Number(achou?.[1])).toBe(300 - noTexto)
      }
    }
  })
})

describe('A7d T4 (6): com a Cobertura reservada, a principal sai inteira', () => {
  const dobra = (tela: TelaId, modelo: PacoteModelo) => (m.empacotar[tela] as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ modelo, recente: '13/10/2026 09:10', estado: {} }))
  beforeEach(() => { m.captured.length = 0; m.empacotar.canais = vi.fn(async () => null) })
  it('34 canais da fixture: 34 linhas, a seção diz 1–34 de 34 e o texto fica no teto', async () => {
    dobra('canais', modeloDe(34))
    const r = await responder({ acao: 'listar_canais' }, ABRIDOR_DE_SESSAO, AGORA)
    expect(r.params.linhas).toBe(34)
    expect(r.params.total).toBe(34)
    expect(r.texto.length).toBeLessThanOrEqual(TETO)
    expect(r.texto).toContain('linhas 1–34 de 34')
    expect(r.texto.slice(r.texto.lastIndexOf('\n## Cobertura'))).toContain('Os canais acompanhados')
    expect(JSON.stringify(m.captured)).not.toContain('principal_cortada')
  })
})

describe('A7d Fatia 2 conserto: a linha de apoio e as próximas sobre o empacotador real (ids de forma válida)', () => {
  const dobra = (tela: TelaId, modelo: PacoteModelo) => (m.empacotar[tela] as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ modelo, recente: '13/10/2026 09:10', estado: {} }))
  beforeEach(() => { m.captured.length = 0; m.empacotar.canais = vi.fn(async () => null) })
  /** Os ids da coluna "Id" da principal viram uuids determinísticos (em produção o id é o uuid do banco, não o slug da fixture). */
  const uuid = (i: number): string => `c0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
  function comUuids(mod: PacoteModelo): PacoteModelo {
    return {
      ...mod,
      tabelas: mod.tabelas.map((t) => {
        if (classeDa(mod.tela, t) !== 'principal') return t
        const col = t.colunas.indexOf('Id')
        return { ...t, linhas: t.linhas.map((l, i) => l.map((c, j) => (j === col ? { ...c, texto: uuid(i) } as typeof c : c))) }
      }),
    }
  }
  it('M5: 34 canais: a lista tem a chamada "canal" da linha 1 e nenhum proxima_invalida', async () => {
    dobra('canais', comUuids(modeloDe(34)))
    const r = await responder({ acao: 'listar_canais' }, ABRIDOR_DE_SESSAO, AGORA)
    expect(r.texto).toContain('Próximas chamadas')
    expect(r.texto).toContain(JSON.stringify({ acao: 'canal', canal_id: uuid(0) }))
    expect(r.texto).toContain(JSON.stringify({ acao: 'comparar', canal_ids: [uuid(0), uuid(1)] }))
    expect(JSON.stringify(m.captured)).not.toContain('proxima_invalida')
  })
  it('(d) 75 canais: notas e dicas fora da janela; a Cobertura traz "0 de N" com o N das linhas que a janela teria', async () => {
    dobra('canais', comUuids(modeloDe(75)))
    const r = await responder({ acao: 'listar_canais' }, ABRIDOR_DE_SESSAO, AGORA)
    const secao = r.texto.slice(r.texto.lastIndexOf('\n## Cobertura'))
    const achou = /Notas e dicas: 0 de (\d+) linhas/.exec(secao)
    expect(achou, 'a linha de notas e dicas').not.toBeNull()
    expect(linhasNoTexto(r.texto.slice(0, r.texto.lastIndexOf('\n## Cobertura')), 'Notas de cada canal')).toBe(0)
    expect(Number(achou![1])).toBeGreaterThan(0)
  })
})


/* ------------------------------------------------------------------ A7b T9: a janela da lista */

/** Destaques sintético, com o tamanho de linha do real (10 colunas, título de ~70 caracteres) e 2 avisos de texto por vídeo. */
function destaquesDe(n: number): PacoteModelo {
  const p = (i: number): string => `modelo.groups[0].cards[${i}]`
  const principal: Tabela = {
    id: 'outliers', titulo: 'Os outliers da tela, na ordem da tela', tipo: 'lista', nomeNoCorte: 'tabela de outliers', privada: false,
    colunas: ['Grupo', 'Vídeo', 'Canal', 'Nicho', 'Múltiplo', 'Base do múltiplo', 'Views', 'Views/dia (7 dias)', 'Publicado', 'Duração'],
    linhas: Array.from({ length: n }, (_, i) => [
      rotulo('Longos de 0 a 30 dias', 'modelo.groups[0].label'), terceiros(`Vídeo ${i + 1} ${'t'.repeat(60)}`, `${p(i)}.title`), terceiros(`Canal ${i % 7}`, `${p(i)}.channel`), rotulo('tecnologia', `${p(i)}.nicheLabel`),
      medido('3,2x', 3.2, `${p(i)}.mult`), base('contra 20 vídeos do canal', `${p(i)}.multLabel`), medido('120 mil', 120_000, `${p(i)}.views`), medido('8,1 mil', 8_100, `${p(i)}.vpdShort`), base('12 dias', `${p(i)}.age`), base('10:21', `${p(i)}.dur`),
    ]),
  }
  const avisos: Tabela = {
    id: 'outliers-avisos', titulo: 'Avisos de cada outlier: base, sincronização e explicação', tipo: 'lista', nomeNoCorte: 'tabela de avisos dos outliers', privada: false, colunas: ['Vídeo', 'Aviso'],
    linhas: Array.from({ length: n * 2 }, (_, i) => [terceiros(`Vídeo ${Math.floor(i / 2) + 1} ${'t'.repeat(60)}`, `${p(Math.floor(i / 2))}.title`), base(`aviso ${i} ${'a'.repeat(120)}`, `${p(Math.floor(i / 2))}.flags[${i % 2}]`)]),
  }
  return { ...modeloCheio(), tela: 'outliers', tabelas: [principal, avisos], citados: [], foco: [], definicoes: [], avisos: [] }
}

describe('A7b T9: a janela da lista, pelo responder com o empacotador real', () => {
  const abrir = ABRIDOR_DE_SESSAO
  type Resp = Awaited<ReturnType<typeof responder>>
  const dobra = (tela: TelaId, modelo: PacoteModelo) => (m.empacotar[tela] as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ modelo, recente: '13/10/2026 09:10', estado: {} }))
  beforeEach(() => { m.captured.length = 0; m.montar.n = 0; for (const t of ['canais', 'outliers', 'mudancas']) m.empacotar[t] = vi.fn(async () => null) })
  const PROX = /^- (\{.*\}) : ver a próxima janela/m
  const secaoDe = (t: string): string => t.slice(t.lastIndexOf('\n## Cobertura'))
  const proximaDe = (t: string): Record<string, unknown> | null => { const x = PROX.exec(secaoDe(t)); return x ? (JSON.parse(x[1]!) as Record<string, unknown>) : null }
  const faixa = (t: string): [number, number, number] => { const x = /linhas (\d+)–(\d+) de (\d+)/.exec(secaoDe(t)); return [Number(x?.[1]), Number(x?.[2]), Number(x?.[3])] }
  /** Encadeia pela próxima chamada de cada resposta, como a IA faz. */
  async function lerTudo(entrada: Record<string, unknown>, max = 40): Promise<Resp[]> {
    const out: Resp[] = []
    let e: Record<string, unknown> | null = entrada
    for (let i = 0; i < max && e; i += 1) {
      const r = await responder(e, abrir, AGORA)
      console.info('janela', entrada.acao, i + 1, 'k', r.params.linhas, 'chars', r.texto.length)
      out.push(r)
      e = proximaDe(r.texto)
    }
    return out
  }
  const ks = (rs: Resp[]): number[] => rs.map((r) => Number(r.params.linhas))

  it.each([[34, [34]], [60, [60]], [75, [69, 6]], [200, [69, 68, 63]]] as const)('k medido: %i canais (empacotador real, ia, sem notas e dicas) => %j', async (n, esperado) => {
    dobra('canais', modeloDe(n))
    const rs = await lerTudo({ acao: 'listar_canais' })
    expect(ks(rs)).toEqual(esperado)
    for (const r of rs) expect(r.texto.length).toBeLessThanOrEqual(TETO)
    expect(rs.map((r) => r.params.completa)).toEqual(esperado.map((_, i) => i === esperado.length - 1))
    expect(rs.map((r) => r.params.a_partir_da_linha)).toEqual(esperado.map((_, i) => 1 + esperado.slice(0, i).reduce((a, b) => a + b, 0)))
    expect(JSON.stringify(m.captured)).not.toContain('principal_cortada')
  }, 60_000)

  it('k medido: destaques sintético de 60 e de 212 percorrem todos os vídeos (antes só 50)', async () => {
    dobra('outliers', destaquesDe(60))
    expect(ks(await lerTudo({ acao: 'destaques' }))).toEqual([50, 10])
    dobra('outliers', destaquesDe(212))
    const rs = await lerTudo({ acao: 'destaques' })
    expect(ks(rs)).toEqual([50, 50, 50, 50, 12])
    expect(rs.map((r) => r.params.total)).toEqual([212, 212, 212, 212, 212])
  })

  it('k medido: mudanças (40 trocas de 5.000 caracteres): a janela leva as descrições das suas linhas e encadeia até o fim', async () => {
    dobra('mudancas', modeloEstresseMudancas())
    const rs = await lerTudo({ acao: 'mudancas' })
    // as 40 linhas cabem; as descrições (blocos cortáveis) são aparadas pelo degrau, e a Cobertura diz "cortado por tamanho"
    expect(ks(rs)).toEqual([40])
    expect(rs[0]!.texto).toContain('descrição nova do vídeo 1')
    expect(secaoDe(rs[0]!.texto)).toContain('Cortado por tamanho')
    expect(rs[0]!.texto.length).toBeLessThanOrEqual(45_000)
    expect(rs[0]!.params.sem_dona).toBe(0)
  })

  it('(a) 1.000 linhas: as janelas cobrem 1…1.000 sem buraco nem repetição; busca de k custa ≤ ⌈log₂ n⌉ + 1 montagens (contagem, não relógio)', async () => {
    dobra('canais', sintetico('canais', [lista('canais', 'Os canais acompanhados', 1_000, 500)]))
    const rs = await lerTudo({ acao: 'listar_canais' }, 60)
    const fx = rs.map((r) => faixa(r.texto))
    expect(fx[0]![0]).toBe(1)
    for (let i = 1; i < fx.length; i += 1) expect(fx[i]![0]).toBe(fx[i - 1]![1] + 1)
    expect(fx[fx.length - 1]![1]).toBe(1_000)
    for (const r of rs) expect(r.texto.length).toBeLessThanOrEqual(TETO)
    expect(rs.map((r) => r.params.completa)).toEqual(rs.map((_, i) => i === rs.length - 1))
    // o custo de UMA chamada no meio da lista
    m.montar.n = 0
    const t0 = performance.now()
    await responder({ acao: 'listar_canais', a_partir_da_linha: 301 }, abrir, AGORA)
    console.info('montagens', m.montar.n, 'ms', Math.round(performance.now() - t0))
    expect(m.montar.n).toBeLessThanOrEqual(Math.ceil(Math.log2(200)) + 1)
  }, 120_000)

  it('(b) 60 canais da fixture: cada linha da janela leva as suas colunas e nenhuma coluna de canal de fora', async () => {
    const mod = modeloDe(200)
    dobra('canais', mod)
    const r = await responder({ acao: 'listar_canais', a_partir_da_linha: 70 }, abrir, AGORA)
    const nomes = (t: Tabela): string[] => t.linhas.map((l) => (l.find((c) => c.papel === 'terceiros') as { texto: string }).texto)
    const principal = mod.tabelas.find((t) => t.id === 'canais')!
    const k = Number(r.params.linhas)
    const daJanela = new Set(nomes({ ...principal, linhas: principal.linhas.slice(69, 69 + k) }))
    const antes = new Set(nomes({ ...principal, linhas: principal.linhas.slice(0, 69) }))
    const corpo = r.texto.slice(0, r.texto.lastIndexOf('\n## Cobertura'))
    const linhasDe = (titulo: string): string[] => { const l = corpo.split('\n'); const i = l.findIndex((x) => x.startsWith(`### ${titulo}`)); if (i < 0) return []; const o: string[] = []; for (let j = i + 3; l[j]?.startsWith('| '); j += 1) o.push(l[j]!); return o }
    const colunas = linhasDe('O nicho de cada canal')
    expect(colunas.length).toBeGreaterThan(0)
    for (const l of colunas) {
      const nome = [...daJanela].find((x) => l.includes(x))
      expect(nome, l.slice(0, 80)).toBeDefined()
      for (const a of antes) expect(l.includes(a) && !daJanela.has(a) && !l.includes([...daJanela].find((x) => l.includes(x))!)).toBe(false)
    }
    expect(k).toBe(68)
  }, 60_000)

  it('(c) linha de apoio sem dona: só na janela 1 e contada em sem_dona', async () => {
    const mod = modeloDe(200)
    const nicho = mod.tabelas.find((t) => t.id === 'canais-nicho')!
    const orfa = nicho.linhas[0]!.map((c) => (c.papel === 'terceiros' ? { ...c, origem: 'sem.dono' } : c))
    dobra('canais', { ...mod, tabelas: mod.tabelas.map((t) => (t.id === 'canais-nicho' ? { ...t, linhas: [...t.linhas, orfa] } : t)) })
    const [a, b] = await lerTudo({ acao: 'listar_canais' })
    expect(a!.params.sem_dona).toBe(1)
    expect(secaoDe(a!.texto)).toContain('1 linhas sem dona')
    expect(b!.params.sem_dona).toBe(0)
  }, 60_000)

  it('(d) a_partir_da_linha: 99 numa lista de 34: pedido_invalido com a frase e o campo', async () => {
    dobra('canais', modeloDe(34))
    const r = await responder({ acao: 'listar_canais', a_partir_da_linha: 99 }, abrir, AGORA)
    expect(r.desfecho).toBe('pedido_invalido')
    expect(r.texto).toContain('a_partir_da_linha: a lista tem 34 linhas agora; use de 1 a 34')
    expect(r.params.campos_invalidos).toEqual(['a_partir_da_linha'])
  })

  it('(e) lista vazia com a_partir_da_linha: 1: ok e "0 de 0"', async () => {
    dobra('canais', sintetico('canais', [lista('canais', 'Os canais acompanhados', 0, 10)]))
    const r = await responder({ acao: 'listar_canais', a_partir_da_linha: 1 }, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(secaoDe(r.texto)).toContain('0 de 0 linhas')
  })

  it('(f) tabela geral só na janela 1; resumo-da-tela em todas', async () => {
    const fixa: Tabela = { id: 'canais-resumo-direcao', titulo: 'Resumo fixo', tipo: 'fixa', nomeNoCorte: 'resumo', privada: false, colunas: ['Direção', 'Canais'], linhas: [[rotulo('sobem', 'r.a'), medido('3', 3, 'r.b')]] }
    dobra('canais', sintetico('canais', [fixa, lista('canais', 'Os canais acompanhados', 300, 500), lista('tabela-geral', 'Tabela geral', 4, 10)]))
    const rs = await lerTudo({ acao: 'listar_canais' })
    expect(rs.length).toBeGreaterThan(1)
    expect(rs[0]!.texto).toContain('### Tabela geral')
    for (const r of rs.slice(1)) expect(r.texto).not.toContain('### Tabela geral')
    for (const r of rs) expect(r.texto).toContain('### Resumo fixo')
  })

  it('(h) o dado muda entre janelas: a marca diz; sem marca, sem a frase', async () => {
    const original = sintetico('canais', [lista('canais', 'Os canais acompanhados', 300, 500)])
    dobra('canais', original)
    const w1 = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    const prox = proximaDe(w1.texto)!
    expect(typeof prox.marca).toBe('string')
    expect(w1.texto).toContain('Lida às 14:32')
    const principal = original.tabelas[0]!
    // uma linha saiu e outra mudou de posição
    dobra('canais', { ...original, tabelas: [{ ...principal, linhas: [principal.linhas[1]!, principal.linhas[0]!, ...principal.linhas.slice(3)] }] })
    const w2 = await responder(prox, abrir, AGORA)
    expect(secaoDe(w2.texto).split('\n')[2]).toContain('A lista mudou')
    expect(w2.params.completa).toBe(false)
    expect(w2.params.marca_mudou).toBe(true)
    const sem = await responder({ acao: 'listar_canais', a_partir_da_linha: prox.a_partir_da_linha }, abrir, AGORA)
    expect(secaoDe(sem.texto)).not.toContain('A lista mudou')
    expect(sem.params).not.toHaveProperty('marca_mudou')
    // a marca igual: sem a frase, marca_mudou falso
    dobra('canais', original)
    const igual = await responder(prox, abrir, AGORA)
    expect(secaoDe(igual.texto)).not.toContain('A lista mudou')
    expect(igual.params.marca_mudou).toBe(false)
  })

  it('(i) último recurso: uma linha de 70.000 caracteres: linha_nao_cabe e o texto ≤ 60.000', async () => {
    dobra('canais', sintetico('canais', [lista('canais', 'Os canais acompanhados', 3, 70_000)]))
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(JSON.stringify(m.captured)).toContain('linha_nao_cabe')
    expect(r.texto.length).toBeLessThanOrEqual(TETO)
  })

  it('(j) destaques com 120 linhas: janelas 1–50, 51–100, 101–120 e total 120 nas três', async () => {
    dobra('outliers', sintetico('outliers', [lista('outliers', 'Vídeos', 120, 20)]))
    const rs = await lerTudo({ acao: 'destaques' })
    expect(rs.map((r) => faixa(r.texto))).toEqual([[1, 50, 120], [51, 100, 120], [101, 120, 120]])
    expect(rs.map((r) => r.params.total)).toEqual([120, 120, 120])
    expect(rs.map((r) => r.params.cortes)).toEqual([0, 0, 0])
  })

  it('(k) por nome: na janela 2 saem as referências e inscritos dos canais dela e só deles; nome repetido vai à janela 1 em sem_dona', async () => {
    const mod = modeloDe(200)
    dobra('canais', mod)
    const r2 = await responder({ acao: 'listar_canais', a_partir_da_linha: 70 }, abrir, AGORA)
    const principal = mod.tabelas.find((t) => t.id === 'canais')!
    const nome = (l: readonly { papel: string; texto?: string }[]): string => (l.find((c) => c.papel === 'terceiros') as { texto: string }).texto
    const k = Number(r2.params.linhas)
    const dela = principal.linhas.slice(69, 69 + k).map(nome)
    const antes = principal.linhas.slice(0, 69).map(nome)
    const corpo = r2.texto.slice(0, r2.texto.lastIndexOf('\n## Cobertura'))
    const l = corpo.split('\n')
    const i = l.findIndex((x) => x.startsWith('### Referências: o vídeo típico'))
    expect(i).toBeGreaterThan(-1)
    const linhasRef: string[] = []
    for (let j = i + 3; l[j]?.startsWith('| '); j += 1) linhasRef.push(l[j]!)
    expect(linhasRef.length).toBe(k)
    for (const n of dela) expect(linhasRef.some((x) => x.includes(n)), n).toBe(true)
    const celulas = (ln: string): string[] => ln.split('|').map((c) => c.trim())
    for (const n of antes.filter((x) => !dela.includes(x))) expect(linhasRef.some((x) => celulas(x).includes(n)), n).toBe(false)
    // dois canais com o mesmo nome: as linhas por nome deles vão para a janela 1 e contam em sem_dona
    const nomeA = nome(principal.linhas[0]!)
    const repetido = { ...mod, tabelas: mod.tabelas.map((t) => (t.id === 'canais' ? { ...t, linhas: t.linhas.map((ln, ix) => (ix === 1 ? ln.map((c) => (c.papel === 'terceiros' ? { ...c, texto: nomeA } : c)) : ln)) } : t)) }
    dobra('canais', repetido)
    const w1 = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(Number(w1.params.sem_dona)).toBeGreaterThanOrEqual(2)
  }, 60_000)

  it('(m) notas e dicas não mexem em k: 60 canais com 300 dicas e 140 notas a mais dão o mesmo k; a Cobertura diz "0 de N"', async () => {
    const mod = modeloDe(200)
    const sem: PacoteModelo = { ...mod, tabelas: mod.tabelas.filter((t) => t.id !== 'canais-dicas' && t.id !== 'canais-notas') }
    const dobro = (id: string, extra: number): PacoteModelo => ({ ...mod, tabelas: mod.tabelas.map((t) => (t.id === id ? { ...t, linhas: [...t.linhas, ...Array.from({ length: extra }, (_, i) => t.linhas[i % t.linhas.length]!)] } : t)) })
    const com = { ...dobro('canais-notas', 140), tabelas: dobro('canais-dicas', 300).tabelas.map((t) => (t.id === 'canais-notas' ? dobro('canais-notas', 140).tabelas.find((x) => x.id === 'canais-notas')! : t)) }
    dobra('canais', sem)
    const a = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    dobra('canais', com)
    const b = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(a.params.linhas).toBe(69)
    expect(b.params.linhas).toBe(69)
    expect(a.texto).not.toContain('### A dica de cada medida')
    expect(b.texto).not.toContain('### A dica de cada medida')
    expect(secaoDe(a.texto)).not.toContain('Notas e dicas')
    expect(secaoDe(b.texto)).toMatch(/Notas e dicas: 0 de \d+ linhas; para um canal, peça canal com o Id/)
  }, 60_000)
})

/* ------------------------------------------------------------------ A7b Fatia 4, rodada 2 (parecer do Yannis: B1, I1, I2, I3) */

describe('A7b Fatia 4 rodada 2: o texto das tabelas acompanha a janela; só notas e dicas de Canais ficam fora', () => {
  const abrir = ABRIDOR_DE_SESSAO
  type Resp = Awaited<ReturnType<typeof responder>>
  const dobra = (tela: TelaId, modelo: PacoteModelo) => (m.empacotar[tela] as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ modelo, recente: '13/10/2026 09:10', estado: {} }))
  beforeEach(() => { m.captured.length = 0; m.montar.n = 0; for (const t of ['canais', 'outliers', 'mudancas']) m.empacotar[t] = vi.fn(async () => null) })
  const PROX = /^- (\{.*\}) : ver a próxima janela/m
  const secaoDe = (t: string): string => t.slice(t.lastIndexOf('\n## Cobertura'))
  const proximaDe = (t: string): Record<string, unknown> | null => { const x = PROX.exec(secaoDe(t)); return x ? (JSON.parse(x[1]!) as Record<string, unknown>) : null }
  async function lerTudo(entrada: Record<string, unknown>, max = 60): Promise<Resp[]> {
    const out: Resp[] = []
    let e: Record<string, unknown> | null = entrada
    for (let i = 0; i < max && e; i += 1) { const r = await responder(e, abrir, AGORA); out.push(r); e = proximaDe(r.texto) }
    return out
  }
  const trocas = (n: number, tamanho: number): PacoteModelo => {
    const principal: Tabela = {
      id: 'trocas', titulo: 'Trocas', tipo: 'lista', nomeNoCorte: 'tabela de trocas', privada: false, colunas: ['Vídeo', 'Quando'],
      linhas: Array.from({ length: n }, (_, i) => [terceiros(`Vídeo ${i}`, `pack.t[${i}].titulo`), medido(`${i}`, i, `pack.t[${i}].quando`)]),
    }
    const titulos: Tabela = {
      id: 'trocas-titulos', titulo: 'Títulos de antes e de depois', tipo: 'lista', nomeNoCorte: 'tabela de títulos', privada: false, colunas: ['Vídeo', 'Depois'],
      linhas: Array.from({ length: n }, (_, i) => [terceiros(`Vídeo ${i}`, `pack.t[${i}].titulo`), terceiros(`DEPOIS-${i}-F ${'d'.repeat(tamanho)}`, `pack.t[${i}].depois`)]),
    }
    return sintetico('mudancas', [principal, titulos])
  }

  it('B1 (a): 3 trocas com títulos: os títulos estão no texto, completa e sem "não couberam"', async () => {
    dobra('mudancas', trocas(3, 200))
    const r = await responder({ acao: 'mudancas' }, abrir, AGORA)
    for (let i = 0; i < 3; i += 1) expect(r.texto).toContain(`DEPOIS-${i}-F`)
    expect(r.params.completa).toBe(true)
    expect(r.texto).not.toContain('não couberam')
  })

  it('B1 (b): 40 trocas de 5.000 caracteres: encadeando, cada título aparece uma vez e cada texto cabe no teto', async () => {
    dobra('mudancas', trocas(40, 5_000))
    const rs = await lerTudo({ acao: 'mudancas' })
    expect(rs.length).toBeGreaterThan(1)
    const todos = rs.map((r) => r.texto).join('\n')
    for (let i = 0; i < 40; i += 1) expect(todos.split(`DEPOIS-${i}-F `).length - 1, `título ${i}`).toBe(1)
    for (const r of rs) expect(r.texto.length).toBeLessThanOrEqual(45_000)
    expect(rs.map((r) => Number(r.params.linhas))).toEqual([8, 8, 8, 8, 8])
    expect(rs.map((r) => r.params.completa)).toEqual([false, false, false, false, true])
  })

  it('B1 (c): Destaques com avisos casando pela origem: o aviso do vídeo 51 só na janela 2', async () => {
    dobra('outliers', destaquesDe(120))
    const rs = await lerTudo({ acao: 'destaques' })
    expect(rs.length).toBe(3)
    expect(rs[0]!.texto).toContain('aviso 0 ')
    expect(rs[0]!.texto).not.toContain('aviso 100 ')
    expect(rs[1]!.texto).toContain('aviso 100 ')
    expect(rs[2]!.texto).not.toContain('aviso 100 ')
  })

  it('B1: quando o texto não cabe, sai antes das colunas (E2t), com aviso verdadeiro e a Cobertura incompleta', async () => {
    dobra('mudancas', trocas(5, 50_000))
    const r = await responder({ acao: 'mudancas' }, abrir, AGORA)
    expect(r.texto).not.toContain('DEPOIS-0-F')
    expect(r.texto).toMatch(/tabela "Títulos de antes e de depois": \d+ linhas não couberam/)
    expect(r.params.completa).toBe(false)
    expect(secaoDe(r.texto)).not.toContain('Você viu tudo')
  })

  it('I1: o geral não coube na janela 1 (E2c): a última janela não diz que viu tudo', async () => {
    dobra('canais', sintetico('canais', [lista('canais', 'Os canais acompanhados', 300, 500), lista('tabela-geral', 'Tabela geral', 1, 70_000)]))
    const rs = await lerTudo({ acao: 'listar_canais' })
    expect(rs.length).toBeGreaterThan(2)
    expect(rs[0]!.texto).not.toContain('### Tabela geral')
    const ult = rs[rs.length - 1]!
    expect(ult.params.completa).toBe(false)
    expect(secaoDe(ult.texto)).not.toContain('Você viu tudo')
  })

  it('R1: o geral não coube na janela 1 e a IA repete a chamada SEM a marca: a última janela não diz que viu tudo', async () => {
    dobra('canais', sintetico('canais', [lista('canais', 'Os canais acompanhados', 300, 500), lista('tabela-geral', 'Tabela geral', 1, 70_000)]))
    let e: Record<string, unknown> | null = { acao: 'listar_canais' }
    const rs: Resp[] = []
    for (let i = 0; i < 60 && e; i += 1) {
      const r = await responder(e, abrir, AGORA)
      rs.push(r)
      const px = proximaDe(r.texto)
      if (px) delete px.marca
      e = px
    }
    expect(rs.length).toBeGreaterThan(2)
    const ult = rs[rs.length - 1]!
    expect(ult.params.completa).toBe(false)
    expect(secaoDe(ult.texto)).not.toContain('Você viu tudo')
    expect(secaoDe(ult.texto)).toContain('sem ela não dá para garantir')
  })

  it('R2: Destaques com texto que não cabe: o apontador não manda para a ação canal', async () => {
    const mod = destaquesDe(5)
    const avisos = mod.tabelas.find((t) => t.id === 'outliers-avisos')!
    dobra('outliers', { ...mod, tabelas: mod.tabelas.map((t) => (t === avisos ? { ...t, linhas: t.linhas.map((l) => [l[0]!, base(`aviso ${'a'.repeat(50_000)}`, 'x.y')]) } : t)) })
    const r = await responder({ acao: 'destaques' }, abrir, AGORA)
    expect(r.texto).toMatch(/tabela "Avisos de cada outlier[^"]*": \d+ linhas não couberam; peça a ação pacote_da_tela com a tela outliers/)
    expect(r.texto).not.toMatch(/Avisos de cada outlier[^\n]*peça a ação canal/)
  })

  it('I1: sem perda em nenhuma janela, a última diz que viu tudo', async () => {
    dobra('canais', sintetico('canais', [lista('canais', 'Os canais acompanhados', 300, 500)]))
    const rs = await lerTudo({ acao: 'listar_canais' })
    expect(rs.at(-1)!.params.completa).toBe(true)
  })

  it('I2: o teto da janela é um só, 45.000, mesmo com 60.000 de teto da ação', async () => {
    dobra('canais', sintetico('canais', [lista('canais', 'Os canais acompanhados', 1_000, 500)]))
    const rs = await lerTudo({ acao: 'listar_canais' })
    for (const r of rs) expect(r.texto.length).toBeLessThanOrEqual(45_000)
    expect(Number(rs[0]!.params.linhas)).toBeGreaterThan(60)
  })

  it('I3: reserva errada (zerada): a busca de k termina em O(log n) montagens e não desce de 1 em 1', async () => {
    // o título da tabela de notas (3.000 caracteres) vai no aviso, que nunca é cortado: o texto real passa do que a reserva zerada previu
    const mod = sintetico('canais', [lista('canais', 'Os canais', 200, 8), lista('canais-notas', 'N'.repeat(3_000), 200, 8), lista('canais-dicas', 'Dicas', 200, 8)])
    const alto = janela(mod, CONTEXTO, 1, 200, 1_000_000, undefined, { reservaPorTexto: 0 })
    const teto = alto.corte.texto.texto.length - 2_000
    m.montar.n = 0
    const j = janela(mod, CONTEXTO, 1, 200, teto, undefined, { reservaPorTexto: 0 })
    expect(j.k).toBeLessThan(200)
    expect(j.k).toBeGreaterThan(100)
    expect(j.corte.texto.pisoPassou).toBe(false)
    expect(m.montar.n).toBeLessThanOrEqual(2 * (Math.ceil(Math.log2(200)) + 1))
  })

  it('I3: se nem k = 1 cabe com o texto real, tenta o estágio seguinte (E2b: colunas fora) em vez de cortar o fim', async () => {
    const principal = lista('canais', 'Os canais', 5, 10)
    const coluna = lista('canais-nicho', 'O nicho de cada canal', 1, 6_000)
    const notas = lista('canais-notas', 'N'.repeat(1_000), 5, 10)
    const sem = janela(sintetico('canais', [principal, coluna]), CONTEXTO, 1, 1, 1_000_000)
    expect(sem.corte.estagio).toBe('E2')
    const x = sem.corte.texto.texto.length // k = 1, colunas dentro, sem o aviso das notas
    // a reserva (2 x 450) prevê o aviso das notas e a busca acha k = 1; o aviso real (título de 1.000 caracteres, nunca cortado) estoura o teto
    const j = janela(sintetico('canais', [principal, coluna, notas]), CONTEXTO, 1, 1, x + 1_000)
    expect(j.corte.estagio).toBe('E2b')
    expect(j.linhaNaoCabe).toBe(false)
    expect(j.corte.texto.pisoPassou).toBe(false)
  })
})

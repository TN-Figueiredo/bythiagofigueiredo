// @vitest-environment node
/**
 * A7a T2: o corte do acesso pela IA em estágios (a lista principal fica inteira; o corte começa nas notas e dicas).
 * Mundo: o oráculo de `a3World` com N canais concorrentes clonados; o empacotador é o REAL (`empacotarCanais`), não um modelo à mão.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ empacotar: {} as Record<string, ReturnType<typeof import('vitest')['vi']['fn']>>, captured: [] as unknown[] }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => m.captured.push(a), captureException: (...a: unknown[]) => m.captured.push(a) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({ EMPACOTAR: m.empacotar }))
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { a3World } from './a3-fixture'
import { medidasDoOraculo } from './canais-e5a-fixture'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { buildRiView } from '@/app/cms/(authed)/youtube/competitors/_canais/ri-model'
import { empacotarCanais, modeloDeCanais } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canais'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import type { PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { AGORA, CONTEXTO, medido, modeloCheio, modeloEstresseMudancas, terceiros } from './contexto-ia-fixture'
import { CLASSES_NA_IA, classeDa, escolherCorte, fixarLinhas } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/corte-da-ia'
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

  it('E3 pelo responder: principal grande demais corta, conta em cortes e avisa principal_cortada', async () => {
    dobra('canais', sintetico('canais', [lista('canais', 'Os canais acompanhados', 200, 400)]))
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(JSON.stringify(m.captured)).toContain('principal_cortada')
    expect(r.params.cortes).toBeGreaterThanOrEqual(1)
    expect(r.params.total).toBe(200)
    expect(r.params.linhas).toBeLessThan(200)
    expect(r.params.linhas).toBe(linhasNoTexto(r.texto, 'Os canais acompanhados'))
  })
})

describe('A7a Fatia 1, conserto do parecer (I1, I2, I3, M1, M2), sempre pelo responder', () => {
  const abrir = ABRIDOR_DE_SESSAO
  const dobra = (tela: TelaId, modelo: PacoteModelo) => (m.empacotar[tela] as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ modelo, recente: '13/10/2026 09:10', estado: {} }))
  beforeEach(() => {
    m.captured.length = 0
    for (const t of ['canais', 'outliers', 'mudancas', 'canal', 'canal-proprio']) m.empacotar[t] = vi.fn(async () => null)
  })

  it('I1: 75 canais, 583 dicas: o aviso conta as linhas reais que não couberam, nunca "saíram 200"', async () => {
    dobra('canais', modeloDe(75))
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    const noTexto = linhasNoTexto(r.texto, 'A dica de cada medida')
    expect(noTexto).toBe(50)
    expect(r.texto.split('\n').filter((x) => /Dica.*saíram 200/.test(x))).toEqual([])
    expect(r.texto).toContain(`tabela "A dica de cada medida": ${583 - noTexto} linhas não couberam`)
  })

  it('I1: Dicas sintéticas de 300 linhas: o aviso diz 300 menos o que está no texto', async () => {
    dobra('canais', sintetico('canais', [lista('canais', 'Os canais acompanhados', 70, 100), lista('canais-dicas', 'Dicas', 300, 400)]))
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    const noTexto = linhasNoTexto(r.texto, 'Dicas')
    expect(noTexto).toBeLessThan(200)
    expect(r.texto).not.toMatch(/Dicas.*saíram 200/)
    expect(r.texto).toContain(`tabela "Dicas": ${300 - noTexto} linhas não couberam`)
  })

  it('I2: Mudanças com 40 trocas de 5.000 caracteres: a principal fica inteira, as descrições é que saem', async () => {
    dobra('mudancas', modeloEstresseMudancas())
    const r = await responder({ acao: 'mudancas' }, abrir, AGORA)
    expect(linhasNoTexto(r.texto, 'Trocas de descrição')).toBe(40)
    expect(JSON.stringify(m.captured)).not.toContain('principal_cortada')
    expect(r.texto).toContain('descrições')
    expect(r.texto.length).toBeLessThanOrEqual(TETO)
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
  it('(d) 75 canais: o número "saiu" de "Notas de cada canal" em Tabelas de apoio é o que está no texto', async () => {
    dobra('canais', comUuids(modeloDe(75)))
    const r = await responder({ acao: 'listar_canais' }, ABRIDOR_DE_SESSAO, AGORA)
    const secao = r.texto.slice(r.texto.lastIndexOf('\n## Cobertura'))
    const achou = /"Notas de cada canal" \((\d+) de (\d+) linhas\)/.exec(secao)
    expect(achou, 'a linha de apoio cita as notas').not.toBeNull()
    const noTexto = linhasNoTexto(r.texto.slice(0, r.texto.lastIndexOf('\n## Cobertura')), 'Notas de cada canal')
    expect(Number(achou![1])).toBe(noTexto)
    expect(Number(achou![2])).toBeGreaterThan(noTexto)
  })
})

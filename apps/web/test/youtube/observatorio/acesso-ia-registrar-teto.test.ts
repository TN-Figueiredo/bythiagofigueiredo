// @vitest-environment node
// A4 T2: o teto de 1.024 B para `params` em toda ação, o corte determinístico e as formas das chaves da `consultar`.
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { CHAVES_COM_FORMA_DE_PARAMS, FORMA_DOS_PARAMS, TETO_DOS_PARAMS_B, filtrarParams, registrarAcessoDaChave } from '@/lib/youtube/observatorio/acesso-ia/registrar'
import { METRICAS_DA_CONSULTA } from '@/lib/youtube/observatorio/consulta/catalogo'
import { fabricarProva } from '@/lib/youtube/observatorio/acesso-ia/prova'
import { paramsDaEntrada } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'

const UUID = (i: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`
const grava = async (params: Record<string, unknown>) => {
  const linhas: Array<Record<string, unknown>> = []
  const sb = { from: () => ({ insert: (l: Record<string, unknown>) => { linhas.push(l); return { abortSignal: async () => ({ error: null }) } } }) }
  const r = await registrarAcessoDaChave(sb as never, { prova: fabricarProva('s', 'u', 'k', new Date(Date.now() + 86_400_000).toISOString()), acao: 'destaques', params: { desfecho: 'ok', ...params } as never, incluiuPrivado: false, caracteres: 10, resultado: 'ok' })
  expect(r.ok).toBe(true)
  return linhas[0]!.params as Record<string, unknown>
}
const PIOR = {
  acao: 'destaques', desfecho: 'ok', entidade: 'video', lugar: 'local:vn-hanoi', janela_idade: ['0-30', '31-90', '91-180', '181-365', '365+'],
  publicado_de: '2026-01-01', publicado_ate: '2026-10-31', metricas: ['views', 'likes', 'comentarios', 'vpd7', 'multiplicador', 'engajamento', 'inscritos', 'views'],
  ordenar_por: 'multiplicador', direcao: 'desc', limite: 50, incluir_base_fraca: true, saida: 'tabela',
  canal_ids: Array.from({ length: 6 }, (_, i) => UUID(i)), campos_invalidos: ['canal_id', 'video_id', 'formato', 'janela', 'nicho', 'grao'],
  parametros: Array.from({ length: 3 }, (_, i) => `${String.fromCharCode(97 + i).repeat(10)}=${'v'.repeat(40)}`), linhas: 50, total: 50, elegiveis: 400, cortadas: 350, sem_lugar_calculado: 3, ms: 1234,
  dados_de: '2026-11-10T14', nao_medidos: { views: 1, likes: 99999, comentarios: 2, vpd7: 3, multiplicador: 4, engajamento: 5, inscritos: 6 },
}

const ENV_ORIGINAL = process.env.VERCEL_ENV
afterEach(() => { if (ENV_ORIGINAL === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = ENV_ORIGINAL })

describe('A4 T2: teto de 1 KB', () => {
  it('(a) pior caso cabe, avisa e mantém as protegidas', async () => {
    expect(JSON.stringify({ ...PIOR, ambiente: 'production' }).length).toBeGreaterThan(800)
    const p = await grava(PIOR)
    expect(JSON.stringify(p).length).toBeLessThanOrEqual(TETO_DOS_PARAMS_B)
    expect(p.params_cortado).toBe(true)
    expect(p).toMatchObject({ acao: 'destaques', desfecho: 'ok', lugar: 'local:vn-hanoi', n_canais: 6, linhas: 50, total: 50, elegiveis: 400, cortadas: 350 })
    expect(p).not.toHaveProperty('metricas')
    expect(p.n_metricas).toBe(8)
  })
  it('(b) pedido pequeno não leva params_cortado nem altera o tipo das chaves', async () => {
    const p = await grava({ acao: 'destaques', metricas: ['views'], canal_ids: [UUID(1)], janela_idade: '0-30', limite: 20, incluir_base_fraca: false })
    expect(p).not.toHaveProperty('params_cortado')
    expect(p).toMatchObject({ metricas: ['views'], canal_ids: [UUID(1)], janela_idade: '0-30', limite: 20, incluir_base_fraca: false })
  })
  it('(b2) o chamador não escreve params_cortado', async () => {
    expect(await grava({ params_cortado: true })).not.toHaveProperty('params_cortado')
  })
  it('(e) 12 pares de 97 B + 6 campos_invalidos: cabe, parametros vira n_pares=12', async () => {
    const parametros = Array.from({ length: 12 }, (_, i) => `${String.fromCharCode(97 + i).repeat(32)}=${String(i).padStart(2, '0').repeat(32)}`)
    expect(parametros[0]!.length).toBe(97)
    const campos = ['canal_id', 'video_id', 'formato', 'janela', 'nicho', 'grao']
    const p = await grava({ acao: 'pacote_da_tela', tela: 'canais', parametros, campos_invalidos: campos, linhas: 3, total: 3 })
    expect(JSON.stringify(p).length).toBeLessThanOrEqual(TETO_DOS_PARAMS_B)
    expect(p.params_cortado).toBe(true)
    expect(p.parametros).toEqual(['n_pares=12'])
    expect(p).toMatchObject({ acao: 'pacote_da_tela', desfecho: 'ok', linhas: 3, total: 3 })
    expect((p.campos_invalidos as string[]).length).toBe(6)
  })
  it('os degraus agem em ordem: metricas, canal_ids, janela_idade, parametros', () => {
    const par = (i: number) => `${String.fromCharCode(97 + i).repeat(10)}=${'v'.repeat(40)}`
    const vistos = new Set<string>()
    for (let n = 0; n <= 12; n++) {
      const { params, cortado } = filtrarParams({ ...PIOR, parametros: n === 0 ? undefined : Array.from({ length: n }, (_, i) => par(i)) })
      if (!cortado) continue
      expect(JSON.stringify({ ...params, ambiente: 'local' }).length).toBeLessThanOrEqual(TETO_DOS_PARAMS_B)
      const faixas = params.n_faixas !== undefined
      const pares = Array.isArray(params.parametros) && params.parametros[0]!.startsWith('n_pares=')
      if (faixas && !pares) vistos.add('3')
      if (pares) { vistos.add('4'); expect(faixas).toBe(true); expect(params.n_faixas).toBe(5); expect(params.n_canais).toBe(6); expect(params.n_metricas).toBe(8); expect(params.parametros).toEqual([`n_pares=${n}`]) }
      if (!faixas) { vistos.add('1-2'); expect(params.janela_idade).toEqual(PIOR.janela_idade); expect(params.n_metricas).toBe(8) }
    }
    expect([...vistos].sort()).toEqual(['1-2', '3', '4'])
  })
  it('(f) propriedade: 200 entradas válidas aleatórias nunca passam de 1.024 e toda chave mantém a própria forma', () => {
    process.env.VERCEL_ENV = 'production' // a chave `ambiente` mais longa: o corte mede com a mesma que a linha leva
    let seed = 7
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
    const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!
    const faixas = ['0-30', '31-90', '91-180', '181-365', '365+']
    const mets = ['views', 'likes', 'comentarios', 'vpd7', 'multiplicador', 'engajamento', 'inscritos']
    for (let i = 0; i < 200; i++) {
      const e: Record<string, unknown> = { acao: 'destaques', desfecho: pick(['ok', 'pedido_invalido']) }
      if (rnd() < 0.8) e.canal_ids = Array.from({ length: 1 + Math.floor(rnd() * 6) }, (_, j) => (rnd() < 0.5 ? UUID(j + i) : `UC${'a1B_-'.repeat(5)}${'xy'}`))
      if (rnd() < 0.8) e.metricas = Array.from({ length: 1 + Math.floor(rnd() * 8) }, () => pick(mets))
      if (rnd() < 0.7) e.janela_idade = rnd() < 0.5 ? pick(faixas) : faixas.slice(0, 1 + Math.floor(rnd() * 5))
      if (rnd() < 0.5) e.lugar = pick(['pais:VN', 'local:vn-hanoi', 'local:br-sao-paulo'])
      if (rnd() < 0.5) e.parametros = Array.from({ length: Math.floor(rnd() * 13) }, (_, j) => `${String.fromCharCode(97 + j).repeat(1 + Math.floor(rnd() * 32))}=${'z'.repeat(1 + Math.floor(rnd() * 64))}`)
      if (rnd() < 0.5) e.campos_invalidos = ['canal_id', 'video_id', 'formato', 'janela', 'nicho', 'grao']
      if (rnd() < 0.5) e.nao_medidos = Object.fromEntries(mets.map((m) => [m, Math.floor(rnd() * 99999)]))
      for (const k of ['limite', 'elegiveis', 'cortadas', 'linhas', 'total', 'ms']) if (rnd() < 0.6) e[k] = 1 + Math.floor(rnd() * 50)
      const { params } = filtrarParams(e)
      expect(JSON.stringify({ ...params, ambiente: process.env.VERCEL_ENV }).length).toBeLessThanOrEqual(TETO_DOS_PARAMS_B)
      for (const [k, v] of Object.entries(params)) {
        if (k === 'params_cortado') continue
        expect(FORMA_DOS_PARAMS[k]!(v), k).not.toBeUndefined()
      }
    }
  })
  it('(f2) sem VERCEL_ENV a linha leva ambiente "local"', async () => {
    delete process.env.VERCEL_ENV
    const linhas: Array<Record<string, unknown>> = []
    const sb = { from: () => ({ insert: (l: Record<string, unknown>) => { linhas.push(l); return { abortSignal: async () => ({ error: null }) } } }) }
    await registrarAcessoDaChave(sb as never, { prova: fabricarProva('s', 'u', 'k', new Date(Date.now() + 86_400_000).toISOString()), acao: 'destaques', params: { desfecho: 'ok' } as never, incluiuPrivado: false, caracteres: 1, resultado: 'ok' } as never)
    expect((linhas[0]!.params as Record<string, unknown>).ambiente).toBe('local')
  })
  it('(f3) M1: n_canais que o chamador já trouxe não é sobrescrito pelo degrau', async () => {
    const p = await grava({ ...PIOR, n_canais: 9 })
    expect(p.params_cortado).toBe(true)
    expect(p.n_canais).toBe(9)
    expect(p).not.toHaveProperty('canal_ids')
  })
  it('(g) nao_medidos: chave fora do catálogo é descartada, valor fora de 0–99999 também', async () => {
    const p = await grava({ nao_medidos: { views: 3, texto_livre: 1, likes: 100000, vpd7: -1, engajamento: 2.5 } })
    expect(p.nao_medidos).toEqual({ views: 3 })
    expect(await grava({ nao_medidos: { qualquer: 1 } })).not.toHaveProperty('nao_medidos')
  })
})

describe('A4 T2: formas das chaves da consultar', () => {
  it('chaves novas têm forma', () => {
    for (const k of ['entidade', 'lugar', 'janela_idade', 'publicado_de', 'publicado_ate', 'metricas', 'ordenar_por', 'direcao', 'limite', 'incluir_base_fraca', 'elegiveis', 'cortadas', 'sem_lugar_calculado', 'dados_de', 'params_cortado', 'nao_medidos', 'n_metricas', 'n_faixas', 'n_canais', 'resposta_sha256']) expect(CHAVES_COM_FORMA_DE_PARAMS, k).toContain(k)
  })
  it('valores fora da forma saem', async () => {
    const ruim = await grava({ lugar: 'Hanoi Vietnam', janela_idade: ['0-30', 'qualquer'], publicado_de: '2026-02-30', limite: 51, incluir_base_fraca: 'sim', dados_de: '2026-11-10', direcao: 'cima', metricas: Array.from({ length: 9 }, () => 'views') })
    for (const k of ['lugar', 'janela_idade', 'publicado_de', 'limite', 'incluir_base_fraca', 'dados_de', 'direcao', 'metricas']) expect(ruim, k).not.toHaveProperty(k)
    const ok = await grava({ lugar: 'pais:VN', publicado_de: '2026-10-01', limite: 1, dados_de: '2026-11-10T14', direcao: 'asc' })
    expect(ok).toMatchObject({ lugar: 'pais:VN', publicado_de: '2026-10-01', limite: 1, dados_de: '2026-11-10T14', direcao: 'asc' })
    expect(await grava({ limite: 0 })).not.toHaveProperty('limite')
  })
  it('elegiveis e total gravam o mesmo valor (m13) e `comentarios` na consultar não é chave', async () => {
    const p = await grava({ total: 40, elegiveis: 40 })
    expect(p.total).toBe(p.elegiveis)
    expect(await grava({ comentarios: 5, metricas: ['comentarios'] })).not.toHaveProperty('comentarios')
  })
})

describe('A4 R1 revisão I1: lista fechada em entidade, metricas e ordenar_por', () => {
  it('palavra livre não entra; valor do catálogo entra', async () => {
    const ruim = await grava({ entidade: 'joaosilva', metricas: ['senha_do_joao'], ordenar_por: 'x' })
    for (const k of ['entidade', 'metricas', 'ordenar_por']) expect(ruim, k).not.toHaveProperty(k)
    const misto = await grava({ metricas: ['vpd7', 'senha_do_joao'] })
    expect(misto).not.toHaveProperty('metricas')
    expect(await grava({ entidade: 'video', metricas: ['vpd7'], ordenar_por: 'vpd7' })).toMatchObject({ entidade: 'video', metricas: ['vpd7'], ordenar_por: 'vpd7' })
    expect(await grava({ entidade: 'comentario' })).not.toHaveProperty('entidade')
  })
  it('a lista de métricas do registro é a do catálogo da consulta', async () => {
    for (const m of Object.keys(METRICAS_DA_CONSULTA)) expect(await grava({ ordenar_por: m }), m).toMatchObject({ ordenar_por: m })
  })
})

describe('A4 T2: paramsDaEntrada copia number e boolean', () => {
  it('(c) limite e incluir_base_fraca mantêm o tipo original', () => {
    expect(paramsDaEntrada({ limite: 20, incluir_base_fraca: true } as never, ['limite', 'incluir_base_fraca'])).toEqual({ limite: 20, incluir_base_fraca: true })
    expect(paramsDaEntrada({ limite: 20.5, incluir_base_fraca: {} } as never, ['limite', 'incluir_base_fraca'])).toEqual({})
  })
})

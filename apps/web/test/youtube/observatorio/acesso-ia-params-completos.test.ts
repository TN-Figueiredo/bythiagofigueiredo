// @vitest-environment node
/**
 * I-5 do parecer do Phil: toda chave que `ENTRADA` aceita tem forma em `FORMA_DOS_PARAMS` (senão o registro a jogaria fora em silêncio).
 * Chave nova na entrada sem forma quebra este teste. As formas de `id`, `desde` e `parametros` ficam provadas aqui.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { ENTRADA } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import { CHAVES_COM_FORMA_DE_PARAMS, registrarAcessoDaChave } from '@/lib/youtube/observatorio/acesso-ia/registrar'
import { fabricarProva } from '@/lib/youtube/observatorio/acesso-ia/prova'

describe('FORMA_DOS_PARAMS cobre a ENTRADA', () => {
  it('toda chave de toda ação (menos `acao`, que também tem forma) tem forma', () => {
    const chaves = new Set<string>()
    for (const o of ENTRADA.options) for (const k of Object.keys(o.shape)) chaves.add(k)
    expect(chaves.size).toBeGreaterThan(10)
    const sem = [...chaves].filter((k) => !CHAVES_COM_FORMA_DE_PARAMS.includes(k))
    expect(sem).toEqual([])
  })
  it('as chaves que o responder devolve no registro (`privado`, `comentarios`, `cortes`, `pares`, `linhas`, `total`) têm forma', () => {
    for (const k of ['privado', 'comentarios', 'cortes', 'pares', 'desfecho', 'por', 'linhas', 'total', 'saida', 'sem_x', 'n_canais', 'canais_lidos', 'resposta_sha256']) expect(CHAVES_COM_FORMA_DE_PARAMS).toContain(k)
  })
})

describe('as formas novas', () => {
  it('A7a: linhas e total são contadores; texto, negativo e fração saem', async () => {
    const ok = await inserido({ linhas: 34, total: 120 })
    expect(ok.linhas).toBe(34)
    expect(ok.total).toBe(120)
    const ruim = await inserido({ linhas: 'trinta', total: -1 })
    expect(ruim).not.toHaveProperty('linhas')
    expect(ruim).not.toHaveProperty('total')
  })
  it('A7d: completa é booleano; ms e fora_do_pacote são contadores; texto e negativo saem', async () => {
    const ok = await inserido({ completa: false, ms: 123, fora_do_pacote: 28 })
    expect(ok).toMatchObject({ completa: false, ms: 123, fora_do_pacote: 28 })
    const ruim = await inserido({ completa: 'sim', ms: -4, fora_do_pacote: 'muitos' })
    for (const k of ['completa', 'ms', 'fora_do_pacote']) expect(ruim).not.toHaveProperty(k)
    for (const k of ['completa', 'ms', 'fora_do_pacote']) expect(CHAVES_COM_FORMA_DE_PARAMS).toContain(k)
  })
  const inserido = async (params: Record<string, unknown>) => {
    const linhas: Array<Record<string, unknown>> = []
    const sb = { from: () => ({ insert: (l: Record<string, unknown>) => { linhas.push(l); return { abortSignal: async () => ({ error: null }) } } }) }
    const r = await registrarAcessoDaChave(sb as never, { prova: fabricarProva('site-da-prova', 'user-da-prova', 'key-da-prova', new Date(Date.now() + 86_400_000).toISOString()), acao: 'pacote_da_tela', params: { desfecho: 'ok', ...params } as never, incluiuPrivado: false, caracteres: 10, resultado: 'ok' })
    expect(r.ok).toBe(true)
    return linhas[0]!.params as Record<string, unknown>
  }
  it('id válido passa; id fora de forma sai', async () => {
    expect((await inserido({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })).id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    expect(await inserido({ id: 'texto livre com espaço' })).not.toHaveProperty('id')
  })
  it('desde: data real passa; 2026-02-30 sai', async () => {
    expect((await inserido({ desde: '2026-10-01' })).desde).toBe('2026-10-01')
    expect(await inserido({ desde: '2026-02-30' })).not.toHaveProperty('desde')
  })
  it('parametros: vira lista de k=v ordenada, até 12, e o par fora da forma sai', async () => {
    const p = await inserido({ parametros: { sort: 'views', fmt: 'long', 'Ruim!': 'x', q: 'texto com espaço', age: '0-30,31-90' } })
    expect(p.parametros).toEqual(['age=0-30,31-90', 'fmt=long', 'sort=views'])
    const muitos = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${String.fromCharCode(97 + i)}`, `v${i}`]))
    expect((await inserido({ parametros: muitos })).parametros).toHaveLength(12)
    expect(await inserido({ parametros: { ruim: 'com espaço' } })).not.toHaveProperty('parametros')
    expect(await inserido({ parametros: 'texto' })).not.toHaveProperty('parametros')
  })
  it('M-4: o par descartado deixa a contagem em `parametros_fora`; sem descarte, nada; o chamador não a escreve', async () => {
    const p = await inserido({ parametros: { sort: 'a b', fmt: 'long' } })
    expect(p.parametros).toEqual(['fmt=long'])
    expect(p.parametros_fora).toBe(1)
    const todos = await inserido({ parametros: { ruim: 'com espaço' } })
    expect(todos).not.toHaveProperty('parametros')
    expect(todos.parametros_fora).toBe(1)
    expect(await inserido({ parametros: { fmt: 'long' } })).not.toHaveProperty('parametros_fora')
    expect(await inserido({ parametros_fora: 9 })).not.toHaveProperty('parametros_fora')
  })
  it('parametros_fora tem forma', () => { expect(CHAVES_COM_FORMA_DE_PARAMS).toContain('parametros_fora') })
})

describe('A7b T8: a_partir_da_linha e marca_mudou, sem a marca', () => {
  const grava = async (params: Record<string, unknown>) => {
    const linhas: Array<Record<string, unknown>> = []
    const sb = { from: () => ({ insert: (l: Record<string, unknown>) => { linhas.push(l); return { abortSignal: async () => ({ error: null }) } } }) }
    await registrarAcessoDaChave(sb as never, { prova: fabricarProva('site-da-prova', 'user-da-prova', 'key-da-prova', new Date(Date.now() + 86_400_000).toISOString()), acao: 'listar_canais', params: { desfecho: 'ok', ...params } as never, incluiuPrivado: false, caracteres: 10, resultado: 'ok' })
    return linhas[0]!.params as Record<string, unknown>
  }
  it('a_partir_da_linha é contador >= 1; marca_mudou é booleano; sem_dona é contador; a marca nunca é gravada', async () => {
    const ok = await grava({ a_partir_da_linha: 41, marca_mudou: true, sem_dona: 2, marca: '1a2b3c4d' })
    expect(ok).toMatchObject({ a_partir_da_linha: 41, marca_mudou: true, sem_dona: 2 })
    expect(JSON.stringify(ok)).not.toContain('1a2b3c4d')
    const ruim = await grava({ a_partir_da_linha: 0, marca_mudou: 'sim', sem_dona: -1 })
    for (const k of ['a_partir_da_linha', 'marca_mudou', 'sem_dona']) expect(ruim).not.toHaveProperty(k)
    expect(ok).not.toHaveProperty('marca')
  })
})

// @vitest-environment node
/**
 * A5 · E10, Tarefa 3: a medida do tamanho do banco (`arquivo/medir-tamanho.ts`). O banco é um falso que registra a chamada;
 * o que importa aqui é o que o resultado carrega (só código e número) e o que NÃO acontece (a função não é chamada sem schema).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const captureMessage = vi.hoisted(() => vi.fn())
vi.mock('@sentry/nextjs', () => ({ captureMessage, captureException: vi.fn() }))
vi.mock('@/lib/youtube/competitor-health', async (orig) => ({ ...(await orig<typeof import('@/lib/youtube/competitor-health')>()), schemaTablesReady: vi.fn(async () => null) }))

import { schemaTablesReady } from '@/lib/youtube/competitor-health'
import { MOTIVOS_COMUNS } from '@/lib/youtube/agenda/motivos'
import { rodarTamanhoDoBanco, MOTIVOS_TAMANHO } from '@/lib/youtube/observatorio/arquivo/medir-tamanho'

const MB = 1_048_576
/** 12:00 em São Paulo de um dia qualquer; nada aqui lê o relógio de verdade. */
const AGORA = Date.UTC(2026, 9, 13, 15, 0)
const DIA = '2026-10-13'
const SEGREDO = 'segredo-da-mensagem-do-banco'

type Resposta = { data?: unknown; error?: { message: string; code?: string } | null } | null
const certa = (o: Record<string, unknown> = {}): Resposta => ({
  data: { day: DIA, db_bytes: 216 * MB, competitor_bytes: 41 * MB, own_bytes: 88 * MB, measured_at: new Date(AGORA).toISOString(), ...o },
  error: null,
})

/** `rpc(...).abortSignal(sig)`: devolve a resposta, ou a de cliente abortado se o sinal já estourou (como o Supabase, que não lança). */
function falso(resposta: () => Resposta | Promise<Resposta>) {
  const rpc = vi.fn((nome: string, args: Record<string, unknown>) => ({
    abortSignal: (sinal: AbortSignal) => (sinal.aborted ? Promise.resolve<Resposta>({ error: { message: 'AbortError: aborted', code: '' } }) : Promise.resolve(resposta())),
    nome, args,
  }))
  return { sb: { rpc } as unknown as SupabaseClient, rpc }
}
const rodar = (sb: SupabaseClient) => rodarTamanhoDoBanco({ sb, agora: () => AGORA })

beforeEach(() => { captureMessage.mockClear(); vi.mocked(schemaTablesReady).mockReset(); vi.mocked(schemaTablesReady).mockResolvedValue(null) })
afterEach(() => { vi.restoreAllMocks() })

describe('A5 E10 T3: rodarTamanhoDoBanco', () => {
  it('medida ok: ok, feitas 1, detalhe em MB inteiros; pede o dia do relógio injetado', async () => {
    const { sb, rpc } = falso(() => certa())
    const r = await rodar(sb)
    expect(r).toEqual({ estado: 'ok', feitas: 1, deixadas: 0, detalhe: { db_mb: 216, competitor_mb: 41, own_mb: 88 } })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('obs_db_size_record', { p_now: new Date(AGORA).toISOString() })
    expect(captureMessage).not.toHaveBeenCalled()
    // a guarda olhou a tabela e as cinco colunas, com sinal de tempo
    const [, grupos, opcoes] = vi.mocked(schemaTablesReady).mock.calls[0]!
    expect(grupos).toEqual([['MG6', [['obs_db_size_daily', 'day, db_bytes, competitor_bytes, own_bytes, measured_at']]]])
    expect(opcoes?.signal).toBeInstanceOf(AbortSignal)
  })

  it('tabela ausente: erro schema_ausente, e a função NÃO é chamada', async () => {
    vi.mocked(schemaTablesReady).mockResolvedValue({ tipo: 'ausente', texto: SEGREDO, codigo: '42p01' })
    const { sb, rpc } = falso(() => certa())
    const r = await rodar(sb)
    expect(r).toEqual({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'schema_ausente' })
    expect(rpc).not.toHaveBeenCalled()
    expect(JSON.stringify(r)).not.toContain(SEGREDO)
  })

  it('guarda não conferida (devolve ou lança): erro schema_nao_conferido, e a função NÃO é chamada', async () => {
    vi.mocked(schemaTablesReady).mockResolvedValue({ tipo: 'nao_conferido', texto: SEGREDO, codigo: null })
    const a = falso(() => certa())
    expect(await rodar(a.sb)).toEqual({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'schema_nao_conferido' })
    expect(a.rpc).not.toHaveBeenCalled()
    vi.mocked(schemaTablesReady).mockRejectedValue(new Error(SEGREDO))
    const b = falso(() => certa())
    const r = await rodar(b.sb)
    expect(r).toEqual({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'schema_nao_conferido' })
    expect(b.rpc).not.toHaveBeenCalled()
    expect(JSON.stringify(r) + JSON.stringify(captureMessage.mock.calls)).not.toContain(SEGREDO)
  })

  it('erro do banco e prazo: medida_falhou, sem mensagem do banco no resultado nem no Sentry', async () => {
    const a = falso(() => ({ data: null, error: { message: SEGREDO, code: '57014' } }))
    const ra = await rodar(a.sb)
    expect(ra).toEqual({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'medida_falhou' })
    // chamada pendurada: o sinal de tempo estoura (o prazo é injetado: a espera de verdade seria de 5 s)
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => AbortSignal.abort())
    vi.mocked(schemaTablesReady).mockResolvedValue(null)
    const b = falso(() => certa())
    const rb = await rodar(b.sb)
    expect(rb).toEqual({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'medida_falhou' })
    expect(JSON.stringify([ra, rb]) + JSON.stringify(captureMessage.mock.calls)).not.toContain(SEGREDO)
    expect(captureMessage).toHaveBeenCalledTimes(2)
    for (const [msg] of captureMessage.mock.calls) expect(msg).toMatch(/^tamanho_do_banco: medida_falhou: [a-z0-9_:]+$/)
  })

  it('resposta nula, sem db_bytes, db_bytes 0 e day de outro dia: resposta_invalida nas quatro', async () => {
    const respostas: Resposta[] = [
      { data: null, error: null },
      certa({ db_bytes: undefined }),
      certa({ db_bytes: 0 }),
      certa({ day: '2026-10-12' }),
    ]
    for (const resp of respostas) {
      const { sb } = falso(() => resp)
      expect(await rodar(sb), JSON.stringify(resp)).toEqual({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'resposta_invalida' })
    }
    // e as outras formas que não servem: partes negativas, db_bytes de texto, lista no lugar do objeto
    for (const resp of [certa({ own_bytes: -1 }), certa({ competitor_bytes: null }), certa({ db_bytes: '216' }), { data: [certa().data], error: null }] as Resposta[]) {
      const { sb } = falso(() => resp)
      expect((await rodar(sb)).motivo).toBe('resposta_invalida')
    }
  })

  it('o dia pedido é o civil de São Paulo, mesmo com o UTC já no dia seguinte', async () => {
    const tarde = Date.UTC(2026, 9, 14, 1, 30) // 22:30 de 13/10 em São Paulo
    const { sb } = falso(() => certa())
    const r = await rodarTamanhoDoBanco({ sb, agora: () => tarde })
    expect(r.estado).toBe('ok')
  })

  it('a função lança: inesperado, não propaga, e só o código vai ao Sentry', async () => {
    const sb = { rpc: () => { throw new Error(SEGREDO) } } as unknown as SupabaseClient
    const r = await rodar(sb)
    expect(r).toEqual({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'inesperado' })
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(captureMessage.mock.calls)).not.toContain(SEGREDO)
    const sb2 = { rpc: () => ({ abortSignal: () => Promise.reject(new Error(SEGREDO)) }) } as unknown as SupabaseClient
    expect((await rodar(sb2)).motivo).toBe('inesperado')
  })

  it('todo motivo devolvido tem frase: nos comuns da agenda ou no catálogo desta tarefa (sem ponto final, sem número)', async () => {
    expect(Object.keys(MOTIVOS_TAMANHO).sort()).toEqual(['inesperado', 'medida_falhou', 'resposta_invalida'])
    for (const frase of Object.values(MOTIVOS_TAMANHO)) {
      expect(frase).not.toMatch(/\.$/)
      expect(frase).not.toMatch(/\d/)
    }
    expect(MOTIVOS_COMUNS).toHaveProperty('schema_ausente')
    expect(MOTIVOS_COMUNS).toHaveProperty('schema_nao_conferido')
  })
})

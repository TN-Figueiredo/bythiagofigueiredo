// @vitest-environment node
// As três tarefas desta ordem (A5 E16, Tarefa 12): leitura_horaria, sincronizar_canais, serie_semanal, e o contrato de registro do catálogo.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/competitor-health', async (orig) => ({ ...(await orig<typeof import('@/lib/youtube/competitor-health')>()), schemaTablesReady: vi.fn(async () => null) }))
vi.mock('@/lib/youtube/competitor-sync-batch', async (orig) => ({ ...(await orig<typeof import('@/lib/youtube/competitor-sync-batch')>()), runCompetitorBatch: vi.fn(), runWeeklyPhase: vi.fn() }))
vi.mock('@/lib/youtube/competitor-quota', async (orig) => ({ ...(await orig<typeof import('@/lib/youtube/competitor-quota')>()), recordQuota: vi.fn(async () => undefined) }))
vi.mock('@/lib/youtube/horaria/executar', () => ({ executarLeituraHoraria: vi.fn(async () => ({ estado: 'ok', feitas: 0, deixadas: 0 })) }))

import { schemaTablesReady } from '@/lib/youtube/competitor-health'
import { runCompetitorBatch, runWeeklyPhase, BATCH_BUDGET_MS, type BatchRow, type BatchResult, type WeeklyPhaseResult } from '@/lib/youtube/competitor-sync-batch'
import { recordQuota } from '@/lib/youtube/competitor-quota'
import { executarLeituraHoraria } from '@/lib/youtube/horaria/executar'
import { CATALOGO, DEFINICOES } from '@/lib/youtube/agenda/catalogo'
import { antesDoLoteAntigo } from '@/lib/youtube/agenda/executar'
import { CODIGO_RE, fraseDoMotivo } from '@/lib/youtube/agenda/motivos'
import { LEVE_FIM_MS, PESADA_FIM_MS, BANCO_MS } from '@/lib/youtube/agenda/relogio'
import type { ContextoTarefa, ResultadoTarefa, Tarefa } from '@/lib/youtube/agenda/tipos'

const H = 3_600_000
const SENTINELA = 'Canal X: texto sentinela do YouTube'
const tarefa = (nome: string): Tarefa => {
  const t = CATALOGO.find(x => x.nome === nome)
  if (!t) throw new Error('tarefa ausente do catálogo: ' + nome)
  return t
}
const T0 = Date.parse('2026-10-12T21:10:00Z') // 18:10 em São Paulo
const ctx = (o: Partial<ContextoTarefa> = {}): ContextoTarefa => ({ t0: T0, agora: () => T0, apiKey: 'chave', sb: {} as SupabaseClient, linhas: null, ...o })
const linha = (id: string, o: Partial<BatchRow> = {}): BatchRow => ({
  id, channel_id: 'UC' + id, channel_name: 'Canal ' + id, site_id: 's1', last_synced_at: null, last_ok_synced_at: null, sync_status: null,
  sync_error: null, sync_error_since: null, missing_since: null, weekly_pass_date: null, ...o,
})
const lote = (o: Partial<BatchResult> = {}): BatchResult => ({
  synced: 10, errors: 0, skipped: 0, remainingDue: 0, stoppedForTime: false, siteIds: ['s1'], healthSiteIds: ['s1'],
  totals: {} as BatchResult['totals'], weekly: {} as BatchResult['weekly'], acao_do_dono: [], ownerNotices: { sent: 0, failed: 0 }, ...o,
})
const semanal = (o: Partial<WeeklyPhaseResult> = {}): WeeklyPhaseResult => ({
  ran: true, visited: 3, complete: 3, pending: 0, recorded: 5, deferred: 0, promoted: 0, errors: 0, unitsUsed: 0,
  longWindowChanges: 0, thumbFailed: 0, thumbSkipped: 0, versionFailed: 0, errorsBySite: {}, ...o,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(schemaTablesReady).mockResolvedValue(null)
})

describe('sincronizar_canais', () => {
  const rodar = (c = ctx()): Promise<ResultadoTarefa> => tarefa('sincronizar_canais').rodar(c)

  it('o lote roda sem a fase semanal, com o t0 do disparo e o orçamento do lote', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(lote())
    const r = await rodar()
    expect(vi.mocked(runCompetitorBatch)).toHaveBeenCalledWith({ apiKey: 'chave', batchSize: 15, budgetMs: BATCH_BUDGET_MS, weekly: false, started: T0 })
    expect(r).toMatchObject({ estado: 'ok', feitas: 10, deixadas: 0 })
  })
  it('sobra de canais é parcial, nunca ok (item 214)', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(lote({ remainingDue: 3 }))
    expect(await rodar()).toMatchObject({ estado: 'parcial', motivo: 'sobrou', feitas: 10, deixadas: 3 })
  })
  it('canal pulado por estar ocupado é parcial', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(lote({ skipped: 1, remainingDue: 0 }))
    expect(await rodar()).toMatchObject({ estado: 'parcial', motivo: 'sobrou', deixadas: 1 })
  })
  it('parar por tempo sem sobra também é parcial', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(lote({ stoppedForTime: true }))
    expect(await rodar()).toMatchObject({ estado: 'parcial', deixadas: 0 })
  })
  it('metade dos canais falhou é erro, com a frase do lote na mensagem do cron (pelo fecho), não no motivo', async () => {
    const r5 = lote({ errors: 5, synced: 4 })
    vi.mocked(runCompetitorBatch).mockResolvedValue(r5)
    const r = await rodar()
    expect(r).toMatchObject({ estado: 'erro', motivo: 'lote_em_erro', feitas: 4 })
    expect(r.extra).toBe(r5) // o resumo do lote vai inteiro à resposta
    expect(JSON.stringify({ ...r, extra: undefined })).not.toContain('falharam')
  })
  it('sem a migration (ou sem conseguir conferir): erro antes de chamar o lote, com o código comum', async () => {
    vi.mocked(schemaTablesReady).mockResolvedValueOnce({ tipo: 'ausente', texto: 'migration MG1 ... ' + SENTINELA, codigo: '42P01' })
    expect(await rodar()).toMatchObject({ estado: 'erro', motivo: 'schema_ausente' })
    vi.mocked(schemaTablesReady).mockResolvedValueOnce({ tipo: 'nao_conferido', texto: 'x ' + SENTINELA, codigo: null })
    expect(await rodar()).toMatchObject({ estado: 'erro', motivo: 'schema_nao_conferido' })
    expect(vi.mocked(runCompetitorBatch)).not.toHaveBeenCalled()
    // a guarda leva o sinal do prazo do banco
    expect(vi.mocked(schemaTablesReady).mock.calls[0]![2]?.signal).toBeInstanceOf(AbortSignal)
    expect(BANCO_MS).toBe(5_000)
  })
  it('o detalhe é só número', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(lote({ remainingDue: 2 }))
    const r = await rodar()
    for (const v of Object.values(r.detalhe ?? {})) expect(typeof v).toBe('number')
  })

  describe('devidaPeloDado: a mesma regra do lote (isDue ou firstSyncPending)', () => {
    const devida = (linhas: BatchRow[] | null, agora: number) => tarefa('sincronizar_canais').devidaPeloDado!({ linhas, agora: () => agora })
    it('canal com a primeira sincronização pendente reabre a faixa ok; já sincronizado, não', () => {
      const agora = Date.parse('2026-10-12T22:30:00Z') // 19:30 SP, dentro da faixa das 18 h
      const umMinutoAtras = new Date(agora - 60_000).toISOString()
      // a primeira sincronização parou no meio: `syncing`, last_synced_at de 1 minuto atrás, last_ok_synced_at nulo
      expect(devida([linha('a', { sync_status: 'syncing', last_synced_at: umMinutoAtras, last_ok_synced_at: null })], agora)).toBe(true)
      expect(devida([linha('a', { sync_status: 'ok', last_synced_at: umMinutoAtras, last_ok_synced_at: umMinutoAtras })], agora)).toBe(false)
    })
    it('canal sincronizado antes da faixa é devido; sem as linhas, não é', () => {
      const agora = Date.parse('2026-10-12T22:30:00Z')
      const antes = new Date(Date.parse('2026-10-12T20:00:00Z')).toISOString() // 17:00 SP, antes da faixa das 18
      expect(devida([linha('a', { last_synced_at: antes, last_ok_synced_at: antes, sync_status: 'ok' })], agora)).toBe(true)
      expect(devida(null, agora)).toBe(false)
      expect(devida([], agora)).toBe(false)
    })
    it('canal em erro desde o começo (nunca sincronizou bem) não reabre sozinho dentro da faixa', () => {
      const agora = Date.parse('2026-10-12T22:30:00Z')
      const dentro = new Date(agora - 60_000).toISOString()
      expect(devida([linha('a', { sync_status: 'error', last_synced_at: dentro, last_ok_synced_at: null })], agora)).toBe(false)
    })
  })
})

describe('serie_semanal', () => {
  const rodar = (c = ctx({ linhas: [linha('a')] })): Promise<ResultadoTarefa> => tarefa('serie_semanal').rodar(c)

  it('adiados é parcial; erro sem gravar nada é erro; erro com gravação é parcial com o problema; nada devido é ok', async () => {
    vi.mocked(runWeeklyPhase).mockResolvedValueOnce(semanal({ deferred: 4 }))
    expect(await rodar()).toMatchObject({ estado: 'parcial', motivo: 'sobrou', deixadas: 4, feitas: 5 })
    vi.mocked(runWeeklyPhase).mockResolvedValueOnce(semanal({ errors: 2, recorded: 0 }))
    expect(await rodar()).toMatchObject({ estado: 'erro', motivo: 'semanal_erro', feitas: 0 })
    vi.mocked(runWeeklyPhase).mockResolvedValueOnce(semanal({ errors: 3, recorded: 6, deferred: 1 }))
    const parcial = await rodar()
    expect(parcial).toMatchObject({ estado: 'parcial', motivo: 'semanal_com_erros', feitas: 6, detalhe: { erros: 3 } })
    vi.mocked(runWeeklyPhase).mockResolvedValueOnce(semanal())
    expect(await rodar()).toMatchObject({ estado: 'ok', feitas: 5, deixadas: 0 })
  })
  it('o primeiro erro da semanal vai à resposta (extra), não ao motivo nem ao detalhe', async () => {
    const w = semanal({ errors: 1, recorded: 1, firstError: SENTINELA })
    vi.mocked(runWeeklyPhase).mockResolvedValue(w)
    const r = await rodar()
    expect(r.extra).toBe(w)
    expect(JSON.stringify({ ...r, extra: undefined })).not.toContain('sentinela')
  })
  it('sem as linhas dos canais: erro canais_nao_lidos, e a fase não roda', async () => {
    expect(await rodar(ctx({ linhas: null }))).toMatchObject({ estado: 'erro', motivo: 'canais_nao_lidos' })
    expect(vi.mocked(runWeeklyPhase)).not.toHaveBeenCalled()
  })
  it('a fase corre com o t0 e o relógio do disparo; os erros por site vão para a linha da cota do dia', async () => {
    const agora = () => T0 + 1234
    vi.mocked(runWeeklyPhase).mockResolvedValue(semanal({ errors: 2, recorded: 1, errorsBySite: { s1: 2 } }))
    const sb = {} as SupabaseClient
    await rodar(ctx({ linhas: [linha('a')], agora, sb }))
    expect(vi.mocked(runWeeklyPhase).mock.calls[0]![1]).toMatchObject({ apiKey: 'chave', started: T0, now: agora })
    expect(vi.mocked(recordQuota)).toHaveBeenCalledWith(sb, { siteId: 's1', nowMs: T0 + 1234, units: 0, mode: 'competitors_semanal', extra: { erros_semanal: 2 } })
  })
  it('a cota que não grava não derruba a tarefa', async () => {
    vi.mocked(runWeeklyPhase).mockResolvedValue(semanal({ errors: 1, recorded: 1, errorsBySite: { s1: 1 } }))
    vi.mocked(recordQuota).mockRejectedValueOnce(new Error('banco fora'))
    expect(await rodar()).toMatchObject({ estado: 'parcial', motivo: 'semanal_com_erros' })
  })
  it('a guarda de schema vem antes de qualquer visita', async () => {
    vi.mocked(schemaTablesReady).mockResolvedValueOnce({ tipo: 'nao_conferido', texto: 'x', codigo: null })
    expect(await rodar()).toMatchObject({ estado: 'erro', motivo: 'schema_nao_conferido' })
    expect(vi.mocked(runWeeklyPhase)).not.toHaveBeenCalled()
  })
  it('devidaPeloDado: há canal sem a passada de hoje', () => {
    const agora = Date.now()
    const devida = (linhas: BatchRow[] | null) => tarefa('serie_semanal').devidaPeloDado!({ linhas, agora: () => agora })
    const hojeSP = new Date(agora - 3 * H).toISOString().slice(0, 10)
    expect(devida([linha('a', { weekly_pass_date: hojeSP })])).toBe(false)
    expect(devida([linha('a', { weekly_pass_date: hojeSP }), linha('b', { weekly_pass_date: '2000-01-01' })])).toBe(true)
    expect(devida(null)).toBe(false)
  })
  it('as frases dos motivos da tarefa vêm do catálogo, sem texto de fora', () => {
    expect(fraseDoMotivo(tarefa('serie_semanal'), 'semanal_com_erros')).toBe('série semanal: a passada semanal gravou parte e teve erros')
  })
})

describe('leitura_horaria', () => {
  it('chama a tarefa inteira com o relógio e a chave do disparo, e a guarda confere as três tabelas da MG9 com o prazo do banco', async () => {
    const c = ctx()
    await tarefa('leitura_horaria').rodar(c)
    const arg = vi.mocked(executarLeituraHoraria).mock.calls[0]![0]
    expect(arg).toMatchObject({ sb: c.sb, apiKey: 'chave', t0: T0, agora: c.agora })
    expect(typeof arg.relatar).toBe('function')
    expect(await arg.guarda()).toBeNull()
    const chamada = vi.mocked(schemaTablesReady).mock.calls[0]!
    expect(chamada[1]).toEqual([['MG9', [['competitor_video_hourly', 'video_id'], ['yt_own_public_video_hourly', 'youtube_video_id'], ['yt_own_public_video_early', 'youtube_video_id']]]])
    expect(chamada[2]?.signal).toBeInstanceOf(AbortSignal)
  })
})

describe('o catálogo real e a lista obedecem ao contrato de registro', () => {
  it('nome único e no formato; código de motivo no formato; comecaAteMs < fimAteMs; fimAteMs dentro do teto do peso', () => {
    const nomes = CATALOGO.map(t => t.nome)
    expect(new Set(nomes).size).toBe(nomes.length)
    for (const t of CATALOGO) {
      expect(t.nome, t.nome).toMatch(/^[a-z0-9_]+$/)
      for (const [codigo, frase] of Object.entries(t.motivos)) {
        expect(codigo, t.nome).toMatch(CODIGO_RE)
        expect(frase, t.nome + '.' + codigo).not.toMatch(/[.${}%]\s*$|[${}%]/)
      }
      expect(t.comecaAteMs, t.nome).toBeLessThan(t.fimAteMs)
      expect(t.fimAteMs, t.nome).toBeLessThanOrEqual(t.peso === 'pesada' ? PESADA_FIM_MS : LEVE_FIM_MS)
      expect(typeof t.rodar, t.nome).toBe('function')
    }
  })
  it('o catálogo tem o código das três definições, na mesma ordem', () => {
    expect(CATALOGO.map(t => t.nome)).toEqual(DEFINICOES.map(d => d.nome))
    for (const [i, d] of DEFINICOES.entries()) expect(CATALOGO[i]).toMatchObject({ nome: d.nome, rotulo: d.rotulo, ordem: d.ordem, peso: d.peso, fimAteMs: d.fimAteMs })
  })
  it('toda tarefa da lista é nuncaDesliga com fimAteMs ≤ LEVE_FIM_MS, e o maior da lista também (que é < BATCH_BUDGET_MS)', () => {
    for (const t of antesDoLoteAntigo) {
      expect(t.nuncaDesliga, t.nome).toBe(true)
      expect(t.fimAteMs, t.nome).toBeLessThanOrEqual(LEVE_FIM_MS)
    }
    expect(Math.max(0, ...antesDoLoteAntigo.map(t => t.fimAteMs))).toBeLessThanOrEqual(LEVE_FIM_MS)
    expect(LEVE_FIM_MS).toBeLessThan(BATCH_BUDGET_MS)
  })
})

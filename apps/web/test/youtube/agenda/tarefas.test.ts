// @vitest-environment node
// As três tarefas desta ordem (A5 E16, Tarefa 12): leitura_horaria, sincronizar_canais, serie_semanal, e o contrato de registro do catálogo.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/competitor-health', async (orig) => ({ ...(await orig<typeof import('@/lib/youtube/competitor-health')>()), schemaTablesReady: vi.fn(async () => null) }))
vi.mock('@/lib/youtube/competitor-sync-batch', async (orig) => ({ ...(await orig<typeof import('@/lib/youtube/competitor-sync-batch')>()), runCompetitorBatch: vi.fn(), runWeeklyPhase: vi.fn() }))
vi.mock('@/lib/youtube/competitor-quota', async (orig) => ({ ...(await orig<typeof import('@/lib/youtube/competitor-quota')>()), recordQuota: vi.fn(async () => undefined) }))
vi.mock('@/lib/youtube/horaria/executar', () => ({ executarLeituraHoraria: vi.fn(async () => ({ estado: 'ok', feitas: 0, deixadas: 0 })) }))
// A5 E14 (Tarefa 12): as duas tarefas dos comentários delegam ao módulo de verdade, e o teste troca o retorno quando precisa.
vi.mock('@/lib/youtube/observatorio/comentarios/coletar', async (orig) => {
  const o = await orig<typeof import('@/lib/youtube/observatorio/comentarios/coletar')>()
  return { ...o, runRetratosComentarios: vi.fn(o.runRetratosComentarios) }
})
vi.mock('@/lib/youtube/observatorio/comentarios/anular', async (orig) => {
  const o = await orig<typeof import('@/lib/youtube/observatorio/comentarios/anular')>()
  return { ...o, runAnularIdentidade: vi.fn(o.runAnularIdentidade) }
})
// O estado da agenda (MG10) é um falso controlável: os testes 4 e 5 só precisam do que ele devolve.
vi.mock('@/lib/youtube/agenda/estado', async (orig) => {
  const o = await orig<typeof import('@/lib/youtube/agenda/estado')>()
  return { ...o, lerEstado: vi.fn(), tomar: vi.fn(), fechar: vi.fn(), esgotar: vi.fn() }
})

import { schemaTablesReady } from '@/lib/youtube/competitor-health'
import { runCompetitorBatch, runWeeklyPhase, BATCH_BUDGET_MS, type BatchRow, type BatchResult, type WeeklyPhaseResult } from '@/lib/youtube/competitor-sync-batch'
import { recordQuota } from '@/lib/youtube/competitor-quota'
import { executarLeituraHoraria } from '@/lib/youtube/horaria/executar'
import { CATALOGO, DEFINICOES, tarefasDesligadas } from '@/lib/youtube/agenda/catalogo'
import { TODAS_AS_DEFINICOES } from '@/lib/youtube/agenda/definicoes'
import { antesDoLoteAntigo, rodarAntesDoLoteAntigo } from '@/lib/youtube/agenda/executar'
import { despachar, type OpsAgenda } from '@/lib/youtube/agenda/despachante'
import { lerEstado, tomar, fechar, esgotar } from '@/lib/youtube/agenda/estado'
import { chaveDoPeriodo } from '@/lib/youtube/agenda/periodo'
import { CODIGO_RE, MOTIVOS_COMUNS, codigoDoMotivo, fraseDoMotivo } from '@/lib/youtube/agenda/motivos'
import { LEVE_FIM_MS, LEVE_COMECA_ATE_MS, PESADA_FIM_MS, BANCO_MS, LIMITE_FUNCAO_MS } from '@/lib/youtube/agenda/relogio'
import type { ContextoTarefa, ResultadoTarefa, Tarefa } from '@/lib/youtube/agenda/tipos'
import * as Sentry from '@sentry/nextjs'
import { runRetratosComentarios } from '@/lib/youtube/observatorio/comentarios/coletar'
import { runAnularIdentidade } from '@/lib/youtube/observatorio/comentarios/anular'
import { FRASES_FIXAS, fraseDe } from '@/lib/youtube/observatorio/comentarios/frases'
import { CODIGOS_EXECUCAO, COMMENT_RULES, WORST_END_FROM_T0_MS } from '@/lib/youtube/observatorio/comentarios/regras'
import type { TarefaSaida } from '@/lib/youtube/observatorio/comentarios/tipos'
import { RULES } from '@/lib/youtube/observatorio/rules'

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
  it('o catálogo tem o código das cinco definições da lista única (a do vigia), na mesma ordem', () => {
    expect(CATALOGO.map(t => t.nome)).toEqual(TODAS_AS_DEFINICOES.map(d => d.nome))
    for (const d of TODAS_AS_DEFINICOES) expect(CATALOGO.find(t => t.nome === d.nome)).toMatchObject({ nome: d.nome, rotulo: d.rotulo, ordem: d.ordem, peso: d.peso, fimAteMs: d.fimAteMs, toleranciaVigiaH: d.toleranciaVigiaH, periodo: d.periodo })
    expect(CATALOGO.map(t => t.nome).sort()).toEqual([...DEFINICOES.map(d => d.nome), 'anular_identidade', 'retratos_comentarios'].sort())
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

// ───────────────────────── A5 E14, Tarefa 12: anular_identidade e retratos_comentarios no catálogo ─────────────────────────
describe('E14: as duas tarefas dos comentários de destaque', () => {
  const SENT = 'Fulano Inventado: texto sentinela do comentário'
  const saida = (o: Partial<TarefaSaida> = {}): TarefaSaida => ({ status: 'ok', feitos: 0, ficaram: 0, numeros: {}, ...o })
  const NOMES = ['anular_identidade', 'retratos_comentarios'] as const
  const T0_DIA = Date.parse('2026-10-12T16:00:00Z') // 13:00 em São Paulo; passado fixo
  const chaveDia = chaveDoPeriodo('dia', T0_DIA)
  const estadoVazio = { valor: { agora: new Date(T0_DIA).toISOString(), desde: null, tarefas: [] } }
  const linhaDoDia = (status: 'ok' | 'erro' | 'esgotada' | 'rodando', attempts: number) => ({
    valor: {
      agora: new Date(T0_DIA).toISOString(), desde: null,
      tarefas: [{ task: 'anular_identidade', period_key: chaveDia, status, attempts, runs: attempts, unfinished_n: 0, started_at: null, finished_at: null, done_n: null, left_n: null, reason: null, last_ok_at: null, last_run_status: null, last_run_done_n: null }],
    },
  })
  const ANTES = (caminho: 'interruptor' | 'guarda_mg10') =>
    rodarAntesDoLoteAntigo({ supabase: {} as SupabaseClient, apiKey: 'chave', runId: 'run-1', t0: T0_DIA, caminho, agora: () => T0_DIA })

  beforeEach(() => {
    vi.mocked(Sentry.captureMessage).mockClear()
    vi.mocked(runRetratosComentarios).mockReset().mockResolvedValue(saida())
    vi.mocked(runAnularIdentidade).mockReset().mockResolvedValue(saida({ feitos: 2, numeros: { apagadas: 2 } }))
    vi.mocked(lerEstado).mockReset().mockResolvedValue(estadoVazio)
    vi.mocked(tomar).mockReset().mockResolvedValue({ valor: true })
    vi.mocked(fechar).mockReset().mockResolvedValue({ valor: true })
    vi.mocked(esgotar).mockReset().mockResolvedValue({ valor: false })
    delete process.env.OBS_AGENDA_TASKS_OFF
  })

  // 1
  it('catálogo: as duas tarefas existem, com cada campo da tabela (fimAteMs em milissegundos)', () => {
    const a = tarefa('anular_identidade')
    expect(a).toMatchObject({
      nome: 'anular_identidade', rotulo: 'anular identidade de autores', ordem: 2, peso: 'leve', periodo: 'dia', aPartirDaHoraSP: 3,
      tetoTentativas: 12, toleranciaVigiaH: 36, naoTerminouVermelhoEm: null, comecaAteMs: LEVE_COMECA_ATE_MS, fimAteMs: 85_000, nuncaDesliga: true,
    })
    expect(LEVE_COMECA_ATE_MS).toBe(75_000)
    expect(a.cedeA).toBeUndefined()
    const r = tarefa('retratos_comentarios')
    expect(r).toMatchObject({
      nome: 'retratos_comentarios', rotulo: 'retratos de comentários', ordem: 7, peso: 'pesada', periodo: 'dia', aPartirDaHoraSP: 13,
      tetoTentativas: 12, toleranciaVigiaH: 36, naoTerminouVermelhoEm: 6, comecaAteMs: COMMENT_RULES.startsByMs, fimAteMs: 225_000, cedeA: ['sincronizar_canais'],
    })
    expect(COMMENT_RULES.startsByMs).toBe(130_000)
    expect(r.fimAteMs).toBe(WORST_END_FROM_T0_MS)
    expect(r.nuncaDesliga).not.toBe(true)
    // rótulo: minúsculo, sem ponto; devidaPeloDado não é declarado por nenhuma das duas
    for (const t of [a, r]) {
      expect(t.rotulo).toBe(t.rotulo.toLowerCase())
      expect(t.rotulo).not.toMatch(/[.:]$/)
      expect(t.devidaPeloDado).toBeUndefined()
      expect(typeof t.fraseDe).toBe('function')
    }
    // 85.000 = 75 s para começar + 2 idas ao banco de 5 s
    expect(a.fimAteMs).toBe(LEVE_COMECA_ATE_MS + 2 * COMMENT_RULES.dbTimeoutMs)
  })

  // 2 e 3
  it('OBS_AGENDA_TASKS_OFF ausente: as duas ligadas', () => {
    delete process.env.OBS_AGENDA_TASKS_OFF
    expect(process.env.OBS_AGENDA_TASKS_OFF).toBeUndefined()
    const r = tarefasDesligadas(process.env, CATALOGO)
    expect(r.desligadas.size).toBe(0)
    expect(r.ignoradas).toEqual([])
    expect(r.desconhecidas).toEqual([])
  })
  it('OBS_AGENDA_TASKS_OFF=anular_identidade,retratos_comentarios: a anulação roda, a coleta não (aparece desligada)', async () => {
    process.env.OBS_AGENDA_TASKS_OFF = 'anular_identidade,retratos_comentarios'
    const { desligadas, ignoradas, desconhecidas } = tarefasDesligadas(process.env, CATALOGO)
    expect([...desligadas]).toEqual(['retratos_comentarios'])
    expect(ignoradas).toEqual(['anular_identidade'])
    expect(desconhecidas).toEqual([])
    const ops: OpsAgenda = {
      tomar: vi.fn(async () => ({ valor: true })), fechar: vi.fn(async () => ({ valor: true })), adiar: vi.fn(async () => undefined),
      esgotar: vi.fn(async () => ({ valor: false })), relatar: vi.fn(),
    }
    const catalogo = [tarefa('anular_identidade'), tarefa('retratos_comentarios')]
    const resumo = await despachar({
      catalogo, desligadas, t0: T0_DIA, agora: () => T0_DIA, estado: estadoVazio,
      contexto: { t0: T0_DIA, agora: () => T0_DIA, apiKey: 'chave', sb: {} as SupabaseClient, linhas: null }, ops,
    })
    expect(resumo.tarefas.find(t => t.tarefa === 'retratos_comentarios')?.estado).toBe('desligada')
    expect(resumo.tarefas.find(t => t.tarefa === 'anular_identidade')?.estado).toBe('ok')
    expect(vi.mocked(runAnularIdentidade)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(runRetratosComentarios)).not.toHaveBeenCalled()
  })

  // 4
  describe('OBS_AGENDA=off: a anulação roda antes do lote antigo, com a lista REAL', () => {
    it('com tomada e fecho; grava a linha; a coleta e as tarefas de outras etapas não rodam', async () => {
      const r = await ANTES('interruptor')
      expect(vi.mocked(tomar)).toHaveBeenCalledWith(expect.anything(), { task: 'anular_identidade', period_key: chaveDia, teto: 12, reabrir: false })
      expect(vi.mocked(runAnularIdentidade)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(fechar)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(fechar).mock.calls[0]![1]).toMatchObject({ task: 'anular_identidade', period_key: chaveDia, estado: 'ok', feitas: 2 })
      expect(r.tarefas.map(t => t.tarefa)).toEqual(['anular_identidade'])
      expect(r.problemas).toEqual([]); expect(r.notas).toEqual([])
      expect(vi.mocked(runRetratosComentarios)).not.toHaveBeenCalled()
      expect(vi.mocked(runCompetitorBatch)).not.toHaveBeenCalled()
      expect(vi.mocked(runWeeklyPhase)).not.toHaveBeenCalled()
      expect(vi.mocked(executarLeituraHoraria)).not.toHaveBeenCalled()
    })
    it('segundo disparo do mesmo dia, com a linha ok: a anulação não roda de novo e não há nota nenhuma', async () => {
      vi.mocked(lerEstado).mockResolvedValue(linhaDoDia('ok', 1))
      const r = await ANTES('interruptor')
      expect(vi.mocked(runAnularIdentidade)).not.toHaveBeenCalled()
      expect(vi.mocked(tomar)).not.toHaveBeenCalled()
      expect(r.notas).toEqual([]); expect(r.problemas).toEqual([])
      expect(r.notas.join(' ')).not.toContain('outro disparo está com ela')
      expect(r.tarefas[0]).toMatchObject({ tarefa: 'anular_identidade', estado: 'nao_devida' })
    })
    it('linha erro com 12 tentativas: não roda, problemas traz o esgotamento e o disparo fica vermelho', async () => {
      vi.mocked(lerEstado).mockResolvedValue(linhaDoDia('erro', 12))
      vi.mocked(esgotar).mockResolvedValue({ valor: true })
      const r = await ANTES('interruptor')
      expect(vi.mocked(runAnularIdentidade)).not.toHaveBeenCalled()
      expect(r.problemas).toEqual(['anular identidade de autores: esgotou as 12 tentativas do período'])
      expect(r.tarefas[0]).toMatchObject({ tarefa: 'anular_identidade', estado: 'esgotada' })
    })
    it('estado ilegível: roda, fechar não é chamado, há nota', async () => {
      vi.mocked(lerEstado).mockResolvedValue({ porque: 'o banco não respondeu' })
      const r = await ANTES('interruptor')
      expect(vi.mocked(runAnularIdentidade)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(fechar)).not.toHaveBeenCalled()
      expect(vi.mocked(tomar)).not.toHaveBeenCalled()
      expect(r.notas).toHaveLength(1)
      expect(r.notas[0]).toMatch(/^anular identidade de autores: estado da agenda não lido/)
    })
  })

  // 5
  describe('a guarda da MG10 falhando: a anulação roda sem tomada antes do lote antigo', () => {
    it('em dois disparos seguidos roda duas vezes; tomar, fechar e lerEstado não são chamados', async () => {
      await ANTES('guarda_mg10')
      const r = await ANTES('guarda_mg10')
      expect(vi.mocked(runAnularIdentidade)).toHaveBeenCalledTimes(2)
      expect(vi.mocked(tomar)).not.toHaveBeenCalled()
      expect(vi.mocked(fechar)).not.toHaveBeenCalled()
      expect(vi.mocked(lerEstado)).not.toHaveBeenCalled()
      expect(r.problemas).toEqual([])
    })
    it('se ela falhar, a frase entra na mensagem de falha (sem texto de fora)', async () => {
      vi.mocked(runAnularIdentidade).mockResolvedValue(saida({ status: 'erro', motivo: 'schema_ausente' }))
      let r = await ANTES('guarda_mg10')
      expect(r.problemas).toEqual(['anular identidade de autores: migration não aplicada'])
      vi.mocked(runAnularIdentidade).mockResolvedValue(saida({ status: 'erro', motivo: 'banco' }))
      r = await ANTES('guarda_mg10')
      expect(r.problemas).toEqual(['anular identidade de autores: o banco não respondeu a tempo ou recusou'])
      vi.mocked(runAnularIdentidade).mockResolvedValue(saida({ status: 'erro', feitos: 3, motivo: 'identidade_vencida', numeros: { identidade_vencida: 4 } }))
      r = await ANTES('guarda_mg10')
      expect(r.problemas).toEqual(['anular identidade de autores: identidade de autores vencida e não apagada: 4. A coleta parou até a rotina de anulação rodar'])
    })
  })

  // 10
  describe('o adaptador: código e número, nunca texto', () => {
    const rodarTarefa = (nome: (typeof NOMES)[number], c = ctx()): Promise<ResultadoTarefa> => tarefa(nome).rodar(c)
    const mod = (nome: (typeof NOMES)[number]) => (nome === 'anular_identidade' ? vi.mocked(runAnularIdentidade) : vi.mocked(runRetratosComentarios))

    it('os dois chamam o módulo com o relógio e o t0 do disparo', async () => {
      const agora = () => T0 + 7
      await rodarTarefa('retratos_comentarios', ctx({ agora }))
      const c = vi.mocked(runRetratosComentarios).mock.calls[0]![0]
      expect(c).toMatchObject({ apiKey: 'chave', t0: T0, inicioMs: T0 + 7, now: agora })
      await rodarTarefa('anular_identidade', ctx({ agora }))
      expect(vi.mocked(runAnularIdentidade).mock.calls[0]![0]).toMatchObject({ now: agora })
    })
    it('a saída vira o resultado: status, feitos, ficaram, motivo e números', async () => {
      for (const nome of NOMES) {
        mod(nome).mockResolvedValueOnce(saida({ status: 'parcial', feitos: 5, ficaram: 3, motivo: 'cota_esgotada', numeros: { ficaram: 3, outro: 1 } }))
        expect(await rodarTarefa(nome), nome).toEqual({ estado: 'parcial', feitas: 5, deixadas: 3, motivo: 'cota_esgotada', detalhe: { ficaram: 3, outro: 1 } })
        mod(nome).mockResolvedValueOnce(saida({ feitos: 4 }))
        const ok = await rodarTarefa(nome)
        expect(ok, nome).toMatchObject({ estado: 'ok', feitas: 4, deixadas: 0 })
        expect(ok.motivo, nome).toBeUndefined()
      }
    })
    it('tarefa que lança com texto sentinela: motivo inesperado; a sentinela não aparece em fechar, em problemas, no resumo nem no Sentry', async () => {
      const lancamentos: unknown[] = [new Error(SENT), { code: '23514', message: `Failing row contains (${SENT})`, details: SENT }, SENT]
      for (const nome of NOMES) {
        for (const erro of lancamentos) {
          mod(nome).mockRejectedValueOnce(erro)
          vi.mocked(Sentry.captureMessage).mockClear()
          const r = await rodarTarefa(nome)
          expect(r, nome).toMatchObject({ estado: 'erro', motivo: 'inesperado', feitas: 0, deixadas: null })
          expect(JSON.stringify(r)).not.toContain('sentinela')
          expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)).not.toContain('sentinela')
          expect(vi.mocked(Sentry.captureMessage).mock.calls).toHaveLength(1)
        }
      }
      // pela lista real, até o fecho e os problemas
      vi.mocked(runAnularIdentidade).mockRejectedValueOnce(new Error(SENT))
      const antes = await ANTES('interruptor')
      expect(JSON.stringify(antes)).not.toContain('sentinela')
      expect(JSON.stringify(vi.mocked(fechar).mock.calls.map(c => c[1]))).not.toContain('sentinela')
      expect(antes.problemas).toEqual(['anular identidade de autores: retratos falharam com erro inesperado (ver Sentry)'])
      expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)).not.toContain('sentinela')
    })
    it('o motivo devolvido é sempre um item de CODIGOS_EXECUCAO ou schema_nao_conferido, no formato da agenda (sem dois-pontos)', async () => {
      for (const nome of NOMES) {
        for (const codigo of CODIGOS_EXECUCAO) {
          mod(nome).mockResolvedValueOnce(saida({ status: 'erro', motivo: codigo, numeros: {} }))
          const r = await rodarTarefa(nome)
          expect([...CODIGOS_EXECUCAO, 'schema_nao_conferido'], `${nome}/${codigo}`).toContain(r.motivo)
          expect(r.motivo, `${nome}/${codigo}`).toMatch(CODIGO_RE)
        }
        // o erro do banco em si (codigoDe devolve "banco:23514") nunca chega à agenda: vira o código de catálogo
        mod(nome).mockRejectedValueOnce({ code: '23514', message: 'x' })
        const r = await rodarTarefa(nome)
        expect(r.motivo).toBe('inesperado')
        expect(r.motivo).toMatch(CODIGO_RE)
      }
    })
    it('a frase do resumo é fraseDe(motivo, números), com os números, precedida do rótulo uma vez só', async () => {
      for (const nome of NOMES) {
        const t = tarefa(nome)
        mod(nome).mockResolvedValueOnce(saida({ status: 'erro', motivo: 'identidade_vencida', numeros: { identidade_vencida: 3 } }))
        const r = await rodarTarefa(nome)
        const frase = fraseDoMotivo(t, r.motivo, r.detalhe)
        expect(frase).toBe(`${t.rotulo}: ${fraseDe('identidade_vencida', { identidade_vencida: 3 })}`)
        expect(frase).toContain('3')
        expect(frase.split(t.rotulo)).toHaveLength(2)
      }
      const t = tarefa('retratos_comentarios')
      expect(fraseDoMotivo(t, 'identidade_vencida', { identidade_vencida: 3 })).toBe(
        'retratos de comentários: identidade de autores vencida e não apagada: 3. A coleta parou até a rotina de anulação rodar')
    })
    it('todo item de CODIGOS_EXECUCAO é chave de motivos da tarefa ou de MOTIVOS_COMUNS (codigoDoMotivo nunca devolve motivo_desconhecido para um código da E14)', () => {
      for (const nome of NOMES) {
        const t = tarefa(nome)
        for (const c of [...CODIGOS_EXECUCAO, 'schema_nao_conferido']) {
          expect(Object.hasOwn(t.motivos, c) || Object.hasOwn(MOTIVOS_COMUNS, c), `${nome}/${c}`).toBe(true)
          expect(codigoDoMotivo(t, c), `${nome}/${c}`).toBe(c)
        }
      }
    })
    it('nenhuma chave de motivos repete uma de MOTIVOS_COMUNS; os motivos são as frases fixas da E14', () => {
      for (const nome of NOMES) {
        const t = tarefa(nome)
        for (const c of Object.keys(t.motivos)) expect(Object.hasOwn(MOTIVOS_COMUNS, c), `${nome}/${c}`).toBe(false)
        for (const [c, f] of Object.entries(t.motivos)) expect(f, `${nome}/${c}`).toBe(FRASES_FIXAS[c as keyof typeof FRASES_FIXAS])
        expect(Object.keys(t.motivos).length).toBe(Object.keys(FRASES_FIXAS).length - Object.keys(FRASES_FIXAS).filter(c => Object.hasOwn(MOTIVOS_COMUNS, c)).length)
      }
    })
    it('prova do começo ilegível: o adaptador devolve schema_nao_conferido (comum), e o dono lê a frase COMUM; a fraseDe do registro não é chamada', async () => {
      const t = tarefa('retratos_comentarios')
      vi.mocked(runRetratosComentarios).mockResolvedValueOnce(saida({ status: 'erro', motivo: 'prova_ilegivel', numeros: { na_guarda: 1, ms: 5 } }))
      const r = await rodarTarefa('retratos_comentarios')
      expect(r).toMatchObject({ estado: 'erro', motivo: 'schema_nao_conferido' })
      expect(codigoDoMotivo(t, r.motivo)).toBe('schema_nao_conferido')
      const espia = vi.fn(t.fraseDe!)
      expect(fraseDoMotivo({ ...t, fraseDe: espia }, r.motivo, r.detalhe)).toBe('retratos de comentários: não foi possível conferir o schema')
      expect(espia).not.toHaveBeenCalled()
    })
    it('prova do fim ilegível e prova de depois de apagar ilegível: motivo prova_ilegivel e a frase é "<rótulo>: não foi possível ler a prova (banco)"', async () => {
      vi.mocked(runRetratosComentarios).mockResolvedValueOnce(saida({ status: 'erro', feitos: 3, motivo: 'prova_ilegivel', numeros: { feitos: 3 } }))
      const fim = await rodarTarefa('retratos_comentarios')
      expect(fim.motivo).toBe('prova_ilegivel')
      expect(fraseDoMotivo(tarefa('retratos_comentarios'), fim.motivo, fim.detalhe)).toBe('retratos de comentários: não foi possível ler a prova (banco)')
      vi.mocked(runAnularIdentidade).mockResolvedValueOnce(saida({ status: 'erro', feitos: 4, motivo: 'prova_ilegivel', numeros: { apagadas: 4 } }))
      const depois = await rodarTarefa('anular_identidade')
      expect(depois.motivo).toBe('prova_ilegivel')
      expect(fraseDoMotivo(tarefa('anular_identidade'), depois.motivo, depois.detalhe)).toBe('anular identidade de autores: não foi possível ler a prova (banco)')
    })
    it('MG8 ausente, nas duas tarefas: "<rótulo>: migration não aplicada"', async () => {
      for (const nome of NOMES) {
        mod(nome).mockResolvedValueOnce(saida({ status: 'erro', motivo: 'schema_ausente' }))
        const r = await rodarTarefa(nome)
        expect(r.motivo).toBe('schema_ausente')
        expect(fraseDoMotivo(tarefa(nome), r.motivo, r.detalhe)).toBe(`${tarefa(nome).rotulo}: migration não aplicada`)
      }
    })
    it('nenhum caso devolve "falha de código desconhecido" nem "undefined" (com número, sem número e com número torto)', async () => {
      for (const nome of NOMES) {
        const t = tarefa(nome)
        for (const codigo of [...CODIGOS_EXECUCAO, 'schema_nao_conferido', 'inesperado']) {
          for (const numeros of [{}, { identidade_vencida: 2, ficaram: 1, apagadas: 0 }, { na_guarda: 1 }]) {
            mod(nome).mockResolvedValueOnce(saida({ status: 'erro', motivo: codigo as TarefaSaida['motivo'], numeros }))
            const r = await rodarTarefa(nome)
            const frase = fraseDoMotivo(t, r.motivo, r.detalhe)
            expect(frase, `${nome}/${codigo}`).not.toMatch(/desconhecido|undefined|NaN|\[object/)
            expect(frase.startsWith(t.rotulo + ': '), `${nome}/${codigo}`).toBe(true)
            expect(frase.length).toBeLessThanOrEqual(t.rotulo.length + 2 + 160)
          }
        }
      }
    })
    it('relatarComentarios recebe prova_ilegivel nos três casos (começo e fim da coleta, e depois de apagar)', async () => {
      const relatos = (): string[] => vi.mocked(Sentry.captureMessage).mock.calls.map(c => String(c[0]))
      vi.mocked(runRetratosComentarios).mockResolvedValueOnce(saida({ status: 'erro', motivo: 'prova_ilegivel', numeros: { na_guarda: 1 } }))
      await rodarTarefa('retratos_comentarios')
      expect(relatos()).toEqual(['comentarios: coletar: prova_ilegivel'])
      vi.mocked(Sentry.captureMessage).mockClear()
      vi.mocked(runRetratosComentarios).mockResolvedValueOnce(saida({ status: 'erro', feitos: 1, motivo: 'prova_ilegivel', numeros: {} }))
      await rodarTarefa('retratos_comentarios')
      expect(relatos()).toEqual(['comentarios: coletar: prova_ilegivel'])
      // depois de apagar: o módulo de anular (o de verdade) relata, e o adaptador não repete
      vi.mocked(Sentry.captureMessage).mockClear()
      const real = await vi.importActual<typeof import('@/lib/youtube/observatorio/comentarios/anular')>('@/lib/youtube/observatorio/comentarios/anular')
      vi.mocked(runAnularIdentidade).mockImplementationOnce(real.runAnularIdentidade)
      const sb = {
        rpc: (nome: string) => {
          const b: Record<string, unknown> = {}
          b.abortSignal = () => b
          b.then = (ok: (r: unknown) => unknown) => Promise.resolve(nome === 'competitor_comment_identity_purge'
            ? { data: { apagadas: 4, comentarios_carimbados: 4, vencidas_ha_mais_de_1_dia: 0, restantes: 0 }, error: null }
            : { data: null, error: { code: '57014', message: SENT } }).then(ok)
          return b
        },
      } as unknown as SupabaseClient
      const r = await rodarTarefa('anular_identidade', ctx({ sb }))
      expect(r).toMatchObject({ estado: 'erro', motivo: 'prova_ilegivel', feitas: 4 })
      expect(relatos()).toEqual(['comentarios: anular: prova_ilegivel'])
      expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)).not.toContain('sentinela')
    })
    it('tarefa que lança: a frase é a fixa "<rótulo>: retratos falharam com erro inesperado (ver Sentry)", sem "undefined"', async () => {
      for (const nome of NOMES) {
        mod(nome).mockRejectedValueOnce(new Error(SENT))
        const r = await rodarTarefa(nome)
        expect(fraseDoMotivo(tarefa(nome), r.motivo, r.detalhe)).toBe(`${tarefa(nome).rotulo}: retratos falharam com erro inesperado (ver Sentry)`)
      }
    })
    it('a coleta com COMMENT_SINCE a decidir (o valor de hoje) é vermelha e visível: inicio_nao_decidido, sem chamar o YouTube nem o banco', async () => {
      vi.mocked(runRetratosComentarios).mockRestore()
      const real = await vi.importActual<typeof import('@/lib/youtube/observatorio/comentarios/coletar')>('@/lib/youtube/observatorio/comentarios/coletar')
      vi.mocked(runRetratosComentarios).mockImplementation(real.runRetratosComentarios)
      const r = await rodarTarefa('retratos_comentarios')
      expect(r).toMatchObject({ estado: 'erro', motivo: 'inicio_nao_decidido' })
      expect(fraseDoMotivo(tarefa('retratos_comentarios'), r.motivo, r.detalhe)).toMatch(/^retratos de comentários: a data de início da coleta não foi decidida/)
    })
  })

  // 11
  it('RULES.comments.target é 12 (a linha de rules.ts) e é o COMMENT_RULES', () => {
    expect(RULES.comments.target).toBe(12)
    expect(RULES.comments).toBe(COMMENT_RULES)
  })

  // 9
  it('comecaAteMs + o pior resto cabe: o fimAteMs de cada uma ≤ o teto da classe, e a coleta deixa os 20 s da prova e os 15 s do registro da rota', () => {
    expect(tarefa('anular_identidade').fimAteMs).toBeLessThanOrEqual(LEVE_FIM_MS)
    expect(tarefa('retratos_comentarios').fimAteMs).toBeLessThanOrEqual(PESADA_FIM_MS)
    const r = tarefa('retratos_comentarios')
    expect(r.comecaAteMs + (WORST_END_FROM_T0_MS - r.comecaAteMs)).toBeLessThanOrEqual(LIMITE_FUNCAO_MS - 20_000 - 15_000)
    expect(r.fimAteMs).toBe(WORST_END_FROM_T0_MS)
    expect(r.comecaAteMs).toBeLessThan(r.fimAteMs)
    expect(tarefa('anular_identidade').comecaAteMs).toBeLessThan(tarefa('anular_identidade').fimAteMs)
    expect(BATCH_BUDGET_MS).toBeGreaterThan(0)
  })

  // 13
  it('a lista REAL tem a anulação; toda tarefa nuncaDesliga do CATALOGO real está na lista (a recíproca do contrato da agenda)', () => {
    expect(antesDoLoteAntigo.length).toBeGreaterThan(0)
    expect(antesDoLoteAntigo.map(t => t.nome)).toContain('anular_identidade')
    for (const t of CATALOGO.filter(x => x.nuncaDesliga === true)) expect(antesDoLoteAntigo.map(x => x.nome), t.nome).toContain(t.nome)
    for (const t of antesDoLoteAntigo) expect(CATALOGO.map(x => x.nome), t.nome).toContain(t.nome)
    expect(antesDoLoteAntigo.find(t => t.nome === 'anular_identidade')).toBe(tarefa('anular_identidade'))
  })
})

// @vitest-environment node
// O disparo da agenda (`executarAgenda`) e a lista que roda antes do lote antigo (`rodarAntesDoLoteAntigo`) — A5 E16, Tarefa 12.
// O banco da agenda é um falso em memória que responde às seis funções da MG10; as tarefas, quando não são o assunto, são falsas.
// Datas: um instante PASSADO fixo e relógio falso (nada de data futura).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/cron-health', () => ({ recordCronSuccess: vi.fn(async () => undefined), recordCronFailure: vi.fn(async () => undefined) }))
vi.mock('../../../lib/logger', () => ({ logCron: vi.fn() }))
vi.mock('@/lib/youtube/observatorio/cache-tag', () => ({ invalidateObservatory: vi.fn() }))
vi.mock('@/lib/youtube/agenda/aviso', () => ({ avisarDono: vi.fn(async () => ({ enviados: 1, suprimidos: 0, falharam: 0, semDestinatario: 0 })) }))
vi.mock('@/lib/youtube/competitor-health', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/competitor-health')>()),
  schemaTablesReady: vi.fn(async () => null), readSiteHealth: vi.fn(),
}))
vi.mock('@/lib/youtube/competitor-sync-batch', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/competitor-sync-batch')>()),
  runCompetitorBatch: vi.fn(), runWeeklyPhase: vi.fn(), loadBatchRows: vi.fn(),
}))
vi.mock('@/lib/youtube/horaria/prova', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/horaria/prova')>()),
  lerProvaHoraria: vi.fn(), lerNegadosDoDono: vi.fn(),
}))
vi.mock('@/lib/youtube/agenda/estado', async (orig) => {
  const o = await orig<typeof import('@/lib/youtube/agenda/estado')>()
  return {
    ...o,
    tomarArrendamento: vi.fn(o.tomarArrendamento), soltarArrendamento: vi.fn(o.soltarArrendamento), lerEstado: vi.fn(o.lerEstado),
    tomar: vi.fn(o.tomar), fechar: vi.fn(o.fechar), adiar: vi.fn(o.adiar), esgotar: vi.fn(o.esgotar),
  }
})
vi.mock('@/lib/youtube/agenda/fecho', async (orig) => {
  const o = await orig<typeof import('@/lib/youtube/agenda/fecho')>()
  return { ...o, fecharDisparo: vi.fn(o.fecharDisparo) }
})

import * as Sentry from '@sentry/nextjs'
import { revalidatePath } from 'next/cache'
import { recordCronFailure, recordCronSuccess } from '@/lib/cron-health'
import { logCron } from '../../../lib/logger'
import { invalidateObservatory } from '@/lib/youtube/observatorio/cache-tag'
import { avisarDono } from '@/lib/youtube/agenda/aviso'
import { schemaTablesReady, readSiteHealth } from '@/lib/youtube/competitor-health'
import { runCompetitorBatch, runWeeklyPhase, loadBatchRows, type BatchResult, type BatchRow } from '@/lib/youtube/competitor-sync-batch'
import { lerProvaHoraria, lerNegadosDoDono, type ProvaHoraria } from '@/lib/youtube/horaria/prova'
import { adiar, esgotar, fechar, lerEstado, soltarArrendamento, tomar, tomarArrendamento } from '@/lib/youtube/agenda/estado'
import { fecharDisparo } from '@/lib/youtube/agenda/fecho'
import { CATALOGO, DEFINICOES } from '@/lib/youtube/agenda/catalogo'
import { antesDoLoteAntigo, executarAgenda, rodarAntesDoLoteAntigo } from '@/lib/youtube/agenda/executar'
import { chaveDoPeriodo } from '@/lib/youtube/agenda/periodo'
import type { LinhaTarefa, ResultadoTarefa, Tarefa } from '@/lib/youtube/agenda/tipos'

const H = 3_600_000
const SENTINELA = 'texto sentinela do banco'
const JOB = 'sync-youtube-competitors'
const T0 = Date.parse('2026-10-12T21:10:00Z') // 18:10 em São Paulo; passado fixo

// ───────────────────────── o banco falso da agenda (a MG10) ─────────────────────────
interface Chamada { fn: string; args: Record<string, unknown> }
function bancoDaAgenda(over: Partial<Record<string, (a: Record<string, unknown>) => unknown>> = {}) {
  const chamadas: Chamada[] = []
  const estados = new Map<string, Partial<LinhaTarefa>>()
  const padrao: Record<string, (a: Record<string, unknown>) => unknown> = {
    competitor_agenda_lease_take: () => ({ data: true, error: null }),
    competitor_agenda_lease_release: () => ({ data: true, error: null }),
    competitor_agenda_claim: () => ({ data: true, error: null }),
    competitor_agenda_finish: () => ({ data: true, error: null }),
    competitor_agenda_defer: () => ({ data: true, error: null }),
    competitor_agenda_exhaust: () => ({ data: false, error: null }),
    competitor_agenda_state: a => {
      const tasks = a.p_tasks as string[]
      const keys = a.p_period_keys as string[]
      return {
        data: {
          agora: new Date(T0).toISOString(), desde: new Date(T0 - 48 * H).toISOString(),
          tarefas: tasks.map((task, i) => ({
            task, period_key: keys[i], status: null, attempts: null, runs: null, unfinished_n: null, started_at: null, finished_at: null,
            done_n: null, left_n: null, reason: null, last_ok_at: null, last_run_status: null, last_run_done_n: null, ...estados.get(task),
          })),
        },
        error: null,
      }
    },
  }
  const sb = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      chamadas.push({ fn, args })
      const r = (over[fn] ?? padrao[fn] ?? (() => ({ data: null, error: null })))(args)
      return { abortSignal: () => Promise.resolve(r) }
    },
  } as unknown as SupabaseClient
  return { sb, chamadas, estados, vezes: (fn: string) => chamadas.filter(c => c.fn === fn) }
}

// ───────────────────────── fábricas ─────────────────────────
const okPadrao = async (): Promise<ResultadoTarefa> => ({ estado: 'ok', feitas: 1, deixadas: 0 })
function tarefa(nome: string, over: Partial<Tarefa> = {}): Tarefa {
  return {
    nome, rotulo: nome.replace(/_/g, ' '), ordem: 5, peso: 'leve', periodo: 'dia', tetoTentativas: 5, toleranciaVigiaH: 36, naoTerminouVermelhoEm: null,
    comecaAteMs: 70_000, fimAteMs: 85_000, nuncaDesliga: true,
    motivos: { falhou: 'a tarefa falhou', sobrou: 'ficaram itens' }, rodar: vi.fn(okPadrao), ...over,
  }
}
/** O catálogo desta ordem com `rodar` falso (a leitura horária, a sincronização e a série), cada uma com uma função que o teste troca. */
function catalogoFalso(rodar: Partial<Record<string, Tarefa['rodar']>> = {}): Tarefa[] {
  return DEFINICOES.map(d => ({ ...d, rodar: rodar[d.nome] ?? okPadrao }))
}
const linha = (id: string, o: Partial<BatchRow> = {}): BatchRow => ({
  id, channel_id: 'UC' + id, channel_name: 'Canal ' + id, site_id: id === 'b' ? 's2' : 's1', last_synced_at: null, last_ok_synced_at: null, sync_status: null,
  sync_error: null, sync_error_since: null, missing_since: null, weekly_pass_date: null, ...o,
})
const lote = (o: Partial<BatchResult> = {}): BatchResult => ({
  synced: 2, errors: 0, skipped: 0, remainingDue: 0, stoppedForTime: false, siteIds: ['s1', 's2'], healthSiteIds: ['s1', 's2'],
  totals: {} as BatchResult['totals'], weekly: {} as BatchResult['weekly'], acao_do_dono: [], ownerNotices: { sent: 0, failed: 0 }, ...o,
})
const PROVA: ProvaHoraria = {
  desde: new Date(T0 - 30 * H).toISOString(), ultima_leitura: new Date(T0 - 0.2 * H).toISOString(), horas_lidas_24h: 24,
  videos_na_lista: 10, videos_fora_do_teto: 0, videos_cobrados: 10, videos_abaixo_de_22h: 0, videos_abaixo_do_lido: 0,
  proprios_desde: null, proprios_ultima_leitura: null, proprios_na_lista: 0, proprios_fora_do_teto: 0, proprios_sem_captura: 0,
  proprios_cobrados: 0, proprios_abaixo_de_22h: 0, proprios_abaixo_do_lido: 0, proprios_em_competitor: 0,
}

let banco: ReturnType<typeof bancoDaAgenda>
const rodarAgenda = (deps: Parameters<typeof executarAgenda>[0]['deps'] = {}, sb: SupabaseClient = banco.sb) =>
  executarAgenda({ supabase: sb, apiKey: 'chave', runId: 'run-1', t0: T0, deps })
const corpo = async (r: Awaited<ReturnType<typeof executarAgenda>>): Promise<Record<string, unknown>> => {
  if (!r.resposta) throw new Error('sem resposta')
  return await r.resposta.json() as Record<string, unknown>
}
const mensagem = (): string => vi.mocked(recordCronFailure).mock.calls[0]![1] as string
const avancar = (ms: number): void => { vi.setSystemTime(Date.now() + ms) }

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(T0)
  banco = bancoDaAgenda()
  vi.mocked(loadBatchRows).mockResolvedValue([linha('a'), linha('b')])
  vi.mocked(readSiteHealth).mockResolvedValue({ ok: true, problems: [], notes: [] })
  vi.mocked(lerProvaHoraria).mockResolvedValue({ valor: PROVA })
  vi.mocked(lerNegadosDoDono).mockResolvedValue({ valor: { negados: 0, semClasse: 0 } })
  vi.mocked(runCompetitorBatch).mockResolvedValue(lote())
  delete process.env.OBS_AGENDA_TASKS_OFF
  delete process.env.OBS_AGENDA
})
afterEach(() => { vi.useRealTimers() })

// ───────────────────────── o disparo ─────────────────────────
describe('executarAgenda: o arrendamento', () => {
  it('arrendamento com outro: locked, 200, cron_health intocado', async () => {
    banco = bancoDaAgenda({ competitor_agenda_lease_take: () => ({ data: false, error: null }) })
    const rodar = vi.fn(okPadrao)
    const r = await rodarAgenda({ catalogo: catalogoFalso({ leitura_horaria: rodar }) })
    expect(r.resposta?.status).toBe(200)
    expect(await corpo(r)).toEqual({ status: 'locked' })
    expect(rodar).not.toHaveBeenCalled()
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
    expect(vi.mocked(recordCronFailure)).not.toHaveBeenCalled()
    expect(vi.mocked(logCron)).toHaveBeenCalledWith(expect.objectContaining({ job: JOB, status: 'locked' }))
    expect(banco.vezes('competitor_agenda_state')).toHaveLength(0)
  })

  // I-3 do portão final: o arrendamento que FALHA (diferente do arrendamento OCUPADO acima) nunca pode parar a coleta.
  // Tabelas da agenda presentes (a guarda passa: `schemaTablesReady` devolve null) e a função do arrendamento inutilizável.
  const falhaDoArrendamento = (code: string | undefined) => bancoDaAgenda({
    competitor_agenda_lease_take: () => ({ data: null, error: { code, message: SENTINELA } }),
  })

  it('I-3 schema_ausente (função faltando com as tabelas presentes): a agenda não roda e a rota cai no lote antigo, com a frase', async () => {
    banco = falhaDoArrendamento('42883')
    const rodar = vi.fn(okPadrao)
    const r = await rodarAgenda({ catalogo: catalogoFalso({ leitura_horaria: rodar, sincronizar_canais: rodar }) })
    expect(r.resposta).toBeNull()
    expect(r.semAgenda).toBe('não foi possível tomar o arrendamento da agenda (migration da agenda não aplicada (código 42883)); o lote antigo rodou no lugar')
    expect(rodar).not.toHaveBeenCalled()
    expect(vi.mocked(lerEstado)).not.toHaveBeenCalled()
    expect(vi.mocked(recordCronFailure)).not.toHaveBeenCalled() // quem grava o vermelho é a rota, com o lote antigo
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
    expect(vi.mocked(soltarArrendamento)).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(r)).not.toContain(SENTINELA)
    // migration pela metade é um defeito de operação: avisa o Sentry (diferente da MG10 inteira ausente, onde a guarda acusa)
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledWith('agenda: arrendamento não tomado', expect.objectContaining({ level: 'warning' }))
    expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)).not.toContain(SENTINELA)
  })

  it('I-3 erro_do_banco (sem EXECUTE para o service_role, 42501): o mesmo, com o código na frase', async () => {
    banco = falhaDoArrendamento('42501')
    const rodar = vi.fn(okPadrao)
    const r = await rodarAgenda({ catalogo: catalogoFalso({ leitura_horaria: rodar }) })
    expect(r.resposta).toBeNull()
    expect(r.semAgenda).toBe('não foi possível tomar o arrendamento da agenda (erro do banco (código 42501)); o lote antigo rodou no lugar')
    expect(rodar).not.toHaveBeenCalled()
    expect(vi.mocked(recordCronFailure)).not.toHaveBeenCalled()
    expect(vi.mocked(soltarArrendamento)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledWith('agenda: arrendamento não tomado', expect.objectContaining({ level: 'warning' }))
    expect(JSON.stringify(r)).not.toContain(SENTINELA)
  })

  it('I-3 schema_ausente com a guarda também ausente (MG10 inteira ausente): a frase continua a da guarda, a do arrendamento não a substitui', async () => {
    banco = falhaDoArrendamento('42883')
    vi.mocked(schemaTablesReady).mockResolvedValue({ tipo: 'ausente', texto: 'x', codigo: '42P01' })
    const r = await rodarAgenda()
    expect(r).toEqual({ resposta: null, semAgenda: 'migration MG10 não aplicada: a agenda não rodou; o lote antigo rodou no lugar' })
    expect(vi.mocked(Sentry.captureMessage)).not.toHaveBeenCalled()
  })

  it('I-3 prazo (o banco não respondeu ao arrendamento): não dá para saber se outro disparo o tem; a agenda segue (cada tarefa se garante pela tomada), o lote antigo NÃO roda em paralelo e o problema fica registrado', async () => {
    banco = falhaDoArrendamento(undefined)
    const rodar = vi.fn(okPadrao)
    const r = await rodarAgenda({ catalogo: catalogoFalso({ leitura_horaria: rodar }) })
    expect(r.resposta).not.toBeNull()
    expect(r.semAgenda).toBeUndefined()
    expect(rodar).toHaveBeenCalledTimes(1)
    const c = await corpo(r)
    expect((c.notas as string[]).some(n => /^arrendamento não tomado \(/.test(n))).toBe(true)
    expect(JSON.stringify(c)).not.toContain(SENTINELA)
    expect(vi.mocked(recordCronFailure)).toHaveBeenCalledTimes(1)
    expect(mensagem()).toContain('não foi possível confirmar o arrendamento da agenda (o banco não respondeu)')
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledWith('agenda: arrendamento não tomado', expect.objectContaining({ level: 'warning' }))
  })

  it('I-3 exceção ao chamar o arrendamento: igual ao prazo (agenda segue, problema registrado, sem lote antigo)', async () => {
    const sb = { rpc: (fn: string, a: Record<string, unknown>) => {
      if (fn === 'competitor_agenda_lease_take') throw new Error(SENTINELA)
      return banco.sb.rpc(fn, a)
    } } as unknown as SupabaseClient
    const rodar = vi.fn(okPadrao)
    const r = await rodarAgenda({ catalogo: catalogoFalso({ leitura_horaria: rodar }) }, sb)
    expect(r.resposta).not.toBeNull()
    expect(rodar).toHaveBeenCalledTimes(1)
    expect(mensagem()).toContain('não foi possível confirmar o arrendamento da agenda (o banco não respondeu)')
    expect(JSON.stringify(await corpo(r))).not.toContain(SENTINELA)
  })

  it('I-3 arrendamento OCUPADO por outro disparo continua saindo limpo (locked), nunca cai no lote antigo', async () => {
    banco = bancoDaAgenda({ competitor_agenda_lease_take: () => ({ data: false, error: null }) })
    const r = await rodarAgenda()
    expect(r.resposta?.status).toBe(200)
    expect(r.semAgenda).toBeUndefined()
    expect(await corpo(r)).toEqual({ status: 'locked' })
  })

  it('o arrendamento é solto com o holder do disparo, mesmo quando uma tarefa lança', async () => {
    const r = await rodarAgenda({ catalogo: catalogoFalso({ leitura_horaria: async () => { throw new Error(SENTINELA) } }) })
    expect(r.resposta?.status).toBe(200)
    expect(vi.mocked(soltarArrendamento)).toHaveBeenCalledTimes(1)
    const holder = vi.mocked(tomarArrendamento).mock.calls[0]![1]
    expect(vi.mocked(soltarArrendamento).mock.calls[0]![1]).toBe(holder)
    expect(holder).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('executarAgenda: o relato ao Sentry que o despachante recebe (ledger: mutante relatar: () => undefined)', () => {
  it('uma tarefa que lança é relatada com a tarefa e o código, e o texto da exceção não sai', async () => {
    const r = await rodarAgenda({ catalogo: catalogoFalso({ leitura_horaria: async () => { throw new Error(SENTINELA) } }) })
    expect(r.resposta?.status).toBe(200)
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledWith(
      'agenda: leitura_horaria: excecao',
      expect.objectContaining({ level: 'error', tags: { component: 'sync-youtube', mode: 'agenda', tarefa: 'leitura_horaria' } }),
    )
    expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)).not.toContain(SENTINELA)
  })
})

describe('executarAgenda: exceções inesperadas (emenda S-I3)', () => {
  const FRASE = 'o disparo da agenda falhou com erro inesperado (ver Sentry)'
  const trio = async (r: Awaited<ReturnType<typeof executarAgenda>>) => {
    expect(r.resposta?.status).toBe(500)
    expect(await corpo(r)).toEqual({ error: 'cron_failed' })
    expect(vi.mocked(recordCronFailure)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(recordCronFailure)).toHaveBeenCalledWith(JOB, FRASE)
    expect(vi.mocked(soltarArrendamento)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(logCron)).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', err_code: 'unhandled' }))
    expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)).not.toContain(SENTINELA)
    expect(JSON.stringify(vi.mocked(recordCronFailure).mock.calls)).not.toContain(SENTINELA)
  }
  it('exceção no fecho: falha gravada uma vez, arrendamento solto, 500', async () => {
    vi.mocked(fecharDisparo).mockRejectedValueOnce(new Error(SENTINELA))
    await trio(await rodarAgenda({ catalogo: catalogoFalso() }))
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
  })
  it('exceção ao invalidar o cache: o mesmo trio, nunca uma rejeição solta', async () => {
    vi.mocked(revalidatePath).mockImplementation(() => { throw new Error(SENTINELA) })
    const rodar = async (): Promise<ResultadoTarefa> => ({ estado: 'ok', feitas: 2, deixadas: 0, extra: lote({ synced: 2 }) })
    const r = await rodarAgenda({ catalogo: catalogoFalso({ sincronizar_canais: rodar }) })
    expect(r.resposta?.status).toBe(500)
    expect(await corpo(r)).toEqual({ error: 'cron_failed' })
    expect(vi.mocked(soltarArrendamento)).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)).not.toContain(SENTINELA)
    // o registro do cron: o último é a falha inesperada
    expect(vi.mocked(recordCronFailure).mock.calls.at(-1)).toEqual([JOB, FRASE])
  })
  it('gravar a falha também falha: ainda responde 500 e solta o arrendamento', async () => {
    vi.mocked(fecharDisparo).mockRejectedValueOnce(new Error(SENTINELA))
    vi.mocked(recordCronFailure).mockRejectedValue(new Error('o banco também caiu'))
    const r = await rodarAgenda({ catalogo: catalogoFalso() })
    expect(r.resposta?.status).toBe(500)
    expect(vi.mocked(soltarArrendamento)).toHaveBeenCalledTimes(1)
  })
})

describe('executarAgenda: a guarda da MG10', () => {
  const FRASE_MIGRATION = 'migration MG10 não aplicada: a agenda não rodou; o lote antigo rodou no lugar'
  it('migration ausente: nada roda, devolve resposta null com a frase fixa, solta o arrendamento e não escreve o cron_health', async () => {
    vi.mocked(schemaTablesReady).mockResolvedValue({ tipo: 'ausente', texto: 'migration MG10 não aplicada (x): ' + SENTINELA, codigo: '42P01' })
    const rodar = vi.fn(okPadrao)
    const r = await rodarAgenda({ catalogo: catalogoFalso({ leitura_horaria: rodar, sincronizar_canais: rodar }) })
    expect(r).toEqual({ resposta: null, semAgenda: FRASE_MIGRATION })
    expect(rodar).not.toHaveBeenCalled()
    expect(vi.mocked(lerEstado)).not.toHaveBeenCalled()
    expect(vi.mocked(loadBatchRows)).not.toHaveBeenCalled()
    expect(vi.mocked(recordCronFailure)).not.toHaveBeenCalled()
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
    expect(vi.mocked(soltarArrendamento)).toHaveBeenCalledTimes(1)
    // a guarda confere as duas tabelas da MG10, com o sinal do prazo do banco
    const [, grupos, o] = vi.mocked(schemaTablesReady).mock.calls[0]!
    expect(grupos).toEqual([['MG10', [['competitor_agenda_runs', 'task, runs, unfinished_n, detail'], ['competitor_agenda_lease', 'name']]]])
    expect(o?.signal).toBeInstanceOf(AbortSignal)
  })
  it('a guarda que não consegue ler: a frase diz que não foi possível conferir, com o código', async () => {
    vi.mocked(schemaTablesReady).mockResolvedValue({ tipo: 'nao_conferido', texto: 'erro: Failing row contains (UCsentinela)', codigo: '57014' })
    const r = await rodarAgenda()
    expect(r.resposta).toBeNull()
    expect(r.semAgenda).toBe('não foi possível conferir o schema da agenda (código 57014); o lote antigo rodou no lugar')
    expect(r.semAgenda).not.toContain('sentinela')
    vi.mocked(schemaTablesReady).mockRejectedValue(new Error('rede ' + SENTINELA))
    const r2 = await rodarAgenda()
    expect(r2.semAgenda).toBe('não foi possível conferir o schema da agenda (sem código); o lote antigo rodou no lugar')
    expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)).not.toContain('sentinela')
  })
  it('a frase de semAgenda não leva a mensagem do banco, só o código', async () => {
    vi.mocked(schemaTablesReady).mockResolvedValue({ tipo: 'nao_conferido', texto: 'erro: Failing row contains (UCsentinela)', codigo: null })
    const r = await rodarAgenda()
    expect(r.semAgenda).toBe('não foi possível conferir o schema da agenda (sem código); o lote antigo rodou no lugar')
  })
  it('com a MG10 ausente o arrendamento falha em silêncio (esperado): a guarda é quem acusa, sem alarme a cada disparo no Sentry', async () => {
    banco = bancoDaAgenda({ competitor_agenda_lease_take: () => ({ data: null, error: { code: '42883', message: 'function does not exist' } }) })
    vi.mocked(schemaTablesReady).mockResolvedValue({ tipo: 'ausente', texto: 'x', codigo: '42P01' })
    await rodarAgenda()
    expect(vi.mocked(Sentry.captureMessage)).not.toHaveBeenCalled()
  })
})

describe('executarAgenda: o catálogo desta ordem, de verdade (tarefas reais com o lote e as provas falsos)', () => {
  it('sem a MG9: só a horária em erro; a sincronização roda; vermelho com "leitura horária: migration não aplicada"', async () => {
    vi.mocked(schemaTablesReady).mockImplementation(async (_sb, g) => (g[0]?.[0] === 'MG9' ? { tipo: 'ausente', texto: 'migration MG9 não aplicada', codigo: '42P01' } : null))
    const r = await rodarAgenda()
    const c = await corpo(r)
    expect(r.resposta?.status).toBe(200)
    expect(vi.mocked(runCompetitorBatch)).toHaveBeenCalledTimes(1)
    const t = c.tarefas as Array<{ tarefa: string; estado: string; motivo?: string }>
    expect(t.find(x => x.tarefa === 'leitura_horaria')).toMatchObject({ estado: 'erro', motivo: 'schema_ausente' })
    expect(t.find(x => x.tarefa === 'sincronizar_canais')).toMatchObject({ estado: 'ok' })
    expect(mensagem()).toMatch(/^leitura horária: migration não aplicada/)
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
  })

  it('a guarda da MG9 pendurada não segura a série do dia: a horária fecha erro em até 60 s simulados e o lote roda', async () => {
    vi.mocked(schemaTablesReady).mockImplementation((_sb, g) => (g[0]?.[0] === 'MG9' ? new Promise(() => undefined) : Promise.resolve(null)))
    const p = rodarAgenda()
    await vi.advanceTimersByTimeAsync(59_999)
    expect(vi.mocked(runCompetitorBatch)).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    const r = await p
    const c = await corpo(r)
    const t = c.tarefas as Array<{ tarefa: string; estado: string; motivo?: string }>
    expect(t.find(x => x.tarefa === 'leitura_horaria')).toMatchObject({ estado: 'erro', motivo: 'passou_do_tempo' })
    expect(vi.mocked(runCompetitorBatch)).toHaveBeenCalledTimes(1)
    expect(mensagem()).toMatch(/^leitura horária: passou do tempo/)
  })

  it('o lote recebe o t0 do disparo, não o relógio dele: a horária gasta 60 s e o lote ainda conta de t0', async () => {
    const horaria = async (): Promise<ResultadoTarefa> => { avancar(60_000); return { estado: 'ok', feitas: 0, deixadas: 0 } }
    const cat = catalogoFalso({ leitura_horaria: horaria }).map(t => (t.nome === 'sincronizar_canais' ? CATALOGO.find(x => x.nome === t.nome)! : t))
    await rodarAgenda({ catalogo: cat })
    expect(vi.mocked(runCompetitorBatch)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(runCompetitorBatch).mock.calls[0]![0].started).toBe(T0)
    expect(Date.now()).toBe(T0 + 60_000)
  })

  it('loadBatchRows que nunca resolve: vermelho em português e o disparo segue (a horária e a sincronização rodam)', async () => {
    vi.mocked(loadBatchRows).mockReturnValue(new Promise(() => undefined))
    const p = rodarAgenda()
    await vi.advanceTimersByTimeAsync(5_000)
    const r = await p
    const c = await corpo(r)
    expect(r.resposta?.status).toBe(200)
    expect(c.acao_do_dono).toEqual([])
    expect(mensagem()).toContain('não foi possível ler os canais: o banco não respondeu em 5 s')
    expect(vi.mocked(runCompetitorBatch)).toHaveBeenCalledTimes(1) // a sincronização lê os canais por conta própria
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
  })
  it('sem as linhas, quando a sincronização já está ok, a série fecha erro canais_nao_lidos', async () => {
    vi.mocked(loadBatchRows).mockRejectedValue(new Error('Failing row contains (UCsentinela)'))
    banco.estados.set('sincronizar_canais', { status: 'ok' })
    // Catálogo injetado só com a sincronização e a série reais: o assunto é o comportamento da série semanal, não a disputa pela vaga
    // da pesada (essa tem o teste dela, abaixo, com o catálogo inteiro).
    const r = await rodarAgenda({ catalogo: CATALOGO.filter(t => t.nome === 'sincronizar_canais' || t.nome === 'serie_semanal') })
    const t = (await corpo(r)).tarefas as Array<{ tarefa: string; estado: string; motivo?: string }>
    expect(t.find(x => x.tarefa === 'serie_semanal')).toMatchObject({ estado: 'erro', motivo: 'canais_nao_lidos' })
    expect(vi.mocked(runWeeklyPhase)).not.toHaveBeenCalled()
  })
  it('loadBatchRows que lança: o texto do banco não sai (nem na mensagem, nem na resposta, nem no cron_health, nem no Sentry)', async () => {
    vi.mocked(loadBatchRows).mockRejectedValue(new Error('Failing row contains (UCsentinela)'))
    const r = await rodarAgenda()
    const c = await corpo(r)
    expect(mensagem()).toContain('não foi possível ler os canais')
    for (const dentro of [mensagem(), JSON.stringify(c), JSON.stringify(vi.mocked(logCron).mock.calls), JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)]) {
      expect(dentro).not.toContain('sentinela')
      expect(dentro).not.toContain('Failing row')
    }
  })
})

// A ordem de fato entre as três pesadas do catálogo REAL (ordem, período, `cedeA` e peso vêm de CATALOGO; só o código de cada tarefa é
// trocado por um espião, e `devidaPeloDado` sai, para o estado do banco falso decidir sozinho quem é devido). 18:10 em SP: as três
// são devidas pela hora (série a partir das 12, retratos a partir das 13).
describe('executarAgenda: quem leva a vaga da pesada, com o catálogo real', () => {
  const PESADAS = ['sincronizar_canais', 'retratos_comentarios', 'serie_semanal']
  const espioes = (): Record<string, ReturnType<typeof vi.fn>> => Object.fromEntries(CATALOGO.map(t => [t.nome, vi.fn(okPadrao)]))
  const catalogoReal = (e: Record<string, ReturnType<typeof vi.fn>>): Tarefa[] =>
    CATALOGO.map(t => ({ ...t, devidaPeloDado: undefined, rodar: e[t.nome]! }))
  const estadosDe = async (r: Awaited<ReturnType<typeof executarAgenda>>) =>
    Object.fromEntries(((await corpo(r)).tarefas as Array<{ tarefa: string; estado: string; motivo?: string }>).map(x => [x.tarefa, x]))
  const adiadasNoBanco = (): string[] => banco.vezes('competitor_agenda_defer').map(c => `${c.args.p_task}:${c.args.p_reason}`).sort()

  it('as três devidas e sãs: a sincronização roda; retratos e série cedem a vez e são adiadas', async () => {
    const e = espioes()
    const t = await estadosDe(await rodarAgenda({ catalogo: catalogoReal(e) }))
    expect(e.sincronizar_canais).toHaveBeenCalledTimes(1)
    expect(e.retratos_comentarios).not.toHaveBeenCalled()
    expect(e.serie_semanal).not.toHaveBeenCalled()
    expect(t.retratos_comentarios).toMatchObject({ estado: 'adiada', motivo: 'uma_pesada_por_disparo' })
    expect(t.serie_semanal).toMatchObject({ estado: 'adiada', motivo: 'uma_pesada_por_disparo' })
    expect(adiadasNoBanco()).toEqual(['retratos_comentarios:uma_pesada_por_disparo', 'serie_semanal:uma_pesada_por_disparo'])
  })

  it('sincronização já ok no período: retratos (ordem 7) leva a vaga; a série (ordem 8) é adiada com motivo; as leves e a horária rodam', async () => {
    banco.estados.set('sincronizar_canais', { status: 'ok' })
    const e = espioes()
    const t = await estadosDe(await rodarAgenda({ catalogo: catalogoReal(e) }))
    expect(e.retratos_comentarios).toHaveBeenCalledTimes(1)
    expect(e.serie_semanal).not.toHaveBeenCalled()
    expect(e.sincronizar_canais).not.toHaveBeenCalled()
    expect(t.retratos_comentarios).toMatchObject({ estado: 'ok' })
    expect(t.serie_semanal).toMatchObject({ estado: 'adiada', motivo: 'uma_pesada_por_disparo' })
    expect(t.sincronizar_canais).toMatchObject({ estado: 'nao_devida' })
    expect(e.anular_identidade).toHaveBeenCalledTimes(1)
    expect(e.leitura_horaria).toHaveBeenCalledTimes(1)
    expect(adiadasNoBanco()).toEqual(['serie_semanal:uma_pesada_por_disparo'])
  })

  it('sem fome permanente: no disparo seguinte (retratos já ok), a série preterida roda', async () => {
    banco.estados.set('sincronizar_canais', { status: 'ok' })
    banco.estados.set('retratos_comentarios', { status: 'ok' })
    banco.estados.set('serie_semanal', { status: 'adiada', reason: 'uma_pesada_por_disparo' })
    const e = espioes()
    const t = await estadosDe(await rodarAgenda({ catalogo: catalogoReal(e) }))
    expect(e.serie_semanal).toHaveBeenCalledTimes(1)
    expect(e.retratos_comentarios).not.toHaveBeenCalled()
    expect(t.serie_semanal).toMatchObject({ estado: 'ok' })
    expect(t.retratos_comentarios).toMatchObject({ estado: 'nao_devida' })
    expect(adiadasNoBanco()).toEqual([])
  })

  it('retratos com a última execução em erro perde a vaga para a série sã (a sã vem primeiro)', async () => {
    banco.estados.set('sincronizar_canais', { status: 'ok' })
    banco.estados.set('retratos_comentarios', { status: 'erro', last_run_status: 'erro' })
    const e = espioes()
    const t = await estadosDe(await rodarAgenda({ catalogo: catalogoReal(e) }))
    expect(e.serie_semanal).toHaveBeenCalledTimes(1)
    expect(e.retratos_comentarios).not.toHaveBeenCalled()
    expect(t.retratos_comentarios).toMatchObject({ estado: 'adiada', motivo: 'uma_pesada_por_disparo' })
  })

  it('as três pesadas do catálogo real são exatamente estas, e só a sincronização não cede a ninguém', () => {
    expect(CATALOGO.filter(t => t.peso === 'pesada').map(t => t.nome).sort()).toEqual([...PESADAS].sort())
    expect(CATALOGO.filter(t => t.peso === 'pesada' && (t.cedeA ?? []).length === 0).map(t => t.nome)).toEqual(['sincronizar_canais'])
  })
})

describe('executarAgenda: o fecho, a saúde e o cache', () => {
  it('tudo certo: sucesso gravado uma vez; a resposta traz agenda, tarefas, provas, notas e avisos_enviados', async () => {
    const r = await rodarAgenda({ catalogo: catalogoFalso() })
    const c = await corpo(r)
    expect(vi.mocked(recordCronSuccess)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(recordCronSuccess)).toHaveBeenCalledWith(JOB, 'info')
    expect(vi.mocked(recordCronFailure)).not.toHaveBeenCalled()
    expect(c).toMatchObject({ status: 'ok', mode: 'competitors', agenda: true, prova: { ok: true }, prova_horaria: { ok: true }, acao_do_dono: [], avisos_enviados: null })
    expect((c.tarefas as unknown[]).length).toBe(3)
    expect(vi.mocked(logCron)).toHaveBeenCalledWith(expect.objectContaining({ job: JOB, run_id: 'run-1', status: 'ok', agenda: true }))
    expect(banco.vezes('competitor_agenda_lease_release')).toHaveLength(1)
  })

  it('o fecho recebe os canais lidos, o t0, o relógio e desde quando a agenda roda (a carência da prova horária não é eterna)', async () => {
    await rodarAgenda({ catalogo: catalogoFalso() })
    const e = vi.mocked(fecharDisparo).mock.calls[0]![0]
    expect(e.t0).toBe(T0)
    expect(e.agendaDesde).toBe(new Date(T0 - 48 * H).toISOString())
    expect(e.linhas?.map(l => l.id)).toEqual(['a', 'b'])
    expect(e.resumo.tarefas).toHaveLength(3)
    // estado ilegível: sem agenda conhecida (carência), e o despachante já acusa o problema
    banco = bancoDaAgenda({ competitor_agenda_state: () => ({ data: null, error: { code: '57014', message: SENTINELA } }) })
    vi.mocked(fecharDisparo).mockClear()
    await rodarAgenda({ catalogo: catalogoFalso() })
    expect(vi.mocked(fecharDisparo).mock.calls[0]![0].agendaDesde).toBeNull()
    expect(mensagem()).toMatch(/não foi possível ler o estado da agenda/)
  })

  it('sem deps: o catálogo é CATALOGO, o arrendamento é "despachante" e a saúde é a de verdade', async () => {
    vi.mocked(schemaTablesReady).mockResolvedValue(null)
    vi.mocked(runWeeklyPhase).mockResolvedValue({ ran: true, visited: 0, complete: 0, pending: 0, recorded: 0, deferred: 0, promoted: 0, errors: 0, unitsUsed: 0, longWindowChanges: 0, thumbFailed: 0, thumbSkipped: 0, versionFailed: 0, errorsBySite: {} })
    await executarAgenda({ supabase: banco.sb, apiKey: 'chave', runId: 'run-1', t0: T0 })
    expect(banco.vezes('competitor_agenda_lease_take')[0]!.args).toMatchObject({ p_name: 'despachante' })
    expect(banco.vezes('competitor_agenda_state')[0]!.args.p_tasks).toEqual(CATALOGO.map(t => t.nome))
    // a saúde de verdade é a de `@/lib/cron-health` (aqui, o módulo falso): foi chamada
    expect(vi.mocked(recordCronSuccess).mock.calls.length + vi.mocked(recordCronFailure).mock.calls.length).toBe(1)
  })

  it('tarefa em erro: cron vermelho com o rótulo dela na frente', async () => {
    const r = await rodarAgenda({ catalogo: catalogoFalso({ leitura_horaria: async () => ({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'cota_esgotada' }) }) })
    expect(r.resposta?.status).toBe(200)
    expect(mensagem()).toMatch(/^leitura horária: cota do YouTube esgotada/)
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
  })

  it('acao_do_dono em toda resposta: canal em erro há 4 dias, nada devido', async () => {
    vi.mocked(loadBatchRows).mockResolvedValue([linha('a', { sync_status: 'error', sync_error_since: new Date(T0 - 4 * 24 * H).toISOString(), sync_error: 'not found' })])
    banco.estados.set('leitura_horaria', { status: 'ok' })
    banco.estados.set('sincronizar_canais', { status: 'ok' })
    banco.estados.set('serie_semanal', { status: 'ok' })
    const c = await corpo(await rodarAgenda({ catalogo: catalogoFalso() }))
    expect((c.acao_do_dono as string[])[0]).toMatch(/^canal Canal a em erro há 4 dias/)
    expect((c.tarefas as Array<{ estado: string }>).every(t => t.estado === 'nao_devida')).toBe(true)
  })

  describe('sincronizou canal pela agenda: o cache de cada site é invalidado', () => {
    const comLote = (synced: number, siteIds: string[]) => async (): Promise<ResultadoTarefa> => ({ estado: 'ok', feitas: synced, deixadas: 0, extra: lote({ synced, siteIds }) })
    it('synced 2 em dois sites: invalidateObservatory em cada um e revalidatePath', async () => {
      await rodarAgenda({ catalogo: catalogoFalso({ sincronizar_canais: comLote(2, ['A', 'B']) }) })
      expect(vi.mocked(invalidateObservatory).mock.calls).toEqual([['A'], ['B']])
      expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/cms/youtube/competitors', 'layout')
    })
    it('synced 0: revalidatePath não é chamado', async () => {
      await rodarAgenda({ catalogo: catalogoFalso({ sincronizar_canais: comLote(0, []) }) })
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled()
      expect(vi.mocked(invalidateObservatory)).not.toHaveBeenCalled()
    })
    it('só erros (dado parcial gravado): invalida o site mesmo com synced 0', async () => {
      await rodarAgenda({ catalogo: catalogoFalso({ sincronizar_canais: comLote(0, ['A']) }) })
      expect(vi.mocked(invalidateObservatory).mock.calls).toEqual([['A']])
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled()
    })
  })

  describe('o aviso ao dono sai depois de cron_health e não muda a resposta', () => {
    const esgotada = (): void => { banco.estados.set('leitura_horaria', { status: 'esgotada', attempts: 3 }) }
    it('a ordem das chamadas e a resposta igual quando o aviso lança', async () => {
      esgotada()
      const ordem: string[] = []
      vi.mocked(recordCronFailure).mockImplementation(async () => { ordem.push('cron_health') })
      vi.mocked(avisarDono).mockImplementation(async () => { ordem.push('aviso'); throw new Error(SENTINELA) })
      const r = await rodarAgenda({ catalogo: catalogoFalso() })
      expect(ordem).toEqual(['cron_health', 'aviso'])
      expect(r.resposta?.status).toBe(200)
      const c = await corpo(r)
      expect(c.avisos_enviados).toBeNull()
      expect(JSON.stringify(c)).not.toContain(SENTINELA)
      // com o aviso funcionando, a resposta é a mesma, exceto a contagem
      vi.mocked(avisarDono).mockResolvedValue({ enviados: 2, suprimidos: 0, falharam: 0, semDestinatario: 0 })
      const c2 = await corpo(await rodarAgenda({ catalogo: catalogoFalso() }))
      expect({ ...c2, avisos_enviados: null }).toEqual(c)
      expect(c2.avisos_enviados).toEqual({ enviados: 2, suprimidos: 0, falharam: 0, semDestinatario: 0 })
      const avisos = vi.mocked(avisarDono).mock.calls[0]![1]
      expect(avisos.map(a => [a.siteId, a.chave])).toEqual([['s1', 'tarefa_esgotada'], ['s2', 'tarefa_esgotada']])
      expect(vi.mocked(avisarDono).mock.calls[0]![2].prazoMs).toBe(8_000)
    })
    it('sem tempo, o aviso não é tentado (relógio a 298 s)', async () => {
      esgotada()
      const lenta = async (): Promise<ResultadoTarefa> => { avancar(298_000); return { estado: 'ok', feitas: 0, deixadas: 0 } }
      const r = await rodarAgenda({ catalogo: catalogoFalso({ sincronizar_canais: lenta }) })
      expect(r.resposta?.status).toBe(200)
      expect(vi.mocked(avisarDono)).not.toHaveBeenCalled()
      expect(vi.mocked(recordCronFailure)).toHaveBeenCalledTimes(1) // o cron_health foi gravado antes
    })
    it('com 280 s gastos o prazo do aviso é o que falta até 297 s (17 s, limitado a 8 s)', async () => {
      esgotada()
      const lenta = async (): Promise<ResultadoTarefa> => { avancar(280_000); return { estado: 'ok', feitas: 0, deixadas: 0 } }
      await rodarAgenda({ catalogo: catalogoFalso({ sincronizar_canais: lenta }) })
      expect(vi.mocked(avisarDono).mock.calls[0]![2].prazoMs).toBe(8_000)
    })
    // m-3 do portão final (mutante M14): o piso AVISO_MIN_MS. Restante = 300 s − 3 s − gasto; com 3 s sobrando o aviso sai, com 2.999 ms não.
    it('com 294 s gastos sobram exatos 3 s: o aviso é tentado, com prazo de 3 s (o piso é inclusivo)', async () => {
      esgotada()
      const lenta = async (): Promise<ResultadoTarefa> => { avancar(294_000); return { estado: 'ok', feitas: 0, deixadas: 0 } }
      await rodarAgenda({ catalogo: catalogoFalso({ sincronizar_canais: lenta }) })
      expect(vi.mocked(avisarDono)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(avisarDono).mock.calls[0]![2].prazoMs).toBe(3_000)
    })
    it('com 294 s e 1 ms gastos sobram 2.999 ms: abaixo do piso, o aviso não é tentado e o cron_health já foi gravado', async () => {
      esgotada()
      const lenta = async (): Promise<ResultadoTarefa> => { avancar(294_001); return { estado: 'ok', feitas: 0, deixadas: 0 } }
      const r = await rodarAgenda({ catalogo: catalogoFalso({ sincronizar_canais: lenta }) })
      expect(r.resposta?.status).toBe(200)
      expect(vi.mocked(avisarDono)).not.toHaveBeenCalled()
      expect(vi.mocked(recordCronFailure)).toHaveBeenCalledTimes(1)
    })
    it('com 291 s gastos o prazo é 6 s (297 − 291)', async () => {
      esgotada()
      const lenta = async (): Promise<ResultadoTarefa> => { avancar(291_000); return { estado: 'ok', feitas: 0, deixadas: 0 } }
      await rodarAgenda({ catalogo: catalogoFalso({ sincronizar_canais: lenta }) })
      expect(vi.mocked(avisarDono).mock.calls[0]![2].prazoMs).toBe(6_000)
    })
  })

  it('o aviso de tarefa nunca sai sem tarefa esgotada nem leitura parada: nada a avisar não chama avisarDono', async () => {
    await rodarAgenda({ catalogo: catalogoFalso() })
    expect(vi.mocked(avisarDono)).not.toHaveBeenCalled()
  })

  it('as notas dizem as tarefas desconhecidas e as que não se desligam em OBS_AGENDA_TASKS_OFF, e a variável de interruptor que não se reconhece', async () => {
    process.env.OBS_AGENDA_TASKS_OFF = 'serie_semanal,nao_existe,anular_identidade'
    process.env.OBS_AGENDA = 'talvez'
    const cat = [...catalogoFalso(), tarefa('anular_identidade', { ordem: 2, aPartirDaHoraSP: 3 })]
    const c = await corpo(await rodarAgenda({ catalogo: cat }))
    const notas = c.notas as string[]
    expect(notas.some(n => n.includes('"nao_existe" não é uma tarefa da agenda'))).toBe(true)
    expect(notas.some(n => n.includes('"anular_identidade" não pode ser desligada'))).toBe(true)
    expect(notas.some(n => n.includes('OBS_AGENDA'))).toBe(true)
    expect((c.tarefas as Array<{ tarefa: string; estado: string }>).find(t => t.tarefa === 'serie_semanal')?.estado).toBe('desligada')
  })
})

describe('o caminho da agenda não usa a trava de sessão', () => {
  it('grep cron_try_lock e withCronLock em agenda/ e horaria/: 0', () => {
    const SRC = path.resolve(__dirname, '../../../src/lib/youtube')
    const arquivos = (dir: string): string[] => readdirSync(dir).flatMap(f => {
      const p = path.join(dir, f)
      return statSync(p).isDirectory() ? arquivos(p) : /\.tsx?$/.test(f) ? [p] : []
    })
    const todos = [...arquivos(path.join(SRC, 'agenda')), ...arquivos(path.join(SRC, 'horaria'))]
    expect(todos.length).toBeGreaterThan(10)
    const achados = todos.filter(f => /cron_try_lock|withCronLock/.test(readFileSync(f, 'utf8')))
    expect(achados).toEqual([])
  })
})

// ───────────────────────── a lista que roda antes do lote antigo ─────────────────────────
describe('rodarAntesDoLoteAntigo', () => {
  const chamar = (lista: readonly Tarefa[], caminho: 'interruptor' | 'guarda_mg10' = 'interruptor') =>
    rodarAntesDoLoteAntigo({ supabase: banco.sb, apiKey: 'chave', runId: 'run-1', t0: T0, caminho, lista })
  const CHAVE_DIA = chaveDoPeriodo('dia', T0)
  const comErro = (over: Partial<Tarefa> = {}) => tarefa('anular_identidade', { rodar: vi.fn(async () => ({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'falhou' }) as ResultadoTarefa), ...over })

  it('lista vazia (injetada): devolve o vazio sem nenhuma ida ao banco nem ao Sentry', async () => {
    const r = await chamar([])
    expect(r).toEqual({ tarefas: [], problemas: [], notas: [] })
    expect(banco.chamadas).toHaveLength(0)
    expect(vi.mocked(Sentry.captureMessage)).not.toHaveBeenCalled()
  })

  it('a lista REAL traz exatamente anular_identidade (a obrigação de LGPD), e ela é nuncaDesliga', () => {
    expect(antesDoLoteAntigo.map(t => t.nome)).toEqual(['anular_identidade'])
    expect(antesDoLoteAntigo.every(t => t.nuncaDesliga === true)).toBe(true)
    // é a mesma tarefa do catálogo (um só objeto, uma só definição)
    expect(CATALOGO.find(t => t.nome === 'anular_identidade')).toBe(antesDoLoteAntigo[0])
  })

  it('tarefa da lista, caminho interruptor: com tomada, fecho e problema', async () => {
    const t = comErro()
    const r = await chamar([t])
    expect(vi.mocked(tomar)).toHaveBeenCalledWith(banco.sb, { task: 'anular_identidade', period_key: CHAVE_DIA, teto: 5, reabrir: false })
    expect(vi.mocked(fechar)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fechar).mock.calls[0]![1]).toMatchObject({ task: 'anular_identidade', period_key: CHAVE_DIA, estado: 'erro', motivo: 'falhou', feitas: 0, deixadas: null })
    expect(r.problemas).toEqual(['anular identidade: a tarefa falhou'])
    expect(r.tarefas).toEqual([expect.objectContaining({ tarefa: 'anular_identidade', estado: 'erro', motivo: 'falhou' })])
    expect(r.notas).toEqual([])
  })

  it('tarefa ok no caminho interruptor: tomada e fecho, sem problema', async () => {
    const r = await chamar([tarefa('anular_identidade')])
    expect(vi.mocked(tomar)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fechar).mock.calls[0]![1]).toMatchObject({ estado: 'ok', feitas: 1, deixadas: 0 })
    expect(r.problemas).toEqual([])
  })

  describe('já feita, esgotada e estado ilegível: os cinco estados lidos', () => {
    const linhaLida = (status: LinhaTarefa['status'], attempts: number) => { banco.estados.set('anular_identidade', { status, attempts }) }
    it('linha ok: não roda, sem nota nem problema', async () => {
      linhaLida('ok', 1)
      const t = comErro()
      const r = await chamar([t])
      expect(t.rodar).not.toHaveBeenCalled()
      expect(vi.mocked(tomar)).not.toHaveBeenCalled()
      expect(r.problemas).toEqual([]); expect(r.notas).toEqual([])
      expect(r.tarefas[0]!.estado).toBe('nao_devida')
    })
    it('linha erro com attempts = teto e esgotar → true: não roda, esgotar chamado, problema e o cron vermelho', async () => {
      const b = bancoDaAgenda({ competitor_agenda_exhaust: () => ({ data: true, error: null }) })
      b.estados.set('anular_identidade', { status: 'erro', attempts: 5 })
      const t = comErro()
      const r = await rodarAntesDoLoteAntigo({ supabase: b.sb, apiKey: 'chave', runId: 'r', t0: T0, caminho: 'interruptor', lista: [t] })
      expect(t.rodar).not.toHaveBeenCalled()
      expect(vi.mocked(esgotar)).toHaveBeenCalledTimes(1)
      expect(r.problemas).toEqual(['anular identidade: esgotou as 5 tentativas do período'])
      expect(r.tarefas[0]!.estado).toBe('esgotada')
    })
    it('linha esgotada e esgotar → false (o caso normal do segundo disparo em diante): problema mesmo assim', async () => {
      linhaLida('esgotada', 5)
      const t = comErro()
      const r = await chamar([t])
      expect(t.rodar).not.toHaveBeenCalled()
      expect(vi.mocked(esgotar)).toHaveBeenCalledTimes(1)
      expect(r.problemas).toEqual(['anular identidade: esgotou as 5 tentativas do período'])
      expect(r.notas).toEqual([])
    })
    it('linha rodando com attempts = teto e esgotar → false: é a última tentativa em curso noutro disparo; nota, sem problema', async () => {
      linhaLida('rodando', 5)
      const t = comErro()
      const r = await chamar([t])
      expect(t.rodar).not.toHaveBeenCalled()
      expect(r.notas).toEqual(['anular identidade: outro disparo está com ela'])
      expect(r.problemas).toEqual([])
      expect(r.tarefas[0]!.estado).toBe('ocupada')
    })
    it('linha rodando com attempts = teto e esgotar → true: marcou agora; problema', async () => {
      const b = bancoDaAgenda({ competitor_agenda_exhaust: () => ({ data: true, error: null }) })
      b.estados.set('anular_identidade', { status: 'rodando', attempts: 5 })
      const r = await rodarAntesDoLoteAntigo({ supabase: b.sb, apiKey: 'c', runId: 'r', t0: T0, caminho: 'interruptor', lista: [comErro()] })
      expect(r.problemas).toEqual(['anular identidade: esgotou as 5 tentativas do período'])
    })
    it.each(['parcial', 'adiada', 'erro'] as const)('linha %s com attempts no teto e esgotar → false: o problema sai seja qual for a volta de esgotar', async (status) => {
      linhaLida(status, 5)
      const r = await chamar([comErro()])
      expect(r.problemas).toEqual(['anular identidade: esgotou as 5 tentativas do período'])
    })
    it('esgotar que devolve { porque } também é problema (qualquer status que não seja rodando)', async () => {
      const b = bancoDaAgenda({ competitor_agenda_exhaust: () => ({ data: null, error: { code: '57014', message: SENTINELA } }) })
      b.estados.set('anular_identidade', { status: 'esgotada', attempts: 5 })
      const r = await rodarAntesDoLoteAntigo({ supabase: b.sb, apiKey: 'c', runId: 'r', t0: T0, caminho: 'interruptor', lista: [comErro()] })
      expect(r.problemas).toEqual(['anular identidade: esgotou as 5 tentativas do período'])
      expect(JSON.stringify(r)).not.toContain(SENTINELA)
    })
    it('estado ilegível: roda sem tomada e SEM fechar, com a nota', async () => {
      const b = bancoDaAgenda({ competitor_agenda_state: () => ({ data: null, error: { code: '57014', message: SENTINELA } }) })
      const t = tarefa('anular_identidade')
      const r = await rodarAntesDoLoteAntigo({ supabase: b.sb, apiKey: 'c', runId: 'r', t0: T0, caminho: 'interruptor', lista: [t] })
      expect(t.rodar).toHaveBeenCalledTimes(1)
      expect(b.vezes('competitor_agenda_claim')).toHaveLength(0)
      expect(b.vezes('competitor_agenda_finish')).toHaveLength(0)
      expect(r.notas).toHaveLength(1)
      expect(r.notas[0]).toMatch(/^anular identidade: estado da agenda não lido \(/)
      expect(JSON.stringify(r)).not.toContain(SENTINELA)
    })
    it('tomada que devolve false: nota "outro disparo está com ela", não roda; { porque }: roda sem fechar, com nota; fecho que falha vira nota', async () => {
      let b = bancoDaAgenda({ competitor_agenda_claim: () => ({ data: false, error: null }) })
      const t1 = tarefa('anular_identidade')
      let r = await rodarAntesDoLoteAntigo({ supabase: b.sb, apiKey: 'c', runId: 'r', t0: T0, caminho: 'interruptor', lista: [t1] })
      expect(t1.rodar).not.toHaveBeenCalled()
      expect(r.notas).toEqual(['anular identidade: outro disparo está com ela'])
      b = bancoDaAgenda({ competitor_agenda_claim: () => ({ data: null, error: { code: '57014', message: SENTINELA } }) })
      const t2 = tarefa('anular_identidade')
      r = await rodarAntesDoLoteAntigo({ supabase: b.sb, apiKey: 'c', runId: 'r', t0: T0, caminho: 'interruptor', lista: [t2] })
      expect(t2.rodar).toHaveBeenCalledTimes(1)
      expect(b.vezes('competitor_agenda_finish')).toHaveLength(0)
      expect(r.notas[0]).toMatch(/tomada não confirmada/)
      b = bancoDaAgenda({ competitor_agenda_finish: () => ({ data: null, error: { code: '57014', message: SENTINELA } }) })
      const t3 = tarefa('anular_identidade')
      r = await rodarAntesDoLoteAntigo({ supabase: b.sb, apiKey: 'c', runId: 'r', t0: T0, caminho: 'interruptor', lista: [t3] })
      expect(r.notas[0]).toMatch(/não foi possível gravar o fecho/)
      expect(r.problemas).toEqual([])
      expect(JSON.stringify(r)).not.toContain(SENTINELA)
    })
  })

  it('tarefa da lista, caminho guarda_mg10: sem tomada e sem fecho; ela roda em dois disparos seguidos', async () => {
    const t = tarefa('anular_identidade')
    await chamar([t], 'guarda_mg10')
    await chamar([t], 'guarda_mg10')
    expect(t.rodar).toHaveBeenCalledTimes(2)
    expect(vi.mocked(tomar)).not.toHaveBeenCalled()
    expect(vi.mocked(fechar)).not.toHaveBeenCalled()
    expect(vi.mocked(adiar)).not.toHaveBeenCalled()
    expect(vi.mocked(lerEstado)).not.toHaveBeenCalled()
    expect(banco.chamadas).toHaveLength(0)
  })

  it('tarefa da lista que lança, passa do prazo ou devolve motivo fora do catálogo: problemas com a frase do código; o sentinela não sai; o lote antigo roda depois', async () => {
    const lanca = tarefa('a_lanca', { ordem: 1, rodar: async () => { throw new Error(SENTINELA) } })
    const demora = tarefa('c_demora', { ordem: 3, rodar: () => new Promise(() => undefined) })
    const fora = tarefa('b_fora', { ordem: 2, rodar: async () => ({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'inventado ' + SENTINELA }) })
    const p = chamar([lanca, fora, demora], 'guarda_mg10')
    await vi.advanceTimersByTimeAsync(85_000)
    const r = await p
    expect(r.problemas).toEqual([
      'a lanca: falhou com erro inesperado (ver Sentry)',
      'b fora: falhou (motivo fora do catálogo; ver Sentry)',
      'c demora: passou do tempo e foi interrompida',
    ])
    expect(JSON.stringify(r)).not.toContain(SENTINELA)
    expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)).not.toContain(SENTINELA)
    expect(r.tarefas.map(x => x.motivo)).toEqual(['excecao', 'motivo_desconhecido', 'passou_do_tempo'])
  })

  it('tarefa sem nuncaDesliga na lista não roda; OBS_AGENDA_TASKS_OFF não desliga as que têm', async () => {
    process.env.OBS_AGENDA_TASKS_OFF = 'anular_identidade,outra'
    const com = tarefa('anular_identidade', { ordem: 1 })
    const sem = tarefa('outra', { ordem: 2, nuncaDesliga: false })
    const r = await chamar([com, sem], 'guarda_mg10')
    expect(com.rodar).toHaveBeenCalledTimes(1)
    expect(sem.rodar).not.toHaveBeenCalled()
    expect(r.notas).toEqual(['outra: fora da lista por não ser nuncaDesliga'])
  })

  it('o contexto da tarefa tem o t0 da rota e linhas nulas; as tarefas rodam por ordem', async () => {
    const ordem: string[] = []
    const a = tarefa('zeta', { ordem: 2, rodar: async c => { ordem.push('zeta'); expect(c.t0).toBe(T0); expect(c.linhas).toBeNull(); return { estado: 'ok', feitas: 0, deixadas: 0 } } })
    const b = tarefa('alfa', { ordem: 1, rodar: async () => { ordem.push('alfa'); return { estado: 'ok', feitas: 0, deixadas: 0 } } })
    await chamar([a, b], 'guarda_mg10')
    expect(ordem).toEqual(['alfa', 'zeta'])
  })
})

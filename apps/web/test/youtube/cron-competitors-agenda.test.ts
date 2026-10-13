// @vitest-environment node
// A rota do cron de concorrentes decide entre a agenda e o lote antigo (A5 E16, Tarefa 12).
// Regra de ouro: com OBS_AGENDA=off OU com a agenda ligada e a migration MG10 ausente, a coleta dos concorrentes NÃO deixa de rodar.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import path from 'node:path'

vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidateTag: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn(() => ({})) }))
// A rota importa o logger de `apps/web/lib` (o da trava de sessão), por caminho relativo: é este que se espia.
vi.mock('../../lib/logger', () => ({
  withCronLock: vi.fn((_sb: unknown, _key: unknown, _runId: unknown, _job: unknown, fn: () => Promise<{ status: string; [k: string]: unknown }>) =>
    fn().then(r => { const { status, health_written: _h, ...extra } = r; return Response.json(extra, { status: status === 'error' ? 500 : 200 }) })),
  newRunId: vi.fn(() => 'run-1'),
  logCron: vi.fn(),
}))
vi.mock('@/lib/youtube/sync', () => ({ syncChannel: vi.fn(), YouTubeQuotaError: class extends Error {} }))
vi.mock('@/lib/cron-health', () => ({ recordCronSuccess: vi.fn(), recordCronFailure: vi.fn() }))
vi.mock('@/lib/youtube/competitor-sync-batch', async (orig) => ({ ...(await orig<typeof import('@/lib/youtube/competitor-sync-batch')>()), runCompetitorBatch: vi.fn(), batchHealth: vi.fn(() => ({ ok: true })), loadBatchRows: vi.fn() }))
vi.mock('@/lib/youtube/competitor-health', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/competitor-health')>()),
  schemaReady: vi.fn(async () => null), readSiteHealth: vi.fn(async () => ({ ok: true, problems: [], notes: [] })), schemaTablesReady: vi.fn(async () => null),
}))
// O catálogo de teste (4 tarefas) e a lista (1 delas): para dizer o que NÃO roda com a agenda desligada.
vi.mock('@/lib/youtube/agenda/catalogo', async (orig) => {
  const o = await orig<typeof import('@/lib/youtube/agenda/catalogo')>()
  const t = (nome: string, rotulo: string, ordem: number) => ({ ...o.DEFINICOES[0]!, nome, rotulo, ordem, rodar: async () => ({ estado: 'ok' as const, feitas: 0, deixadas: 0 }) })
  return { ...o, CATALOGO: [t('anular_identidade', 'anulação de identidade', 2), t('leitura_horaria', 'leitura horária', 1), t('sincronizar_canais', 'sincronização dos canais', 6), t('serie_semanal', 'série semanal', 8)] }
})
vi.mock('@/lib/youtube/agenda/executar', async (orig) => {
  const o = await orig<typeof import('@/lib/youtube/agenda/executar')>()
  return {
    ...o,
    antesDoLoteAntigo: [{ nome: 'anular_identidade' }],
    executarAgenda: vi.fn(o.executarAgenda),
    rodarAntesDoLoteAntigo: vi.fn(async () => ({ tarefas: [], problemas: [], notas: [] })),
  }
})

import { GET } from '@/app/api/cron/sync-youtube/route'
import { withCronLock } from '../../lib/logger'
import { runCompetitorBatch, batchHealth } from '@/lib/youtube/competitor-sync-batch'
import { schemaReady, schemaTablesReady } from '@/lib/youtube/competitor-health'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import { executarAgenda, rodarAntesDoLoteAntigo } from '@/lib/youtube/agenda/executar'

const req = () => new NextRequest('http://localhost/api/cron/sync-youtube?mode=competitors', { headers: { authorization: 'Bearer test-secret' } })
const ZERO = { unitsUsed: 0, dailyRecorded: 0, weeklyRecorded: 0, weeklyDeferred: 0, earlyRecorded: 0, fieldsOpened: 0, rawOpened: 0, rawTooBig: 0, missed: 0, newlyMissing: 0, returned: 0, tierChanges: 0, cutByCap: 0, excludedNoCount: 0, promoted: 0, longWindowChanges: 0, partsMissing: 0, quotaErrors: 0 }
const lote = (o: Record<string, unknown> = {}) => ({ synced: 0, errors: 0, skipped: 0, remainingDue: 0, stoppedForTime: false, siteIds: [], healthSiteIds: ['s1'], totals: ZERO, weekly: { ran: false }, acao_do_dono: [], ...o })
const agendaVazia = { tarefas: [], problemas: [], notas: [] }
const ordem = (m: { mock: { invocationCallOrder: number[] } }): number => m.mock.invocationCallOrder[0]!
const falha = () => vi.mocked(recordCronFailure).mock.calls.map(c => c[1] as string)

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('CRON_SECRET', 'test-secret'); vi.stubEnv('YOUTUBE_API_KEY', 'yt-key')
  vi.stubEnv('OBS_AGENDA', 'off')
  vi.mocked(schemaReady).mockResolvedValue(null)
  vi.mocked(batchHealth).mockReturnValue({ ok: true })
  vi.mocked(runCompetitorBatch).mockResolvedValue(lote() as never)
  vi.mocked(rodarAntesDoLoteAntigo).mockResolvedValue(agendaVazia)
  vi.mocked(withCronLock).mockImplementation((_sb, _key, _runId, _job, fn) => (fn() as Promise<{ status: string; [k: string]: unknown }>).then(r => { const { status, health_written: _h, ...extra } = r; return Response.json(extra, { status: status === 'error' ? 500 : 200 }) }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('a rota decide a agenda antes de qualquer coisa', () => {
  it('os dois testes antigos da rota rodam com OBS_AGENDA=off e o falso de módulo da lista (arranjo, não afirmação)', () => {
    for (const f of ['cron-competitors-prova.test.ts', 'cron-competitors-invalidate.test.ts']) {
      const src = readFileSync(path.resolve(__dirname, f), 'utf8')
      expect(src, f).toContain("vi.stubEnv('OBS_AGENDA', 'off')")
      expect(src, f).toContain('rodarAntesDoLoteAntigo: vi.fn(async () => ({ tarefas: [], problemas: [], notas: [] }))')
    }
  })

  it('com a variável ausente a rota vai para a agenda: executarAgenda chamado, o lote antigo e a trava de sessão não', async () => {
    vi.unstubAllEnvs(); vi.stubEnv('CRON_SECRET', 'test-secret'); vi.stubEnv('YOUTUBE_API_KEY', 'yt-key')
    delete process.env.OBS_AGENDA
    vi.mocked(executarAgenda).mockResolvedValue({ resposta: Response.json({ status: 'ok', agenda: true }) })
    const res = await GET(req())
    expect(vi.mocked(executarAgenda)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(withCronLock)).not.toHaveBeenCalled()
    expect(vi.mocked(runCompetitorBatch)).not.toHaveBeenCalled()
    expect(await res.json()).toEqual({ status: 'ok', agenda: true })
    expect(vi.mocked(executarAgenda).mock.calls[0]![0]).toMatchObject({ apiKey: 'yt-key', runId: 'run-1' })
  })

  it('a rota decide agendaLigada() antes de executarAgenda: off não chama; ausente chama uma vez, antes de qualquer lista', async () => {
    await GET(req())
    expect(vi.mocked(executarAgenda)).not.toHaveBeenCalled()
    vi.mocked(rodarAntesDoLoteAntigo).mockClear()
    vi.unstubAllEnvs(); vi.stubEnv('CRON_SECRET', 'test-secret'); vi.stubEnv('YOUTUBE_API_KEY', 'yt-key')
    delete process.env.OBS_AGENDA
    vi.mocked(executarAgenda).mockResolvedValue({ resposta: null, semAgenda: 'S' })
    await GET(req())
    expect(vi.mocked(executarAgenda)).toHaveBeenCalledTimes(1)
    expect(ordem(vi.mocked(executarAgenda))).toBeLessThan(ordem(vi.mocked(rodarAntesDoLoteAntigo)))
  })

  it('caminho interruptor: a lista roda antes do lote antigo, uma vez, com caminho "interruptor"', async () => {
    await GET(req())
    expect(vi.mocked(rodarAntesDoLoteAntigo)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(rodarAntesDoLoteAntigo).mock.calls[0]![0]).toMatchObject({ caminho: 'interruptor', apiKey: 'yt-key', runId: 'run-1' })
    expect(ordem(vi.mocked(rodarAntesDoLoteAntigo))).toBeLessThan(ordem(vi.mocked(withCronLock)))
    expect(ordem(vi.mocked(rodarAntesDoLoteAntigo))).toBeLessThan(ordem(vi.mocked(runCompetitorBatch)))
  })

  it('caminho guarda_mg10: a lista roda depois de executarAgenda e antes do lote antigo; a mensagem do cron começa pela frase da agenda', async () => {
    vi.unstubAllEnvs(); vi.stubEnv('CRON_SECRET', 'test-secret'); vi.stubEnv('YOUTUBE_API_KEY', 'yt-key')
    delete process.env.OBS_AGENDA
    vi.mocked(executarAgenda).mockResolvedValue({ resposta: null, semAgenda: 'migration MG10 não aplicada: a agenda não rodou; o lote antigo rodou no lugar' })
    await GET(req())
    expect(vi.mocked(rodarAntesDoLoteAntigo).mock.calls[0]![0]).toMatchObject({ caminho: 'guarda_mg10' })
    expect(ordem(vi.mocked(executarAgenda))).toBeLessThan(ordem(vi.mocked(rodarAntesDoLoteAntigo)))
    expect(ordem(vi.mocked(rodarAntesDoLoteAntigo))).toBeLessThan(ordem(vi.mocked(runCompetitorBatch)))
    expect(vi.mocked(runCompetitorBatch)).toHaveBeenCalledTimes(1) // o lote antigo coleta
    expect(falha()).toEqual(['migration MG10 não aplicada: a agenda não rodou; o lote antigo rodou no lugar'])
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
  })

  it('agenda ligada e guarda boa: a lista não roda', async () => {
    vi.unstubAllEnvs(); vi.stubEnv('CRON_SECRET', 'test-secret'); vi.stubEnv('YOUTUBE_API_KEY', 'yt-key')
    delete process.env.OBS_AGENDA
    vi.mocked(executarAgenda).mockResolvedValue({ resposta: Response.json({ status: 'ok' }) })
    await GET(req())
    expect(vi.mocked(rodarAntesDoLoteAntigo)).not.toHaveBeenCalled()
  })

  it('os outros modos não tocam a agenda', async () => {
    delete process.env.OBS_AGENDA
    for (const mode of ['schedule', 'catchall', 'metrics', 'ab-poll']) {
      await GET(new NextRequest('http://localhost/api/cron/sync-youtube?mode=' + mode, { headers: { authorization: 'Bearer test-secret' } })).catch(() => undefined)
    }
    expect(vi.mocked(executarAgenda)).not.toHaveBeenCalled()
    expect(vi.mocked(rodarAntesDoLoteAntigo)).not.toHaveBeenCalled()
  })
})

describe('regra de ouro: sem a agenda a coleta dos concorrentes roda inteira', () => {
  it('sem a MG10 (agenda ligada, guarda real): vermelho com a frase da MG10 e o lote antigo roda com a fase semanal', async () => {
    vi.unstubAllEnvs(); vi.stubEnv('CRON_SECRET', 'test-secret'); vi.stubEnv('YOUTUBE_API_KEY', 'yt-key')
    delete process.env.OBS_AGENDA
    vi.mocked(executarAgenda).mockImplementation((await vi.importActual<typeof import('@/lib/youtube/agenda/executar')>('@/lib/youtube/agenda/executar')).executarAgenda)
    vi.mocked(schemaTablesReady).mockResolvedValue({ tipo: 'ausente', texto: 'migration MG10 não aplicada (competitor_agenda_runs): x', codigo: '42P01' })
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(vi.mocked(runCompetitorBatch)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(runCompetitorBatch).mock.calls[0]![0]).toMatchObject({ weekly: true, batchSize: 15, budgetMs: 200_000 })
    expect(falha()).toEqual(['migration MG10 não aplicada: a agenda não rodou; o lote antigo rodou no lugar'])
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
    expect(vi.mocked(withCronLock)).toHaveBeenCalledTimes(1)
    const c = await res.json()
    expect(c).toMatchObject({ mode: 'competitors', prova: { ok: true } })
    expect('agenda_desligada' in c).toBe(false)
  })

  it('a guarda da MG10 que não consegue ler: o mesmo caminho, com "não foi possível conferir o schema da agenda"', async () => {
    vi.unstubAllEnvs(); vi.stubEnv('CRON_SECRET', 'test-secret'); vi.stubEnv('YOUTUBE_API_KEY', 'yt-key')
    delete process.env.OBS_AGENDA
    vi.mocked(executarAgenda).mockImplementation((await vi.importActual<typeof import('@/lib/youtube/agenda/executar')>('@/lib/youtube/agenda/executar')).executarAgenda)
    vi.mocked(schemaTablesReady).mockRejectedValue(new Error('Failing row contains (UCsentinela)'))
    await GET(req())
    expect(vi.mocked(runCompetitorBatch)).toHaveBeenCalledTimes(1)
    expect(falha()).toEqual(['não foi possível conferir o schema da agenda (sem código); o lote antigo rodou no lugar'])
    expect(JSON.stringify(falha())).not.toContain('sentinela')
  })

  it('com OBS_AGENDA=off o lote antigo roda inteiro, sem tocar a agenda: com a fase semanal, a trava de sessão e verde quando tudo está bem', async () => {
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(vi.mocked(executarAgenda)).not.toHaveBeenCalled()
    expect(vi.mocked(withCronLock)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(runCompetitorBatch).mock.calls[0]![0]).toMatchObject({ weekly: true, batchSize: 15, budgetMs: 200_000 })
    expect(vi.mocked(recordCronSuccess)).toHaveBeenCalledWith('sync-youtube-competitors', 'info')
    expect(vi.mocked(recordCronFailure)).not.toHaveBeenCalled()
  })
})

describe('a lista que roda antes do lote antigo, na rota', () => {
  it('o lote antigo e a lista contam o tempo do t0 da rota: mesmo t0, started === t0, e o prazo do "passou do tempo" conta de t0', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    const T0 = Date.parse('2026-10-12T21:10:00Z')
    vi.setSystemTime(T0)
    vi.mocked(rodarAntesDoLoteAntigo).mockImplementation(async () => { vi.setSystemTime(Date.now() + 10_000); return agendaVazia })
    vi.mocked(runCompetitorBatch).mockReturnValue(new Promise(() => undefined))
    const p = GET(req())
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.mocked(rodarAntesDoLoteAntigo).mock.calls[0]![0].t0).toBe(T0)
    expect(vi.mocked(runCompetitorBatch).mock.calls[0]![0].started).toBe(T0)
    // 10 s já gastos pela lista: o corte de 285 s chega aos 275 s do lote (não aos 285 s depois dele)
    await vi.advanceTimersByTimeAsync(274_999)
    expect(vi.mocked(recordCronFailure)).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    const res = await p
    expect(res.status).toBe(500)
    expect(falha()[0]).toMatch(/disparo passou do tempo/)
    expect(Date.now()).toBe(T0 + 285_000)
  })

  it('sem a lista (vazia), started também é o t0 da rota; executarAgenda e a lista recebem o mesmo t0', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const T0 = Date.parse('2026-10-12T21:10:00Z')
    vi.setSystemTime(T0)
    await GET(req())
    expect(vi.mocked(runCompetitorBatch).mock.calls[0]![0].started).toBe(T0)
    vi.mocked(runCompetitorBatch).mockClear()
    vi.unstubAllEnvs(); vi.stubEnv('CRON_SECRET', 'test-secret'); vi.stubEnv('YOUTUBE_API_KEY', 'yt-key')
    delete process.env.OBS_AGENDA
    vi.mocked(executarAgenda).mockResolvedValue({ resposta: null, semAgenda: 'S' })
    await GET(req())
    expect(vi.mocked(executarAgenda).mock.calls[0]![0].t0).toBe(T0)
    expect(vi.mocked(rodarAntesDoLoteAntigo).mock.calls.at(-1)![0].t0).toBe(T0)
    expect(vi.mocked(runCompetitorBatch).mock.calls[0]![0].started).toBe(T0)
  })

  describe('as saídas antecipadas do bloco antigo levam semAgenda e os problemas da lista', () => {
    const comLista = () => vi.mocked(rodarAntesDoLoteAntigo).mockResolvedValue({ tarefas: [{ tarefa: 'anular_identidade', estado: 'erro', ms: 0, feitas: 0, deixadas: null, motivo: 'falhou' }], problemas: ['anulação: falhou'], notas: [] })
    it('(a) a guarda da E1/E2 não está pronta: semAgenda, a frase da lista e a guarda, nessa ordem; o lote não roda', async () => {
      vi.unstubAllEnvs(); vi.stubEnv('CRON_SECRET', 'test-secret'); vi.stubEnv('YOUTUBE_API_KEY', 'yt-key')
      delete process.env.OBS_AGENDA
      vi.mocked(executarAgenda).mockResolvedValue({ resposta: null, semAgenda: 'S-SEM-AGENDA' })
      vi.mocked(schemaReady).mockResolvedValue('G-GUARDA')
      comLista()
      const res = await GET(req())
      expect(res.status).toBe(500)
      expect(vi.mocked(recordCronFailure)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
      expect(falha()[0]).toBe('S-SEM-AGENDA | anulação: falhou | G-GUARDA')
      expect(vi.mocked(runCompetitorBatch)).not.toHaveBeenCalled()
      const c = await res.json()
      expect(c.error).toBe('G-GUARDA')
      expect(c.antes_do_lote).toHaveLength(1)
      expect('agenda_desligada' in c).toBe(false)
    })
    it('(b) o lote lança: a frase da lista e a do erro; o campo error é só a frase da saída', async () => {
      comLista()
      vi.mocked(runCompetitorBatch).mockRejectedValue(new Error('X'))
      const res = await GET(req())
      expect(res.status).toBe(500)
      expect(vi.mocked(recordCronFailure)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
      expect(falha()[0]).toBe('anulação: falhou | X')
      const c = await res.json()
      expect(c.error).toBe('X')
      expect(c.antes_do_lote).toHaveLength(1)
      expect(c.agenda_desligada).toEqual(['leitura horária', 'sincronização dos canais', 'série semanal']) // OBS_AGENDA=off: a resposta diz o que não roda
    })
    it('(c) o lote nunca resolve: aos 285 s o "disparo passou do tempo" vem depois da frase da lista', async () => {
      vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
      comLista()
      vi.mocked(runCompetitorBatch).mockReturnValue(new Promise(() => undefined))
      const p = GET(req())
      await vi.advanceTimersByTimeAsync(285_000)
      const res = await p
      expect(res.status).toBe(500)
      expect(vi.mocked(recordCronFailure)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
      expect(falha()[0]).toMatch(/^anulação: falhou \| o disparo passou do tempo/)
      const c = await res.json()
      expect(c.error).toMatch(/^o disparo passou do tempo/)
      expect(c.antes_do_lote).toHaveLength(1)
    })
    it('o lote bom com problema da lista: vermelho com a frase da lista, nunca verde', async () => {
      comLista()
      await GET(req())
      expect(falha()).toEqual(['anulação: falhou'])
      expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
    })
  })

  // m-6 do portão final: as notas do caminho sem agenda ("estado da agenda não lido", "tomada não confirmada", "não foi possível gravar o fecho")
  // eram descartadas; agora chegam à resposta, e só quando existem.
  it('as notas da lista que roda antes do lote chegam à resposta em notas_antes (sucesso e saída antecipada); sem nota a chave não existe', async () => {
    vi.mocked(rodarAntesDoLoteAntigo).mockResolvedValue({ tarefas: [], problemas: [], notas: ['anulação de identidade: estado da agenda não lido (o banco não respondeu)'] })
    const ok = await (await GET(req())).json()
    expect(ok.notas_antes).toEqual(['anulação de identidade: estado da agenda não lido (o banco não respondeu)'])
    vi.mocked(runCompetitorBatch).mockRejectedValue(new Error('X'))
    const erro = await (await GET(req())).json()
    expect(erro.notas_antes).toEqual(['anulação de identidade: estado da agenda não lido (o banco não respondeu)'])
    vi.mocked(rodarAntesDoLoteAntigo).mockResolvedValue(agendaVazia)
    vi.mocked(runCompetitorBatch).mockResolvedValue(lote() as never)
    expect('notas_antes' in await (await GET(req())).json()).toBe(false)
  })

  it('lista vazia: a resposta com OBS_AGENDA=off é a de hoje mais a chave agenda_desligada; antes_do_lote não existe', async () => {
    const c = await (await GET(req())).json()
    expect(c).toMatchObject({ mode: 'competitors', synced: 0, prova: { ok: true } })
    expect('antes_do_lote' in c).toBe(false)
    expect('siteIds' in c).toBe(false)
    expect('healthSiteIds' in c).toBe(false)
  })

  it('com OBS_AGENDA=off a resposta diz o que não roda: os rótulos do catálogo que não estão na lista; no caminho guarda_mg10 a chave não existe', async () => {
    const c = await (await GET(req())).json()
    expect(c.agenda_desligada).toEqual(['leitura horária', 'sincronização dos canais', 'série semanal'])
    vi.unstubAllEnvs(); vi.stubEnv('CRON_SECRET', 'test-secret'); vi.stubEnv('YOUTUBE_API_KEY', 'yt-key')
    delete process.env.OBS_AGENDA
    vi.mocked(executarAgenda).mockResolvedValue({ resposta: null, semAgenda: 'S' })
    const d = await (await GET(req())).json()
    expect('agenda_desligada' in d).toBe(false)
  })
})

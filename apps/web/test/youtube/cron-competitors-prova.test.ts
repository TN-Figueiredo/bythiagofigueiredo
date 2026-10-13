// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidateTag: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn(() => ({})) }))
vi.mock('@/lib/logger', () => ({
  withCronLock: vi.fn((_sb: unknown, _key: unknown, _runId: unknown, _job: unknown, fn: () => Promise<{ status: string; [k: string]: unknown }>) =>
    fn().then(r => { const { status, ...extra } = r; return Response.json(extra, { status: status === 'error' ? 500 : 200 }) })),
  newRunId: vi.fn(() => 'run-1'),
}))
vi.mock('@/lib/youtube/sync', () => ({ syncChannel: vi.fn(), YouTubeQuotaError: class extends Error {} }))
vi.mock('@/lib/cron-health', () => ({ recordCronSuccess: vi.fn(), recordCronFailure: vi.fn() }))
// as constantes e currentSlotStart são as de verdade (a rota as usa para a conta de tempo); só o lote e o veredito do lote são falsos
vi.mock('@/lib/youtube/competitor-sync-batch', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/youtube/competitor-sync-batch')>()), runCompetitorBatch: vi.fn(), batchHealth: vi.fn(() => ({ ok: true })) }))
vi.mock('@/lib/youtube/competitor-health', () => ({ schemaReady: vi.fn(), readSiteHealth: vi.fn() }))

import { GET } from '@/app/api/cron/sync-youtube/route'
import { revalidateTag } from 'next/cache'
import { runCompetitorBatch, batchHealth, currentSlotStart } from '@/lib/youtube/competitor-sync-batch'
import { schemaReady, readSiteHealth } from '@/lib/youtube/competitor-health'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'

const req = () => new NextRequest('http://localhost/api/cron/sync-youtube?mode=competitors', { headers: { authorization: 'Bearer test-secret' } })

describe('cron de concorrentes: guarda de schema', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('CRON_SECRET', 'test-secret'); vi.stubEnv('YOUTUBE_API_KEY', 'yt-key') })
  it('migration ausente: para antes do lote, grava a falha com o texto, não invalida nada', async () => {
    vi.mocked(schemaReady).mockResolvedValue('migration MG1 não aplicada (competitor_videos): column does not exist. Nada foi gravado.')
    const res = await GET(req())
    expect(res.status).toBe(500)
    expect(vi.mocked(runCompetitorBatch)).not.toHaveBeenCalled()
    expect(vi.mocked(recordCronFailure)).toHaveBeenCalledWith('sync-youtube-competitors', 'migration MG1 não aplicada (competitor_videos): column does not exist. Nada foi gravado.')
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
    expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled()
    expect((await res.json()).error).toMatch(/MG1/)
  })
  it('a guarda pergunta pelo que a etapa em produção precisa', async () => {
    vi.mocked(schemaReady).mockResolvedValue('x')
    await GET(req())
    expect(vi.mocked(schemaReady)).toHaveBeenCalledWith(expect.anything(), 'e1e2') // a E2 (Tarefa 10) lê colunas e tabelas da MG2: a guarda confere as duas
  })
  it('MG1 aplicada e MG2 não: o cron fica vermelho com o texto da MG2 e o lote não é chamado', async () => {
    vi.mocked(schemaReady).mockImplementation(async (_sb, need) => (need === 'e1e2' ? 'migration MG2 não aplicada (competitor_videos): column competitor_videos.series_tier does not exist. Nada foi gravado.' : null))
    const res = await GET(req())
    expect(res.status).toBe(500)
    expect(vi.mocked(runCompetitorBatch)).not.toHaveBeenCalled()
    expect(vi.mocked(recordCronFailure)).toHaveBeenCalledWith('sync-youtube-competitors', expect.stringMatching(/MG2/))
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
    expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled()
    expect((await res.json()).error).toMatch(/MG2/)
  })
  it('a guarda que passa (null) deixa o lote rodar', async () => {
    vi.mocked(schemaReady).mockResolvedValue(null)
    vi.mocked(runCompetitorBatch).mockResolvedValue({ synced: 0, siteIds: [] } as never)
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(vi.mocked(runCompetitorBatch)).toHaveBeenCalledTimes(1)
  })
})

describe('cron de concorrentes: a prova lida a cada disparo', () => {
  const ZERO = { unitsUsed: 0, dailyRecorded: 0, weeklyRecorded: 0, weeklyDeferred: 0, earlyRecorded: 0, fieldsOpened: 0, rawOpened: 0, rawTooBig: 0, missed: 0, newlyMissing: 0, returned: 0, tierChanges: 0, cutByCap: 0, excludedNoCount: 0, promoted: 0, longWindowChanges: 0, partsMissing: 0, quotaErrors: 0 }
  const WEEKLY_ZERO = { ran: false, visited: 0, complete: 0, pending: 0, recorded: 0, deferred: 0, promoted: 0, errors: 0, unitsUsed: 0 }
  const result = (o: Record<string, unknown> = {}) => ({ synced: 0, errors: 0, skipped: 0, remainingDue: 0, stoppedForTime: false, siteIds: [], healthSiteIds: ['s1'], totals: ZERO, weekly: WEEKLY_ZERO, acao_do_dono: [], ...o })
  const OK = { ok: true, problems: [], notes: [] }
  const failMsg = () => vi.mocked(recordCronFailure).mock.calls[0]![1] as string
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv('CRON_SECRET', 'test-secret'); vi.stubEnv('YOUTUBE_API_KEY', 'yt-key')
    vi.mocked(schemaReady).mockResolvedValue(null)
    vi.mocked(batchHealth).mockReturnValue({ ok: true })
    vi.mocked(readSiteHealth).mockResolvedValue(OK)
  })
  it('sem nenhum canal devido a prova é lida do mesmo jeito, e um problema deixa o cron vermelho com o texto', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(result() as never)
    vi.mocked(readSiteHealth).mockResolvedValue({ ok: false, problems: ['2 vídeos da faixa semanal sem ponto há mais de 8 dias'], notes: ['3 fora da prova de série (sem contagem, estreia agendada ou ausente)'] })
    const body = await (await GET(req())).json()
    expect(vi.mocked(recordCronFailure)).toHaveBeenCalledWith('sync-youtube-competitors', 'série e captura: 2 vídeos da faixa semanal sem ponto há mais de 8 dias')
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
    expect(body.prova).toEqual({ ok: false, problems: ['2 vídeos da faixa semanal sem ponto há mais de 8 dias'], notes: ['3 fora da prova de série (sem contagem, estreia agendada ou ausente)'] })
    expect('healthSiteIds' in body).toBe(false)
    expect('siteIds' in body).toBe(false)
  })
  it('lote e prova em ordem: sucesso gravado, e a resposta traz os totais, a fase semanal e a ação do dono', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(result({ synced: 2, siteIds: ['s1'], totals: { ...ZERO, unitsUsed: 8, weeklyRecorded: 3 } }) as never)
    const body = await (await GET(req())).json()
    expect(vi.mocked(recordCronSuccess)).toHaveBeenCalledWith('sync-youtube-competitors', 'info')
    expect(vi.mocked(recordCronFailure)).not.toHaveBeenCalled()
    expect(body).toMatchObject({ mode: 'competitors', synced: 2, totals: { unitsUsed: 8, weeklyRecorded: 3 }, weekly: WEEKLY_ZERO, acao_do_dono: [], prova: { ok: true } })
  })
  it('I: a rota liga a fase semanal (weekly: true) e passa o orçamento do lote', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(result() as never)
    await GET(req())
    expect(vi.mocked(runCompetitorBatch)).toHaveBeenCalledWith(expect.objectContaining({ weekly: true, budgetMs: 200_000, batchSize: 15 }))
  })
  it('uma prova por site com canal', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(result({ healthSiteIds: ['s1', 's2'] }) as never)
    await GET(req())
    expect(vi.mocked(readSiteHealth).mock.calls.map(c => [c[1], c[3]])).toEqual([['s1', { slotDone: true, e2: true }], ['s2', { slotDone: true, e2: true }]])
  })
  describe('A: slotDone — a diária devida sem ponto só é cobrada quando a faixa do disparo terminou', () => {
    // o limite de 2 h (item 5) depende da hora do dia: estes casos rodam 30 min depois do começo de uma faixa
    beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(currentSlotStart(Date.now()) + 30 * 60_000) })
    afterEach(() => { vi.useRealTimers() })
    it.each([
      ['parou por tempo com canais devidos sobrando (o disparo das 18:00)', { remainingDue: 2, stoppedForTime: true }, false],
      ['sobrou canal devido por causa do tamanho do lote, sem parar por tempo', { remainingDue: 4, stoppedForTime: false }, false],
      ['parou por tempo, mesmo sem canal sobrando', { remainingDue: 0, stoppedForTime: true }, false],
      ['terminou a faixa (o disparo das 18:20)', { remainingDue: 0, stoppedForTime: false }, true],
    ] as Array<[string, Record<string, unknown>, boolean]>)('%s → slotDone %s', async (_n, o, expected) => {
      vi.mocked(runCompetitorBatch).mockResolvedValue(result(o) as never)
      await GET(req())
      expect(vi.mocked(readSiteHealth).mock.calls[0]![3]).toEqual({ slotDone: expected, e2: true })
    })
    it('o disparo das 18:00 que parou por tempo não fica vermelho por "diária sem ponto" (a prova não cobra), e o das 18:20 que fecha a faixa cobra', async () => {
      // a prova de verdade devolve problema só quando recebe slotDone: true; aqui o falso obedece o mesmo contrato
      vi.mocked(readSiteHealth).mockImplementation(async (_sb, _site, _now, o) => (o.slotDone ? { ok: false, problems: ['13 vídeos da faixa diária sem ponto hoje'], notes: [] } : OK))
      vi.mocked(runCompetitorBatch).mockResolvedValue(result({ remainingDue: 2, stoppedForTime: true }) as never)
      await GET(req())
      expect(vi.mocked(recordCronFailure)).not.toHaveBeenCalled()
      expect(vi.mocked(recordCronSuccess)).toHaveBeenCalledTimes(1)
      vi.mocked(runCompetitorBatch).mockResolvedValue(result({ remainingDue: 0, stoppedForTime: false }) as never)
      await GET(req())
      expect(vi.mocked(recordCronFailure)).toHaveBeenCalledWith('sync-youtube-competitors', 'série e captura: 13 vídeos da faixa diária sem ponto hoje')
    })
  })
  describe('B: a lista de sites vazia nunca é verde por acaso', () => {
    it('nenhum canal de concorrente ativo (lote sem erro, nada tentado): verde com nota explícita, e a prova não é lida', async () => {
      vi.mocked(runCompetitorBatch).mockResolvedValue(result({ healthSiteIds: [] }) as never)
      const body = await (await GET(req())).json()
      expect(vi.mocked(readSiteHealth)).not.toHaveBeenCalled()
      expect(vi.mocked(recordCronSuccess)).toHaveBeenCalledTimes(1)
      expect(body.prova).toEqual({ ok: true, problems: [], notes: ['nenhum canal de concorrente ativo'] })
    })
    it('lista vazia, mas o lote tentou canais: a leitura dos sites falhou — vermelho', async () => {
      vi.mocked(runCompetitorBatch).mockResolvedValue(result({ healthSiteIds: [], synced: 3 }) as never)
      const body = await (await GET(req())).json()
      expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
      expect(failMsg()).toMatch(/lista de sites/)
      expect(body.prova.ok).toBe(false)
    })
    it('lista de sites ausente ou fora da forma: vermelho', async () => {
      for (const bad of [undefined, null, 'x']) {
        vi.clearAllMocks(); vi.mocked(schemaReady).mockResolvedValue(null); vi.mocked(batchHealth).mockReturnValue({ ok: true })
        vi.mocked(runCompetitorBatch).mockResolvedValue(result({ healthSiteIds: bad }) as never)
        await GET(req())
        expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
        expect(failMsg()).toMatch(/lista de sites/)
      }
    })
  })
  it('lote com metade dos canais em erro E prova com problema: uma falha só, com os dois textos', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(result({ synced: 1, errors: 14 }) as never)
    vi.mocked(batchHealth).mockReturnValue({ ok: false, message: '14 de 15 canais falharam' })
    vi.mocked(readSiteHealth).mockResolvedValue({ ok: false, problems: ['cota do dia não registrada (15 canais lidos)'], notes: [] })
    await GET(req())
    expect(vi.mocked(recordCronFailure).mock.calls).toEqual([['sync-youtube-competitors', '14 de 15 canais falharam | série e captura: cota do dia não registrada (15 canais lidos)']])
  })
  it('vários sites com a mesma frase fixa: a frase aparece uma vez', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(result({ healthSiteIds: ['s1', 's2'] }) as never)
    vi.mocked(readSiteHealth).mockResolvedValue({ ok: false, problems: ['não foi possível ler a prova da captura'], notes: [] })
    const body = await (await GET(req())).json()
    expect(body.prova.problems).toEqual(['não foi possível ler a prova da captura'])
  })
  describe('F: a mensagem do cron cabe em 480 caracteres, e o corte nunca esconde um vermelho atrás de nota', () => {
    const phrase = (i: number) => 'problema número ' + i + ' com texto comprido'
    it('o pior caso (11 frases, 535 caracteres) é cortado em frase inteira, com "e mais N avisos", e a primeira frase vermelha está lá', async () => {
      const problems = [
        '8 vídeos lidos sem resposta guardada', '3 canais lidos sem resposta guardada', 'cota do dia não registrada (15 canais lidos)', '2 canais em erro há mais de 12 h',
        '120 vídeos sem faixa de série', '4 buracos na série diária nos últimos 3 dias', '5 vídeos da faixa semanal sem ponto há 9 dias ou mais (intervalo perdido)',
        '6 vídeos da faixa semanal no 8º dia sem ponto', '7 vídeos da faixa semanal devidos hoje e ainda sem ponto', '9 vídeos sem cópia da miniatura depois de 9 dias', '13 vídeos da faixa diária sem ponto hoje',
      ]
      vi.mocked(runCompetitorBatch).mockResolvedValue(result({ quotaLost: 12 }) as never)
      vi.mocked(readSiteHealth).mockResolvedValue({ ok: false, problems, notes: ['uma nota qualquer'] })
      await GET(req())
      const msg = failMsg()
      expect(msg.length).toBeLessThanOrEqual(480)
      expect(msg.startsWith('série e captura: 8 vídeos lidos sem resposta guardada; 3 canais lidos')).toBe(true)
      expect(msg).toMatch(/ \| e mais \d+ avisos?$/)
      expect(msg).not.toContain('uma nota qualquer')
      // item 8: a frase da cota (vermelha, e a única que a prova não repete) NUNCA é a primeira cortada: perdem as últimas frases da prova
      expect(msg).toContain('12 unidades de cota não registradas')
      // quantas frases da prova foram ditas + quantas ficaram para o "e mais N" = as 11 da prova
      const said = problems.filter(p => msg.includes(p)).length
      const n = Number(/e mais (\d+) avisos?$/.exec(msg)![1])
      expect(said + n).toBe(11)
      // o corte é entre frases: nenhuma frase aparece pela metade
      for (const p of problems) { const head = p.slice(0, 20); if (msg.includes(head)) expect(msg).toContain(p) }
    })
    it('40 frases longas: cabem 480, a primeira vai inteira, e o fim diz quantas ficaram de fora', async () => {
      vi.mocked(runCompetitorBatch).mockResolvedValue(result() as never)
      vi.mocked(readSiteHealth).mockResolvedValue({ ok: false, problems: Array.from({ length: 40 }, (_, i) => phrase(i)), notes: [] })
      await GET(req())
      const msg = failMsg()
      expect(msg.length).toBeLessThanOrEqual(480)
      expect(msg.startsWith('série e captura: ' + phrase(0) + '; ' + phrase(1))).toBe(true)
      const n = Number(/e mais (\d+) avisos$/.exec(msg)![1])
      expect(msg.split('; ').length + n).toBe(40)
    })
    it('mensagem que cabe não é tocada', async () => {
      vi.mocked(runCompetitorBatch).mockResolvedValue(result() as never)
      vi.mocked(readSiteHealth).mockResolvedValue({ ok: false, problems: [phrase(1), phrase(2)], notes: [] })
      await GET(req())
      expect(failMsg()).toBe('série e captura: ' + phrase(1) + '; ' + phrase(2))
    })
    it('o texto do lote (vermelho) e o da cota vêm sem sumir quando cabem, e o da prova é que perde as últimas frases', async () => {
      vi.mocked(runCompetitorBatch).mockResolvedValue(result({ quotaLost: 5 }) as never)
      vi.mocked(batchHealth).mockReturnValue({ ok: false, message: '14 de 15 canais falharam' })
      vi.mocked(readSiteHealth).mockResolvedValue({ ok: false, problems: Array.from({ length: 40 }, (_, i) => phrase(i)), notes: [] })
      await GET(req())
      const msg = failMsg()
      expect(msg.startsWith('14 de 15 canais falharam | série e captura: ' + phrase(0))).toBe(true)
      expect(msg.length).toBeLessThanOrEqual(480)
    })
    it('uma frase sozinha maior que o limite é cortada com reticências, nunca passa de 480', async () => {
      vi.mocked(runCompetitorBatch).mockResolvedValue(result() as never)
      vi.mocked(readSiteHealth).mockResolvedValue({ ok: false, problems: ['x'.repeat(900)], notes: [] })
      await GET(req())
      expect(failMsg().length).toBe(480)
      expect(failMsg().endsWith('…')).toBe(true)
    })
  })
  describe('item 8: a cota perdida é vermelha e sobrevive ao corte da mensagem', () => {
    it('com 40 frases da prova, a cota e o lote vão inteiros, a prova perde as últimas frases e o fim diz quantas', async () => {
      vi.mocked(runCompetitorBatch).mockResolvedValue(result({ quotaLost: 37 }) as never)
      vi.mocked(batchHealth).mockReturnValue({ ok: false, message: '3 de 5 canais falharam' })
      vi.mocked(readSiteHealth).mockResolvedValue({ ok: false, problems: Array.from({ length: 40 }, (_, i) => 'problema número ' + i + ' com texto comprido'), notes: ['uma nota'] })
      await GET(req())
      const msg = failMsg()
      expect(msg.length).toBeLessThanOrEqual(480)
      expect(msg.startsWith('3 de 5 canais falharam | série e captura: problema número 0 com texto comprido')).toBe(true)
      expect(msg).toContain(' | 37 unidades de cota não registradas')
      expect(msg).toMatch(/ \| e mais \d+ avisos$/)
      expect(msg).not.toContain('uma nota')
      expect(msg.indexOf('37 unidades')).toBeGreaterThan(msg.indexOf('problema número 0'))
    })
    it('cota perdida sozinha (sem lote nem prova vermelhos) continua uma falha, com a frase inteira', async () => {
      vi.mocked(runCompetitorBatch).mockResolvedValue(result({ quotaLost: 4 }) as never)
      await GET(req())
      expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
      expect(failMsg()).toBe('4 unidades de cota não registradas')
    })
    it('lote e cota sem prova vermelha: o lote vem primeiro', async () => {
      vi.mocked(runCompetitorBatch).mockResolvedValue(result({ quotaLost: 1 }) as never)
      vi.mocked(batchHealth).mockReturnValue({ ok: false, message: '3 de 5 canais falharam' })
      await GET(req())
      expect(failMsg()).toBe('3 de 5 canais falharam | 1 unidade de cota não registrada')
    })
  })
  describe('item 4 (I-4): a prova e a gravação do resumo têm relógio', () => {
    const T0 = Date.parse('2026-10-24T15:00:00.000Z')
    beforeEach(() => { vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] }); vi.setSystemTime(T0) })
    afterEach(() => { vi.useRealTimers() })
    it('o lote que terminou aos 270 s deixa 15 s para a prova (300 - 15 de reserva - 270), não 20: estourou, vermelho "a tempo", e o registro do cron é gravado', async () => {
      vi.mocked(runCompetitorBatch).mockImplementation(async () => { vi.setSystemTime(T0 + 270_000); return result() as never })
      vi.mocked(readSiteHealth).mockReturnValue(new Promise(() => undefined))
      const pending = GET(req())
      await vi.advanceTimersByTimeAsync(14_999)
      expect(vi.mocked(recordCronFailure)).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      const res = await pending
      expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
      expect(vi.mocked(recordCronFailure)).toHaveBeenCalledWith('sync-youtube-competitors', expect.stringMatching(/não foi possível ler a prova a tempo.*passou de 15 s/))
      expect(res.status).toBe(200) // a resposta do cron sai, com a prova vermelha
    })
    it('o lote que terminou tarde demais (290 s): a prova ainda tem o mínimo de 3 s, nunca zero', async () => {
      vi.mocked(runCompetitorBatch).mockImplementation(async () => { vi.setSystemTime(T0 + 290_000); return result() as never })
      vi.mocked(readSiteHealth).mockReturnValue(new Promise(() => undefined))
      const pending = GET(req())
      await vi.advanceTimersByTimeAsync(2_999)
      expect(vi.mocked(recordCronFailure)).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      await pending
      expect(vi.mocked(recordCronFailure)).toHaveBeenCalledWith('sync-youtube-competitors', expect.stringMatching(/a tempo.*passou de 3 s/))
    })
    it('lote rápido (5 s): a prova tem o teto cheio de 20 s', async () => {
      vi.mocked(runCompetitorBatch).mockImplementation(async () => { vi.setSystemTime(T0 + 5_000); return result() as never })
      vi.mocked(readSiteHealth).mockReturnValue(new Promise(() => undefined))
      const pending = GET(req())
      await vi.advanceTimersByTimeAsync(19_999)
      expect(vi.mocked(recordCronFailure)).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      await pending
      expect(vi.mocked(recordCronFailure)).toHaveBeenCalledWith('sync-youtube-competitors', expect.stringMatching(/a tempo.*passou de 20 s/))
    })
    it('o lote que não volta até 285 s (300 - 15 de reserva): o cron grava "o disparo passou do tempo" em vez de morrer sem registro, e a prova não é lida', async () => {
      vi.mocked(runCompetitorBatch).mockReturnValue(new Promise(() => undefined))
      const pending = GET(req())
      await vi.advanceTimersByTimeAsync(284_999)
      expect(vi.mocked(recordCronFailure)).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      const res = await pending
      expect(res.status).toBe(500)
      expect(vi.mocked(recordCronFailure)).toHaveBeenCalledWith('sync-youtube-competitors', expect.stringMatching(/disparo passou do tempo/))
      expect(vi.mocked(readSiteHealth)).not.toHaveBeenCalled()
      expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
    })
  })
  describe('item 5: a faixa que nunca termina não deixa a diária sem cobrança para sempre', () => {
    const SLOT = Date.parse('2026-10-24T21:00:00.000Z') // 18:00 em São Paulo
    beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }) })
    afterEach(() => { vi.useRealTimers() })
    const run = async (minAfterSlot: number, o: Record<string, unknown>) => {
      vi.mocked(readSiteHealth).mockClear()
      vi.setSystemTime(SLOT + minAfterSlot * 60_000)
      vi.mocked(runCompetitorBatch).mockResolvedValue(result(o) as never)
      await GET(req())
      return (vi.mocked(readSiteHealth).mock.calls[0]![3] as { slotDone: boolean }).slotDone
    }
    it('faixa não terminada (canais devidos sobrando): até 2 h depois do começo não cobra; passadas 2 h cobra de qualquer jeito', async () => {
      expect(await run(119, { remainingDue: 3, stoppedForTime: true })).toBe(false)
      expect(await run(120, { remainingDue: 3, stoppedForTime: true })).toBe(false) // exatamente 2 h: ainda não
      expect(await run(121, { remainingDue: 3, stoppedForTime: true })).toBe(true)
      expect(await run(300, { remainingDue: 3, stoppedForTime: false })).toBe(true)
    })
    it('a faixa terminada cobra em qualquer minuto', async () => {
      expect(await run(1, { remainingDue: 0, stoppedForTime: false })).toBe(true)
    })
  })
  describe('item 7: a fase semanal desligada não deixa a prova vermelha todo dia', () => {
    it('a rota usa UMA constante para ligar a fase e para a prova (weekly: true no lote; só um false chegaria à prova)', async () => {
      const src = (await import('node:fs')).readFileSync('src/app/api/cron/sync-youtube/route.ts', 'utf8')
      expect(src).toMatch(/const WEEKLY_PHASE: boolean = true/)
      expect(src).toMatch(/weekly: WEEKLY_PHASE\b/)
      expect(src).toMatch(/\.\.\.\(WEEKLY_PHASE \? \{\} : \{ weekly: false \}\)/)
    })
    it('ligada (o padrão), a prova NÃO recebe a opção weekly: o contrato de "omitido = cobra" fica como era', async () => {
      vi.mocked(runCompetitorBatch).mockResolvedValue(result() as never)
      await GET(req())
      expect(vi.mocked(readSiteHealth).mock.calls[0]![3]).not.toHaveProperty('weekly')
    })
  })
  it('a prova que lança (banco fora) não vira verde: o cron falha', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(result() as never)
    vi.mocked(readSiteHealth).mockRejectedValue(new Error('rede'))
    await GET(req())
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
    expect(vi.mocked(recordCronFailure)).toHaveBeenCalledWith('sync-youtube-competitors', expect.stringMatching(/não foi possível ler a prova/))
  })
  it('a prova que demora mais de 20 s: falha gravada com "passou de 20 s"', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      vi.mocked(runCompetitorBatch).mockResolvedValue(result() as never)
      vi.mocked(readSiteHealth).mockReturnValue(new Promise(() => undefined))
      const pending = GET(req())
      await vi.advanceTimersByTimeAsync(20_000)
      await pending
      expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
      expect(vi.mocked(recordCronFailure)).toHaveBeenCalledWith('sync-youtube-competitors', expect.stringMatching(/passou de 20 s/))
    } finally { vi.useRealTimers() }
  })
  it('E: canal em erro há mais de 3 dias: o cron fica VERDE e a resposta traz acao_do_dono em toda execução', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(result({ acao_do_dono: ['canal X em erro há 4 dias: não encontrado no YouTube (404)'] }) as never)
    vi.mocked(readSiteHealth).mockResolvedValue({ ok: true, problems: [], notes: ['1 canal em erro há mais de 3 dias (ver acao_do_dono)'] })
    const body = await (await GET(req())).json()
    expect(vi.mocked(recordCronSuccess)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(recordCronFailure)).not.toHaveBeenCalled()
    expect(body.acao_do_dono).toEqual(['canal X em erro há 4 dias: não encontrado no YouTube (404)'])
    expect(body.prova.notes).toEqual(['1 canal em erro há mais de 3 dias (ver acao_do_dono)'])
  })
  describe('D: a cota que não foi registrada nunca é verde mudo', () => {
    it('depois da nova tentativa ainda faltam unidades: o cron falha com a frase "N unidades de cota não registradas"', async () => {
      vi.mocked(runCompetitorBatch).mockResolvedValue(result({ quotaLost: 12 }) as never)
      const body = await (await GET(req())).json()
      expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
      expect(vi.mocked(recordCronFailure)).toHaveBeenCalledWith('sync-youtube-competitors', '12 unidades de cota não registradas')
      expect(body.quotaLost).toBe(12)
    })
    it('1 unidade: singular', async () => {
      vi.mocked(runCompetitorBatch).mockResolvedValue(result({ quotaLost: 1 }) as never)
      await GET(req())
      expect(failMsg()).toBe('1 unidade de cota não registrada')
    })
    it('a cota recuperada na nova tentativa (quotaLost indefinido) não suja o cron, mas os totais mostram o que aconteceu', async () => {
      vi.mocked(runCompetitorBatch).mockResolvedValue(result({ totals: { ...ZERO, quotaErrors: 2, quotaUnitsLost: 8 } }) as never)
      const body = await (await GET(req())).json()
      expect(vi.mocked(recordCronSuccess)).toHaveBeenCalledTimes(1)
      expect(body.totals).toMatchObject({ quotaErrors: 2, quotaUnitsLost: 8 })
    })
  })
})

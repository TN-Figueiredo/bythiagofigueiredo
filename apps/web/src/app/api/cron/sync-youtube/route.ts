import { timingSafeEqual } from 'node:crypto'
import { NextRequest } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'
import { syncChannel, YouTubeQuotaError } from '@/lib/youtube/sync'
import { runCompetitorBatch, batchHealth, currentSlotStart, BATCH_BUDGET_MS, COMPETITORS_MAX_DURATION_S, PROOF_TIMEOUT_MS, RECORD_RESERVE_MS, SLOT_COVER_LIMIT_MS, type BatchResult } from '@/lib/youtube/competitor-sync-batch'
import { schemaReady, readSiteHealth } from '@/lib/youtube/competitor-health'
import { CATALOGO, agendaLigada } from '@/lib/youtube/agenda/catalogo'
import { antesDoLoteAntigo, executarAgenda, rodarAntesDoLoteAntigo, type AntesDoLote, type CaminhoSemAgenda } from '@/lib/youtube/agenda/executar'
import { PROOF_MIN_MS, failureMessage, plural, readProofWithin } from '@/lib/youtube/agenda/fecho'
import { invalidateObservatory } from '@/lib/youtube/observatorio/cache-tag'
import { isInPostingWindow } from '@/lib/youtube/schedule-window'
import { pollVideoStats, shouldSkipPoll, getLastPollTime, insertPollData } from '@/lib/youtube/ab-polls'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import type { YouTubeChannelRow, SyncMode } from '@/lib/youtube/types'

export const runtime = 'nodejs'
export const maxDuration = 300

/** O que o disparo inteiro pode durar: o `maxDuration` abaixo, em ms (um teste confere os dois). */
const FUNCTION_LIMIT_MS = COMPETITORS_MAX_DURATION_S * 1000
/**
 * A fase semanal do lote. UMA constante liga a fase no lote e diz à prova se ela está ligada: desligar só a fase deixaria a prova cobrando
 * os semanais devidos e o cron vermelho todo dia às 19:00. Trocar por `false` desliga a fase E a cobrança dos semanais (a prova fica com a nota "fase semanal desligada").
 * Com ela desligada também deixa de rodar a promoção nova de vídeo semanal que cresce (ela só acontece na visita semanal).
 */
const WEEKLY_PHASE: boolean = true
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!expected || !authHeader) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const expectedBuf = Buffer.from(`Bearer ${expected}`)
  const actualBuf = Buffer.from(authHeader)
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const rawMode = req.nextUrl.searchParams.get('mode') ?? 'catchall'
  if (!['schedule', 'catchall', 'metrics', 'manual', 'ab-poll', 'competitors'].includes(rawMode)) {
    return Response.json({ error: 'invalid mode' }, { status: 400 })
  }
  const mode = rawMode as SyncMode

  const channelId = req.nextUrl.searchParams.get('channelId')
  if (channelId && !UUID_RE.test(channelId)) {
    return Response.json({ error: 'invalid channelId' }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'external service not configured' }, { status: 500 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  const lockKey = channelId ? `sync-youtube-${mode}-${channelId}` : `sync-youtube-${mode}`

  // Critico 1b (docs/superpowers/plans/2026-09-02-falhas-silenciosas.md): the
  // `job` tag passed to withCronLock used to be the literal string
  // 'sync-youtube' for EVERY mode. cron_health already tracks 3 distinct keys
  // for this route's 5 vercel.json schedules ('sync-youtube',
  // 'sync-youtube-ab-poll', 'sync-youtube-competitors' — see
  // src/app/api/health/route.ts's resolveCronName), but the wrapper's own
  // best-effort instrumentation didn't know that: after ANY mode returned
  // (almost always status 'ok', see below), it stamped success onto the
  // 'sync-youtube' key regardless of which mode actually ran. Since ab-poll
  // fires every 30 minutes, that stamped 'sync-youtube' healthy every 30
  // minutes even while the metrics/schedule/catchall modes that actually own
  // that key were silently dead. Aligning the tag to the mode fixes the
  // wrapper's own default-write target; `health_written: true` below (each
  // branch already calls recordCronSuccess/recordCronFailure itself with the
  // precise key) is what stops the wrapper from writing a second, possibly
  // contradictory, time.
  const jobTag = mode === 'ab-poll' ? 'sync-youtube-ab-poll' : mode === 'competitors' ? 'sync-youtube-competitors' : 'sync-youtube'

  // Os concorrentes (A5 E16): o relógio do disparo nasce AQUI, antes de tudo, e a agenda (ou a lista que roda antes do lote antigo) conta dele.
  // `agendaLigada()` decide antes de `executarAgenda`: com `OBS_AGENDA=off` a agenda NÃO é chamada e o lote antigo roda inteiro, como era.
  const t0 = Date.now()
  let semAgenda: string | undefined
  let antes: AntesDoLote = { tarefas: [], problemas: [], notas: [] }
  let caminho: CaminhoSemAgenda | undefined
  if (mode === 'competitors') {
    if (agendaLigada()) {
      const r = await executarAgenda({ supabase, apiKey, runId, t0 })
      if (r.resposta) return r.resposta
      semAgenda = r.semAgenda // a guarda da MG10 falhou: o lote antigo coleta no lugar e o cron fica vermelho com esta frase
      caminho = 'guarda_mg10'
    } else {
      caminho = 'interruptor'
    }
    antes = await rodarAntesDoLoteAntigo({ supabase, apiKey, runId, t0, caminho })
  }
  // O que a resposta do lote antigo acrescenta (neutro quando a lista rodou nada e a agenda não é a causa): ver o ponto (iv) da Tarefa 12.
  const alemDoLote = (): Record<string, unknown> => ({
    ...(antes.tarefas.length > 0 ? { antes_do_lote: antes.tarefas } : {}),
    ...(antes.notas.length > 0 ? { notas_antes: antes.notas } : {}),
    ...(caminho === 'interruptor' ? { agenda_desligada: CATALOGO.filter(t => !antesDoLoteAntigo.some(a => a.nome === t.nome)).map(t => t.rotulo) } : {}),
  })

  return withCronLock(supabase, lockKey, runId, jobTag, async () => {
    // AB Lab poll mode — separate flow
    if (mode === 'ab-poll') {
      const { data: activeTests, error: activeTestsError } = await supabase
        .from('ab_tests')
        .select('id, youtube_video_id')
        .eq('status', 'active')

      // Mesmo buraco do branch `channelsError` abaixo: um erro de query aqui
      // caia em `activeTests === null` -> "sem testes ativos" -> sucesso
      // gravado sobre um erro nunca visto.
      if (activeTestsError) {
        Sentry.captureMessage(`sync-youtube: ab_tests query failed: ${activeTestsError.message}`)
        await recordCronFailure('sync-youtube-ab-poll', activeTestsError.message, 'info')
        return { status: 'error' as const, mode: 'ab-poll', error: activeTestsError.message, health_written: true }
      }

      if (!activeTests?.length) {
        await recordCronSuccess('sync-youtube-ab-poll', 'info')
        return { status: 'ok' as const, mode: 'ab-poll', polled: 0, health_written: true }
      }

      let polled = 0
      for (const test of activeTests) {
        const lastPoll = await getLastPollTime(supabase, test.id)
        if (shouldSkipPoll(lastPoll)) continue

        // Get external YouTube video ID
        const { data: video } = await supabase
          .from('youtube_videos')
          .select('youtube_video_id')
          .eq('id', test.youtube_video_id)
          .single()

        if (!video?.youtube_video_id) continue

        const stats = await pollVideoStats(video.youtube_video_id, apiKey)
        if (!stats) continue

        // Get the active variant from open cycle
        const { data: openCycle } = await supabase
          .from('ab_test_cycles')
          .select('variant_id')
          .eq('test_id', test.id)
          .is('ended_at', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (openCycle?.variant_id) {
          await insertPollData(supabase, test.id, openCycle.variant_id, stats.views, stats.likes, 'cron')
        }
        polled++
      }

      await recordCronSuccess('sync-youtube-ab-poll', 'info')
      return { status: 'ok' as const, mode: 'ab-poll', polled, health_written: true }
    }

    // Competitor observatory mode — separate flow
    if (mode === 'competitors') {
      // BATCH_SIZE 15 + cron */20: spike S2 (docs/superpowers/plans/2026-10-02-observatorio-spikes-s2.md)
      const BATCH_SIZE = 15
      // A guarda de schema roda ANTES de qualquer canal: sem a migration o sync já lê colunas novas na trava do canal, e a
      // série diária de todos cairia. Vermelho na primeira linha, nada gravado. O sync lê e grava colunas e tabelas da MG2 (faixa da série), então a guarda confere as duas.
      const notReady = await schemaReady(supabase, 'e1e2')
      if (notReady) {
        await recordCronFailure('sync-youtube-competitors', failureMessage({ semAgenda, tarefas: antes.problemas, lote: notReady, prova: [], cota: null }))
        return { status: 'error' as const, mode: 'competitors', error: notReady, ...alemDoLote(), health_written: true }
      }
      let result: BatchResult
      // `t0` (o relógio da FUNÇÃO) nasce acima, antes da agenda: a prova e a gravação do resumo descontam o que o disparo já gastou
      let batchTimer: ReturnType<typeof setTimeout> | undefined
      try {
        // Se o lote não voltar a tempo (uma operação sem teto travou), o disparo grava a falha em vez de morrer aos 300 s sem registro nenhum.
        // O prazo conta de `t0`, não do começo do lote: o que a lista antes do lote gastou sai dele (senão o lote pendurado morreria sem `cron_health`).
        const late = new Promise<never>((_, reject) => { batchTimer = setTimeout(() => reject(new Error('o disparo passou do tempo: o lote não terminou em ' + Math.round((FUNCTION_LIMIT_MS - RECORD_RESERVE_MS) / 1000) + ' s')), Math.max(0, FUNCTION_LIMIT_MS - RECORD_RESERVE_MS - (Date.now() - t0))) })
        late.catch(() => undefined) // a corrida abaixo é quem trata; sem isto a rejeição tardia (lote que terminou antes) viraria erro solto
        // `weekly: WEEKLY_PHASE` liga a fase semanal do disparo; a volta é UMA linha (a constante acima), que também avisa a prova
        result = await Promise.race([runCompetitorBatch({ apiKey, batchSize: BATCH_SIZE, budgetMs: BATCH_BUDGET_MS, weekly: WEEKLY_PHASE, started: t0 }), late])
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        Sentry.captureException(err, { tags: { component: 'sync-youtube', mode: 'competitors' } })
        await recordCronFailure('sync-youtube-competitors', failureMessage({ semAgenda, tarefas: antes.problemas, lote: message, prova: [], cota: null }))
        return { status: 'error' as const, mode: 'competitors', error: message, ...alemDoLote(), health_written: true }
      } finally {
        clearTimeout(batchTimer)
      }
      const health = batchHealth(result)
      // A prova é lida do banco a CADA disparo (mesmo sem canal devido): uma perda fica vermelha até ser consertada.
      // Só cobra "diária devida sem ponto" quando a faixa do disparo terminou: sem canal devido sobrando e sem ter parado por tempo.
      // Passadas SLOT_COVER_LIMIT_MS do começo da faixa, cobra de qualquer jeito: uma faixa que nunca termina (um canal que sempre estoura o tempo,
      // ou mais canais do que cabem) deixaria a diária sem cobrança para sempre, um verde falso permanente.
      const nowMs = Date.now()
      const slotDone = (result.remainingDue === 0 && !result.stoppedForTime) || nowMs - currentSlotStart(nowMs) > SLOT_COVER_LIMIT_MS
      const nowIso = new Date(nowMs).toISOString()
      // O tempo da prova: o teto próprio, ou o que resta do disparo depois da reserva do registro, o que for menor (e nunca menos que PROOF_MIN_MS).
      const proofMs = Math.max(PROOF_MIN_MS, Math.min(PROOF_TIMEOUT_MS, FUNCTION_LIMIT_MS - RECORD_RESERVE_MS - (nowMs - t0)))
      let prova: { ok: boolean; problems: string[]; notes: string[] }
      if (!Array.isArray(result.healthSiteIds)) {
        // a lista de sites não veio: não dá para saber o que ler, e "nada lido" nunca é verde
        prova = { ok: false, problems: ['não foi possível ler a lista de sites da prova'], notes: [] }
      } else if (result.healthSiteIds.length === 0) {
        // [].every() é verdadeiro: lista vazia tem que ser decidida de propósito. Lote que tentou canais com a lista vazia é leitura que falhou.
        prova = result.synced + result.errors + result.skipped > 0
          ? { ok: false, problems: ['não foi possível ler a lista de sites da prova (veio vazia com canais tentados)'], notes: [] }
          : { ok: true, problems: [], notes: ['nenhum canal de concorrente ativo'] }
      } else {
        const verdicts = await Promise.all(result.healthSiteIds.map(siteId => readProofWithin(() => readSiteHealth(supabase, siteId, nowIso, { slotDone, e2: true, ...(WEEKLY_PHASE ? {} : { weekly: false }) }), proofMs)))
        prova = { ok: verdicts.every(v => v.ok), problems: [...new Set(verdicts.flatMap(v => v.problems))], notes: [...new Set(verdicts.flatMap(v => v.notes))] }
      }
      // Cota que nem a nova tentativa do fim do disparo conseguiu gravar: o cron só tem verde e vermelho, e verde mudo é o que não pode
      const quota = result.quotaLost ? plural(result.quotaLost, 'unidade', 'unidades') + ' de cota ' + (result.quotaLost === 1 ? 'não registrada' : 'não registradas') : null
      if (!health.ok || !prova.ok || quota || semAgenda || antes.problemas.length > 0) {
        await recordCronFailure('sync-youtube-competitors', failureMessage({ semAgenda, tarefas: antes.problemas, lote: health.ok ? null : (health.message ?? 'batch failed'), prova: prova.ok ? [] : prova.problems, cota: quota }))
      } else {
        await recordCronSuccess('sync-youtube-competitors', 'info')
      }
      if (result.synced > 0) revalidatePath('/cms/youtube/competitors', 'layout')
      // the cached heavy rows of every site this run wrote to (errored channels keep partial data)
      const { siteIds, healthSiteIds: _healthSiteIds, ...summary } = result
      for (const siteId of siteIds) invalidateObservatory(siteId)
      return { status: 'ok' as const, mode: 'competitors', ...summary, prova, ...alemDoLote(), health_written: true }
    }

    let query = supabase
      .from('youtube_channels')
      .select('*')
      .eq('sync_enabled', true)

    if (channelId) {
      query = query.eq('id', channelId)
    }

    const { data: channels, error: channelsError } = await query

    // Um erro de query dropado aqui caía em `channels === null` -> "no
    // channels configured" -> sucesso implícito via withCronLock (o mesmo
    // buraco do Importante 3, plano 2026-09-02-falhas-silenciosas, já
    // fechado em sync-analytics-metrics/weekly-grade-snapshot/
    // youtube-intelligence-dispatch/send-welcome-emails). Distinguir "a
    // query falhou" de "não há canais configurados".
    if (channelsError) {
      Sentry.captureMessage(`sync-youtube: channels query failed: ${channelsError.message}`)
      await recordCronFailure('sync-youtube', channelsError.message, 'critical')
      return { status: 'error' as const, error: channelsError.message, health_written: true }
    }

    if (!channels || channels.length === 0) {
      return { status: 'ok' as const, message: 'no channels configured' }
    }

    let totalInserted = 0
    let totalUpdated = 0
    let totalQuota = 0
    const channelResults: Array<{ id: string; name: string; status: string; detail?: string }> = []

    for (const channel of channels as YouTubeChannelRow[]) {
      if (mode === 'schedule' && !isInPostingWindow(channel.sync_schedules)) {
        channelResults.push({ id: channel.id, name: channel.name, status: 'skipped', detail: 'outside posting window' })
        continue
      }

      const { data: logRow, error: logInsertErr } = await supabase.from('youtube_sync_log').insert({
        site_id: channel.site_id,
        channel_id: channel.id,
        mode,
        status: 'started',
      }).select('id').single()

      if (logInsertErr) {
        Sentry.captureException(logInsertErr, {
          tags: { component: 'sync-youtube', stage: 'log-insert' },
          extra: { channelId: channel.id, siteId: channel.site_id },
        })
      }

      const logId = logRow?.id

      try {
        const result = await syncChannel(supabase, channel, apiKey, mode)
        totalInserted += result.videosInserted
        totalUpdated += result.videosUpdated
        totalQuota += result.quotaUsed
        channelResults.push({
          id: channel.id,
          name: channel.name,
          status: 'completed',
          detail: `found=${result.videosFound} inserted=${result.videosInserted} updated=${result.videosUpdated} quota=${result.quotaUsed}`,
        })

        if (logId) {
          await supabase.from('youtube_sync_log').update({
            status: 'completed',
            videos_found: result.videosFound,
            videos_inserted: result.videosInserted,
            videos_updated: result.videosUpdated,
            quota_used: result.quotaUsed,
            completed_at: new Date().toISOString(),
          }).eq('id', logId)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const errorMsg = err instanceof YouTubeQuotaError ? 'quotaExceeded' : message
        channelResults.push({ id: channel.id, name: channel.name, status: 'failed', detail: errorMsg })

        if (logId) {
          await supabase.from('youtube_sync_log').update({
            status: 'failed',
            error_message: errorMsg,
            completed_at: new Date().toISOString(),
          }).eq('id', logId)
        }

        if (err instanceof YouTubeQuotaError) {
          await recordCronFailure('sync-youtube', 'quotaExceeded', 'critical')
          return { status: 'error' as const, error: 'quotaExceeded', quota_used: totalQuota, channels: channelResults, health_written: true }
        }

        Sentry.captureException(err, {
          tags: { component: 'sync-youtube', mode },
          extra: { channelId: channel.id, siteId: channel.site_id },
        })
      }
    }

    revalidateTag('youtube', { expire: 0 })
    revalidateTag('layout-counts', { expire: 0 })
    revalidatePath('/cms/youtube')

    const failedChannels = channelResults.filter(c => c.status === 'failed')
    if (failedChannels.length === 0) {
      await recordCronSuccess('sync-youtube', 'critical')
    } else {
      await recordCronFailure('sync-youtube', `${failedChannels.length} channel(s) failed`, 'critical')
    }

    return {
      status: 'ok' as const,
      mode,
      inserted: totalInserted,
      updated: totalUpdated,
      quota_used: totalQuota,
      channels: channelResults,
      health_written: true,
    }
  })
}

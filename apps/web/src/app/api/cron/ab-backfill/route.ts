import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken, NoActiveConnectionError } from '@/lib/social/token-refresh'
import { channelAccountIdForVideo } from '@/lib/youtube/channel-account'
import { fetchAnalyticsForDateRange } from '@/lib/youtube/ab-youtube'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'

export const maxDuration = 120

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  // Get cycles that need backfilling (ended 3+ days ago)
  const { data: cycles, error: cyclesError } = await supabase
    .from('ab_test_cycles')
    .select('*')
    .in('backfill_status', ['pending', 'partial'])
    .not('ended_at', 'is', null)
    .lt('ended_at', threeDaysAgo)
    // Teto por execução, mais recentes primeiro: ciclos pulados (sem conexão) não se
    // acumulam para sempre na frente da fila nem estouram o tempo da função.
    .order('ended_at', { ascending: false })
    .limit(200)

  // Um erro de query dropado aqui caia em `cycles === null` -> "nada a
  // processar" -> recordCronSuccess (ver comentario abaixo), afirmando saude
  // sobre um erro que ninguem olhou. Mesmo padrao ja fechado em
  // sync-analytics-metrics/weekly-grade-snapshot/sync-youtube(channelsError).
  if (cyclesError) {
    Sentry.captureException(cyclesError, {
      tags: { cron: 'ab-backfill' },
      extra: { stage: 'select-cycles' },
    })
    await recordCronFailure('ab-backfill', cyclesError.message, 'critical').catch((e) =>
      console.error('[cron-health] write failed:', e)
    )
    return Response.json({ status: 'error', error: cyclesError.message }, { status: 500 })
  }

  if (!cycles || cycles.length === 0) {
    // Nada a processar não é falha — é sucesso (não há ciclo elegível para
    // backfill agora). Sem esse registro, cron_health nunca é atualizado
    // nesse caminho e /api/health passa a acusar "down" todo dia mesmo com
    // o cron rodando normalmente (falso alarme diário).
    await recordCronSuccess('ab-backfill', 'critical').catch((e) =>
      console.error('[cron-health] write failed:', e)
    )
    return Response.json({ status: 'ok', backfilled: 0 })
  }

  let backfilled = 0
  let errors = 0
  // Ciclos pulados por falta de token do canal dono do vídeo (canal sem conexão
  // OAuth, ou vídeo sem canal). Não são erro nem "sem dados": ninguém perguntou
  // nada ao YouTube.
  const skipped: { cycleId: string; testId: string; siteId: string; channelAccountId: string | null; reason: string }[] = []

  for (const cycle of cycles) {
    try {
      // Get the parent test and video info
      const { data: test } = await supabase
        .from('ab_tests')
        .select('id, site_id, youtube_video_id')
        .eq('id', cycle.test_id)
        .single()

      if (!test) continue

      const { data: video } = await supabase
        .from('youtube_videos')
        .select('youtube_video_id')
        .eq('id', test.youtube_video_id)
        .single()

      if (!video?.youtube_video_id) continue

      // O token é o do canal DONO do vídeo: a consulta à Analytics API é
      // `channel==MINE`, e com o token de outro canal ela volta zero linhas —
      // o ciclo acabava `no_data` para sempre sem nunca ter sido lido.
      let accessToken: string | null = null
      let skipReason: string | null = null
      const channelAccountId = await channelAccountIdForVideo(supabase, test.site_id, test.youtube_video_id)
      if (!channelAccountId) {
        skipReason = 'video_without_channel'
      } else {
        try {
          accessToken = (await ensureFreshToken(test.site_id, 'youtube', channelAccountId)).accessToken
        } catch (tokenErr) {
          if (!(tokenErr instanceof NoActiveConnectionError)) {
            // Falha de verdade ao obter o token (leitura do banco, refresh, rede): conta como
            // erro da execução, mas NÃO condena o ciclo — o YouTube nem foi consultado, e
            // `error` é terminal (a consulta só lê pending/partial). Fica para a próxima rodada.
            errors++
            Sentry.captureException(tokenErr, {
              tags: { cron: 'ab-backfill' },
              extra: { stage: 'token', cycleId: cycle.id, testId: cycle.test_id },
            })
            continue
          }
          skipReason = 'no_active_connection'
        }
      }

      if (accessToken === null) {
        // O ciclo NÃO é tocado: o YouTube nem foi consultado, então não há tentativa a
        // gastar (3 rodadas sem OAuth esgotariam o contador e a primeira leitura vazia
        // depois de reconectar viraria `no_data` definitivo). Volta na próxima rodada.
        skipped.push({
          cycleId: cycle.id,
          testId: cycle.test_id,
          siteId: test.site_id,
          channelAccountId: channelAccountId ?? null,
          reason: skipReason ?? 'unknown',
        })
        continue
      }

      const startDate = (cycle.started_at as string).substring(0, 10)
      const endDate = (cycle.ended_at as string).substring(0, 10)

      const rows = await fetchAnalyticsForDateRange(
        video.youtube_video_id,
        startDate,
        endDate,
        accessToken
      )

      if (rows.length === 0) {
        const attempts = (cycle.backfill_attempts ?? 0) + 1
        await supabase
          .from('ab_test_cycles')
          .update({
            backfill_status: attempts >= 3 ? 'no_data' : 'partial',
            backfill_attempts: attempts,
          })
          .eq('id', cycle.id)
        continue
      }

      const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0)
      const weightedCtr = totalImpressions > 0
        ? rows.reduce((s, r) => s + r.impressions * r.ctr, 0) / totalImpressions
        : 0
      const totalClicks = Math.round(totalImpressions * weightedCtr)

      await supabase
        .from('ab_test_cycles')
        .update({
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr: weightedCtr,
          backfill_status: 'confirmed',
        })
        .eq('id', cycle.id)

      backfilled++
    } catch (err) {
      errors++
      Sentry.captureException(err, {
        tags: { cron: 'ab-backfill' },
        extra: { cycleId: cycle.id, testId: cycle.test_id },
      })
      await supabase
        .from('ab_test_cycles')
        .update({ backfill_status: 'error' })
        .eq('id', cycle.id)
    }
  }

  if (skipped.length > 0) {
    // UM aviso agregado por execução (contagem e canais), nunca um por ciclo.
    const skippedChannels = [...new Set(skipped.map((k) => k.channelAccountId ?? 'unknown'))]
    Sentry.captureMessage(
      `ab-backfill: ${skipped.length} cycle(s) skipped — no OAuth token for the channel that owns the video`,
      {
        level: 'warning',
        tags: { cron: 'ab-backfill' },
        extra: { count: skipped.length, channels: skippedChannels, skipped },
      },
    )
    // O dono precisa VER o pulo, sem alarme de cron (canal recém-cadastrado sem OAuth é
    // estado legítimo): uma notificação por site e por dia (dedup).
    const bySite = new Map<string, typeof skipped>()
    for (const k of skipped) bySite.set(k.siteId, [...(bySite.get(k.siteId) ?? []), k])
    for (const [siteId, items] of bySite) {
      const channels = [...new Set(items.map((i) => i.channelAccountId ?? 'canal desconhecido'))]
      try {
        await fanOutToSiteAdmins({
          siteId,
          domain: 'youtube',
          type: 'youtube.backfill_skipped_no_connection',
          priority: 2,
          title: 'Resultados de testes A/B aguardando acesso ao YouTube',
          message: `${items.length} ciclo(s) de teste A/B não puderam ser lidos no YouTube porque o canal não tem conexão ativa: ${channels.join(', ')}. Reconecte o acesso do canal em /cms/youtube; a leitura recomeça sozinha.`,
          dedupKey: `backfill-skipped-no-connection-${siteId}-${new Date().toISOString().slice(0, 10)}`,
          actionHref: '/cms/youtube',
        })
      } catch (e) {
        Sentry.captureException(e, { tags: { cron: 'ab-backfill' }, extra: { stage: 'notify-skipped' } })
      }
    }
  }

  if (errors === 0) {
    await recordCronSuccess('ab-backfill', 'critical')
  } else {
    await recordCronFailure('ab-backfill', `${errors} cycle(s) failed`, 'critical')
  }

  return Response.json({ status: 'ok', backfilled, errors, skipped: skipped.length })
}

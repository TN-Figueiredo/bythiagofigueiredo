import { NextRequest } from 'next/server'
import { getCronHealth, recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import { createNotification } from '@/lib/notifications/create'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteOwners, logSemDestinatario, SEM_DESTINATARIO } from '@/lib/notifications/get-site-owners'
import { faseDriftEInterrompidos } from '@/lib/youtube/ab-watchdog-drift'
import type { ResultadoDrift } from '@/lib/youtube/ab-watchdog-drift'
import { podarRetratosDeCanal } from '@/lib/youtube/competitor-snapshot-prune'
import * as Sentry from '@sentry/nextjs'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const inicio = Date.now()
  try {
    let semDestinatario = 0
    let avisosEnviados = 0
    const today = new Date().toISOString().slice(0, 10)
    const rotateHealth = await getCronHealth('ab-rotate')

    const rotateRanToday =
      rotateHealth?.last_success_at &&
      rotateHealth.last_success_at.slice(0, 10) === today

    if (!rotateRanToday) {
      const supabase = getSupabaseServiceClient()
      const { data: activeTests } = await supabase
        .from('ab_tests')
        .select('id, site_id, test_type, youtube_video_id')
        .eq('status', 'active')

      if (activeTests && activeTests.length > 0) {
        // Get unique site_ids
        const siteIds = [...new Set(activeTests.map(t => t.site_id))]

        for (const siteId of siteIds) {
          const owners = await getSiteOwners(supabase, siteId)
          if (owners.length === 0) {
            semDestinatario++
            logSemDestinatario('ab-watchdog:rotation-missed', siteId)
          }
          for (const owner of owners) {
            avisosEnviados++
            await createNotification({
              site_id: siteId,
              user_id: owner.userId,
              type: 'youtube.rotation_missed',
              domain: 'youtube',
              priority: 1,
              title: 'Rotação A/B não executou hoje',
              message: `O cron ab-rotate não rodou hoje (${today}). Último sucesso: ${rotateHealth?.last_success_at ?? 'nunca'}.`,
              action_href: '/cms/youtube/ab-lab',
              dedup_key: `rotation-missed-${siteId}-${today}`,
            })
          }
        }

        // Trigger catch-up rotation — ab-rotate has built-in idempotency
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        try {
          await fetch(`${baseUrl}/api/cron/ab-rotate`, {
            headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
            signal: AbortSignal.timeout(10_000),
          })
        } catch {
          // Non-fatal: catch-up fetch timed out or failed — watchdog still succeeds
        }
      }
    }

    // Prune old polls (7-day retention)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const pruneClient = getSupabaseServiceClient()
    const { error: pruneError } = await pruneClient
      .from('ab_test_polls')
      .delete()
      .lt('polled_at', sevenDaysAgo)
    if (pruneError) console.error('[ab-watchdog] poll prune failed:', pruneError.message)

    // competitor_changes is the observatory's history (Histórico por vídeo depends on it):
    // never pruned. Only granular channel snapshots below have a retention window.

    // Prune old channel snapshots (365-day retention), except those of channels that left YouTube (A5 E9 T11a)
    const podaRetratos = await podarRetratosDeCanal(pruneClient, Date.now())
    if (!podaRetratos.ok) console.error('[ab-watchdog] snapshot prune skipped:', podaRetratos.motivo)

    // Drift pela imagem e conversão do `em_andamento` interrompido (P4a T11). Depois das podas (custo zero, não
    // dependem desta fase). Acumulada, não lançada: a morte por tempo não passa pelo catch, então a fase se limita sozinha.
    const drift: ResultadoDrift = await faseDriftEInterrompidos(getSupabaseServiceClient(), { agora: Date.now, inicio })
      .catch((e: unknown): ResultadoDrift => {
        Sentry.captureException(e, { extra: { context: 'ab-watchdog-drift' } })
        return { verificados: 0, pausados: 0, falhas: 1, adiados: 0, interrompidos: 0, semDestinatario: false }
      })
    if (drift.semDestinatario) semDestinatario++
    const atencao = drift.falhas > 0 || drift.adiados > 0 || drift.semDestinatario
    if (atencao) {
      await recordCronFailure('ab-watchdog', `drift: falhas ${drift.falhas}, adiados ${drift.adiados}${drift.semDestinatario ? ', sem destinatário' : ''}`)
    } else {
      await recordCronSuccess('ab-watchdog', 'info')
    }

    return Response.json({
      status: atencao ? 'atencao' : 'ok',
      rotate_healthy: !!rotateRanToday,
      poda_retratos: podaRetratos,
      last_rotate: rotateHealth?.last_success_at ?? null,
      drift: { verificados: drift.verificados, pausados: drift.pausados, falhas: drift.falhas },
      ...(drift.adiados > 0 ? { adiados: drift.adiados } : {}),
      ...(drift.interrompidos > 0 ? { interrompidos: drift.interrompidos } : {}),
      avisos: {
        enviados: avisosEnviados,
        // Havia aviso a dar e ninguém a quem dar: não é "ok" mudo.
        ...(semDestinatario > 0 ? { [SEM_DESTINATARIO]: semDestinatario } : {}),
      },
    })
  } catch (err) {
    Sentry.captureException(err, { extra: { context: 'ab-watchdog' } })
    await recordCronFailure('ab-watchdog', (err as Error).message)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

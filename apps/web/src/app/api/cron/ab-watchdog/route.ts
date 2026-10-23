import { NextRequest } from 'next/server'
import { getCronHealth, recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import { createNotification } from '@/lib/notifications/create'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteOwners, logSemDestinatario, SEM_DESTINATARIO } from '@/lib/notifications/get-site-owners'
import { converterInterrompidosDoVigia, faseDriftEInterrompidos } from '@/lib/youtube/ab-watchdog-drift'
import type { ResultadoDrift } from '@/lib/youtube/ab-watchdog-drift'
import { faseNovaTentativa, zeroNovaTentativa } from '@/lib/youtube/ab-watchdog-nova-tentativa'
import type { ResultadoNovaTentativa } from '@/lib/youtube/ab-watchdog-nova-tentativa'
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

    // Conversão do `em_andamento` interrompido (só banco): fora e antes das duas fases, a nova tentativa lê o resultado dela (Y-6).
    const drift: ResultadoDrift = { verificados: 0, pausados: 0, pausadosPorTesteYoutube: 0, falhas: 0, adiados: 0, interrompidos: 0, semDestinatario: false }
    await converterInterrompidosDoVigia(getSupabaseServiceClient(), { agora: Date.now, inicio }, drift)

    // Drift (só testes `active`) e nova tentativa (só `status <> 'active'`) têm conjuntos disjuntos: rodam em paralelo,
    // cada uma com o próprio catch (emenda 37). Acumuladas, não lançadas: a morte por tempo não passa pelo catch.
    const [driftFase, nt] = await Promise.all([
      faseDriftEInterrompidos(getSupabaseServiceClient(), { agora: Date.now, inicio }, undefined, undefined, { semInterrompidos: true })
        .catch((e: unknown): ResultadoDrift => {
          Sentry.captureException(e, { extra: { context: 'ab-watchdog-drift' } })
          return { verificados: 0, pausados: 0, pausadosPorTesteYoutube: 0, falhas: 1, adiados: 0, interrompidos: 0, semDestinatario: false }
        }),
      faseNovaTentativa(getSupabaseServiceClient(), { agora: Date.now, inicio })
        .catch((e: unknown): ResultadoNovaTentativa => {
          Sentry.captureException(e, { extra: { context: 'ab-watchdog-nova-tentativa' } })
          return { ...zeroNovaTentativa(), falhas: 1 }
        }),
    ])
    drift.verificados += driftFase.verificados
    drift.pausados += driftFase.pausados
    drift.pausadosPorTesteYoutube += driftFase.pausadosPorTesteYoutube
    drift.falhas += driftFase.falhas
    drift.adiados += driftFase.adiados
    drift.interrompidos += driftFase.interrompidos
    drift.semDestinatario = drift.semDestinatario || driftFase.semDestinatario
    if (drift.semDestinatario) semDestinatario++
    semDestinatario += nt.semDestinatario
    const duracaoMs = Date.now() - inicio
    const atencao = drift.falhas > 0 || drift.adiados > 0 || drift.semDestinatario || nt.falhas > 0 || nt.adiados > 0 || nt.semDestinatario > 0
    if (atencao) {
      await recordCronFailure('ab-watchdog', `drift: falhas ${drift.falhas}, adiados ${drift.adiados}${drift.semDestinatario ? ', sem destinatário' : ''}; nova tentativa: falhas ${nt.falhas}, adiados ${nt.adiados}, sem destinatário ${nt.semDestinatario}, cota ${nt.cota}; duracao_ms ${duracaoMs}`)
    } else {
      await recordCronSuccess('ab-watchdog', 'info')
    }

    const driftResposta = { verificados: drift.verificados, pausados: drift.pausados, falhas: drift.falhas, ...(drift.pausadosPorTesteYoutube > 0 ? { pausados_teste_youtube: drift.pausadosPorTesteYoutube } : {}) }
    // Sempre presente, inclusive com zeros (P4b-I9): a ausência não pode ser lida como "nada a fazer".
    const novaTentativaResposta = {
      tentadas: nt.tentadas, ok: nt.ok, falharam: nt.falharam, desistiram: nt.desistiram, pulados: nt.pulados, cota: nt.cota,
      ignorados: nt.ignorados, adiados: nt.adiados, [SEM_DESTINATARIO]: nt.semDestinatario,
    }
    const avisos = {
      enviados: avisosEnviados,
      // Havia aviso a dar e ninguém a quem dar: não é "ok" mudo.
      ...(semDestinatario > 0 ? { [SEM_DESTINATARIO]: semDestinatario } : {}),
    }
    // A coluna cron_health.duration_ms não existe (F3): a conferência de produção lê esta linha.
    console.log('[ab-watchdog] resumo', JSON.stringify({ duracao_ms: duracaoMs, drift: driftResposta, nova_tentativa: novaTentativaResposta, avisos }))

    return Response.json({
      status: atencao ? 'atencao' : 'ok',
      rotate_healthy: !!rotateRanToday,
      poda_retratos: podaRetratos,
      last_rotate: rotateHealth?.last_success_at ?? null,
      drift: driftResposta,
      nova_tentativa: novaTentativaResposta,
      duracao_ms: duracaoMs,
      ...(drift.adiados > 0 ? { adiados: drift.adiados } : {}),
      ...(drift.interrompidos > 0 ? { interrompidos: drift.interrompidos } : {}),
      avisos,
    })
  } catch (err) {
    Sentry.captureException(err, { extra: { context: 'ab-watchdog' } })
    await recordCronFailure('ab-watchdog', (err as Error).message)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { preflightTokenCheck } from '@/lib/youtube/ab-preflight'
import { getNextVariantIndex } from '@/lib/youtube/ab-rotation'
import { reivindicarRotacao, aplicarRotacao, marcadorEhVelho, motivoVarianteSemConteudo, avisarRotacaoSemConteudo } from '@/lib/youtube/ab-rotate-claim'
import { createNotification } from '@/lib/notifications/create'
import { getSiteOwners, logSemDestinatario } from '@/lib/notifications/get-site-owners'
import { CHANNEL_NOT_IDENTIFIED_MESSAGE, channelAccountIdForVideo } from '@/lib/youtube/channel-account'
import { startAbTestInternal } from '@/lib/youtube/ab-start'
import { TestTypeSchema } from '@/lib/youtube/ab-schemas'
import type { AbTestVariantRow, TestType } from '@/lib/youtube/ab-types'

type SupabaseClient = ReturnType<typeof getSupabaseServiceClient>

export interface RotateResult {
  processed: number
  errors: number
}

// ─── Phase 1: Process queued tests whose start time has arrived ──────────────

export async function phaseProcessQueue(supabase: SupabaseClient): Promise<number> {
  const { data: queuedTests } = await supabase
    .from('ab_tests')
    .select('id, site_id, youtube_video_id, name')
    .eq('status', 'queued')
    .not('queue_start_after', 'is', null)
    .lte('queue_start_after', new Date().toISOString())

  if (!queuedTests?.length) return 0

  let started = 0
  for (const queued of queuedTests) {
    try {
      await supabase
        .from('ab_tests')
        .update({ status: 'draft', queue_start_after: null })
        .eq('id', queued.id)
        .eq('status', 'queued')

      await startAbTestInternal(queued.id, queued.site_id)
      started++
    } catch (err) {
      // Revert status on failure
      await supabase
        .from('ab_tests')
        .update({ status: 'queued' })
        .eq('id', queued.id)
      Sentry.captureException(err, { extra: { testId: queued.id, context: 'queue-start' } })
    }
  }

  return started
}

// ─── Phase 2: Rotate active tests ───────────────────────────────────────────

/**
 * Orçamento do laço (Phil M-1): o cron tem `maxDuration` 300 s e a fila (`phaseProcessQueue`) roda ANTES no mesmo
 * disparo. `inicioDaFuncao` é o instante em que a rota começou (a fila entra na conta). Teste novo só começa se
 * faltam pelo menos 50 s (45 s de uma rotação + folga) para o corte de 240 s; senão fica para amanhã, com Sentry.
 */
export const CORTE_DA_ROTACAO_MS = 240_000
export const ROTACAO_MAXIMA_MS = 50_000

export async function phaseRotateActiveTests(supabase: SupabaseClient, inicioDaFuncao: number = Date.now()): Promise<RotateResult> {
  // Query all active tests with their variants and video info
  const { data: tests } = await supabase
    .from('ab_tests')
    .select(`
      *,
      variants:ab_test_variants!test_id(*)
    `)
    .eq('status', 'active')

  if (!tests || tests.length === 0) {
    return { processed: 0, errors: 0 }
  }

  let processed = 0
  let errors = 0

  for (const test of tests) {
    const restante = inicioDaFuncao + CORTE_DA_ROTACAO_MS - Date.now()
    if (restante < ROTACAO_MAXIMA_MS) {
      Sentry.captureMessage('ab-rotate: rotação adiada por tempo', { extra: { testId: test.id, restanteMs: restante } })
      break
    }
    // Hoist video + channel so they're accessible in the catch block (auto-pause-revert)
    let video: { youtube_video_id: string; channel_id: string } | null = null
    let channel: { channel_id: string } | null = null

    try {
      const variants = (test.variants as AbTestVariantRow[]).sort(
        (a, b) => a.sort_order - b.sort_order
      )

      // Get youtube_video_id and channel info for correct token selection
      const { data: videoRow } = await supabase
        .from('youtube_videos')
        .select('youtube_video_id, channel_id')
        .eq('id', test.youtube_video_id)
        .single()

      video = videoRow
      if (!video) continue

      // Teste antigo de tipo fora dos três (descrição saiu do A/B): pausa uma vez, sem ciclo e sem YouTube
      if (!TestTypeSchema.safeParse(test.test_type ?? 'thumbnail').success) {
        await supabase
          .from('ab_tests')
          .update({
            status: 'paused',
            status_note: 'Tipo de teste fora de uso: a descrição saiu do A/B Lab',
            paused_at: new Date().toISOString(),
          })
          .eq('id', test.id)
        continue
      }

      // Idempotency: skip if we already rotated today
      const today = new Date().toISOString().slice(0, 10)
      const { data: todayCycle } = await supabase
        .from('ab_test_cycles')
        .select('id')
        .eq('test_id', test.id)
        .gte('started_at', `${today}T00:00:00Z`)
        .limit(1)
        .maybeSingle()

      if (todayCycle) continue

      // Marcador com idade: só é "velho" (queda anterior) depois de MARCADOR_VELHO_MS (Yannis DEVE-1). Mais novo que isso
      // é uma rotação em voo (cron duplicado, forçar): calado, sem tocar. Velho: registra e segue; a reivindicação por
      // restore_seq (com o mesmo corte de idade) aceita esse marcador exato (R2-7).
      const marcadorLido = (test.last_applied_variant_id as string | null) ?? null
      if (marcadorLido) {
        if (!marcadorEhVelho(test.updated_at as string | null)) continue
        Sentry.captureMessage(
          `ab-rotate: write-ahead marker found for test ${test.id} (variant ${marcadorLido}). Previous run likely crashed after claiming. Continuing by restore_seq claim.`,
          'warning'
        )
      }

      // Resolve the YouTube channel_id to use the correct OAuth token
      // O canal dono do vídeo (filtro de site; erro de banco lança, não vira "canal não identificado").
      const channelAccountId = await channelAccountIdForVideo(supabase, test.site_id, test.youtube_video_id)
      channel = channelAccountId ? { channel_id: channelAccountId } : null
      // Sem o canal não há token certo: erro deste teste (nunca "a conexão mais recente").
      if (!channel?.channel_id) throw new Error(CHANNEL_NOT_IDENTIFIED_MESSAGE)

      const preflight = await preflightTokenCheck(test.site_id, 'youtube', channel?.channel_id)
      if (!preflight.ok) {
        const owners = await getSiteOwners(supabase, test.site_id)
        if (owners.length === 0) logSemDestinatario('ab-rotate:token-invalid', test.site_id)
        for (const owner of owners) {
          await createNotification({
            site_id: test.site_id,
            user_id: owner.userId,
            type: 'youtube.token_invalid',
            domain: 'youtube',
            priority: 1,
            title: 'Token YouTube inválido',
            message: `Não foi possível acessar a API do YouTube: ${preflight.reason}`,
            action_href: '/cms/youtube',
            dedup_key: `token-invalid-${test.site_id}-${new Date().toISOString().slice(0, 10)}`,
          })
        }
        continue
      }
      const accessToken = preflight.accessToken

      // Count only completed (closed) cycles for correct ABBA position
      const { count } = await supabase
        .from('ab_test_cycles')
        .select('*', { count: 'exact', head: true })
        .eq('test_id', test.id)
        .not('ended_at', 'is', null)

      const nextCycle = (count ?? 0) + 1
      const pattern = test.config?.rotation_pattern ?? 'abba'
      const nextVariantIndex = getNextVariantIndex(pattern, variants.length, nextCycle)
      const nextVariant = variants[nextVariantIndex]

      if (!nextVariant) continue

      // Phil I-1: variante da vez sem arquivo no Blob (ou sem título) não vai ao ar: não reivindica, não abre ciclo.
      const semConteudo = motivoVarianteSemConteudo((test.test_type ?? 'thumbnail') as TestType, nextVariant, test.original_title as string | null)
      if (semConteudo) {
        errors++
        await avisarRotacaoSemConteudo({
          testId: test.id, siteId: test.site_id, testName: (test.name as string | null) ?? '', motivo: semConteudo, variantId: nextVariant.id,
        })
        continue
      }

      // Reivindica a vez ANTES de escrever (restore_seq + 1 e marcador); zero linhas = outro escritor ganhou.
      const seq = await reivindicarRotacao(supabase, test.id, test.restore_seq as number, nextVariant.id, marcadorLido)
      if (seq === null) continue

      const resultado = await aplicarRotacao(supabase, {
        testId: test.id,
        siteId: test.site_id,
        testName: (test.name as string | null) ?? '',
        seq,
        youtubeVideoId: video.youtube_video_id,
        accessToken,
        testType: (test.test_type ?? 'thumbnail') as TestType,
        variante: nextVariant,
        originalTitle: test.original_title,
        cycleNumber: nextCycle,
      })

      if (!resultado.ok) {
        if (resultado.motivo !== 'youtube') continue // perdeu a vez / cruzou com pausa: já registrado, sem falha de rotação
        // Y-D9: sem escrita, limpa o marcador (senão o dia seguinte entra em "marcador velho" e o Sentry dispara em toda
        // falha comum); com escrita parcial o marcador fica: é o sinal para o settleOnAir.
        if (!resultado.appliedThumbnail && !resultado.appliedMetadata) {
          await supabase
            .from('ab_tests')
            .update({ last_applied_variant_id: null })
            .eq('id', test.id)
            .eq('restore_seq', seq)
        }
        throw resultado.erro
      }

      processed++
    } catch (err) {
      errors++
      Sentry.captureException(err, {
        tags: { cron: 'ab-rotate' },
        extra: { testId: test.id },
      })

      // Track consecutive failures for auth/quota errors — only pause after 3
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('401') || msg.includes('403') || msg.includes('429')) {
        const reason = msg.includes('401') ? 'token expired'
          : msg.includes('403') ? 'insufficient permissions'
          : 'API quota exceeded'

        const prevFailures = (test.config?.consecutive_failures as number) ?? 0
        const failures = prevFailures + 1
        const MAX_FAILURES = 3

        if (failures >= MAX_FAILURES) {
          try {
            const { data: testFull } = await supabase
              .from('ab_tests')
              .select('original_thumbnail_url, site_id')
              .eq('id', test.id)
              .single()
            if (testFull?.original_thumbnail_url?.includes('blob.vercel-storage.com') && video) {
              const { ensureFreshToken } = await import('@/lib/social/token-refresh')
              const { fetchVariantImageBuffer, setThumbnail } = await import('@/lib/youtube/ab-youtube')
              if (!channel?.channel_id) throw new Error(CHANNEL_NOT_IDENTIFIED_MESSAGE)
              const { accessToken } = await ensureFreshToken(testFull.site_id, 'youtube', channel.channel_id)
              const { buffer, contentType } = await fetchVariantImageBuffer(testFull.original_thumbnail_url)
              await setThumbnail(video.youtube_video_id, buffer, contentType, accessToken)
            }
          } catch (revertErr) {
            Sentry.captureException(revertErr, {
              tags: { cron: 'ab-rotate', action: 'auto-pause-revert' },
              extra: { testId: test.id },
            })
          }

          await supabase
            .from('ab_tests')
            .update({
              status: 'paused',
              status_note: `auto-paused after ${failures} consecutive failures: ${reason}`,
              paused_at: new Date().toISOString(),
              config: { ...test.config, consecutive_failures: failures },
            })
            .eq('id', test.id)
        } else {
          // Keep active but track the failure
          await supabase
            .from('ab_tests')
            .update({
              config: { ...test.config, consecutive_failures: failures },
              status_note: `retry ${failures}/${MAX_FAILURES}: ${reason}`,
            })
            .eq('id', test.id)
        }
      }
    }
  }

  return { processed, errors }
}

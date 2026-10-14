import * as Sentry from '@sentry/nextjs'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { CHANNEL_NOT_IDENTIFIED_MESSAGE, channelAccountIdForVideo } from '@/lib/youtube/channel-account'
import { startAbTestInternal } from '@/lib/youtube/ab-start'
import type { AbTestConfig } from '@/lib/youtube/ab-types'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

type SupabaseClient = ReturnType<typeof getSupabaseServiceClient>

export interface PhaseResult {
  processed: number
  errors: number
}

export interface EvaluateResult {
  evaluated: number
  resolved: number
  errors: number
}

// ─── Phase 1: Auto-start Round 2 drafts past cooldown ────────────────────────

export async function phaseAutoStartPlayoffs(supabase: SupabaseClient): Promise<PhaseResult> {
  let processed = 0
  let errors = 0

  const { data: pendingPlayoffs } = await supabase
    .from('ab_tests')
    .select('id, site_id, round_number, parent_test_id, playoff_start_after')
    .eq('status', 'draft')
    .eq('round_number', 2)
    .not('parent_test_id', 'is', null)
    .not('playoff_start_after', 'is', null)
    .lte('playoff_start_after', new Date().toISOString())

  for (const playoff of pendingPlayoffs ?? []) {
    try {
      const result = await startAbTestInternal(playoff.id as string, playoff.site_id as string)
      if (result.ok) processed++
    } catch (err) {
      errors++
      Sentry.captureException(err, {
        tags: { cron: 'ab-evaluate', phase: 'playoff-start' },
        extra: { testId: playoff.id },
      })
    }
  }

  return { processed, errors }
}

// ─── Fase 2: duração máxima ──────────────────────────────────────────────────
// Enquanto não houver métrica de entrega real, o cron não declara vencedor, não abre
// carência, não cria playoff e não aplica nada: `ab_test_cycles.impressions` são views e
// os cliques são sempre zero. Só sobra o ramo da duração máxima. Escolher o que fica no
// ar é decisão humana (spec 2026-10-07-ab-lab-honesto, 4.1).

type Restauracao = 'nao_aplicavel' | 'feita' | 'sem_original_no_blob' | 'falhou'

export async function phaseEvaluateActiveTests(supabase: SupabaseClient): Promise<EvaluateResult> {
  let evaluated = 0
  let resolved = 0
  let errors = 0

  const { data: tests, error: erroLeitura } = await supabase
    .from('ab_tests')
    .select('id, site_id, youtube_video_id, test_type, config, started_at, created_at, original_thumbnail_url')
    .eq('status', 'active')

  if (erroLeitura) {
    Sentry.captureException(new Error(`ler testes ativos: ${erroLeitura.message}`, { cause: erroLeitura }), {
      tags: { cron: 'ab-evaluate' },
      extra: { context: 'ler testes ativos' },
    })
    return { evaluated: 0, resolved: 0, errors: 1 }
  }
  if (!tests || tests.length === 0) {
    return { evaluated: 0, resolved: 0, errors: 0 }
  }

  for (const test of tests) {
    try {
      const config = test.config as AbTestConfig
      const startedAt = new Date(test.started_at ?? test.created_at)
      const daysSinceStart = Math.floor((Date.now() - startedAt.getTime()) / 86400000)
      const maxDurationDays = config.max_duration_days ?? 14

      if (daysSinceStart < maxDurationDays) {
        evaluated++
        continue
      }

      // Decisão humana no meio: relê o estado antes de mexer no YouTube (D-P2-1).
      const aindaAtivo = await supabase.from('ab_tests').select('status').eq('id', test.id).maybeSingle()
      if (aindaAtivo.error) throw new Error(`reler estado: ${aindaAtivo.error.message}`, { cause: aindaAtivo.error })
      if (aindaAtivo.data?.status !== 'active') {
        evaluated++
        continue
      }

      // Volta ao original, melhor esforço (P4 troca por settleOnAir(original, 'duracao_maxima')).
      // Só tenta se o teste é de thumbnail ou combo E alguma variante chegou a ir ao ar (G-P2-C2).
      let restauracao: Restauracao = 'nao_aplicavel'
      if (test.test_type === 'thumbnail' || test.test_type === 'combo') {
        const foiAoAr = await supabase
          .from('ab_test_cycles')
          .select('id', { count: 'exact', head: true })
          .eq('test_id', test.id)
        if (foiAoAr.error) throw new Error(`ler ciclos: ${foiAoAr.error.message}`, { cause: foiAoAr.error })
        if ((foiAoAr.count ?? 0) > 0) {
          const originalNoBlob = !!test.original_thumbnail_url?.includes('blob.vercel-storage.com')
          restauracao = originalNoBlob ? 'falhou' : 'sem_original_no_blob'
          try {
            if (originalNoBlob) {
              const { data: revertVideo } = await supabase
                .from('youtube_videos')
                .select('youtube_video_id')
                .eq('id', test.youtube_video_id)
                .single()

              if (revertVideo) {
                const { fetchVariantImageBuffer, setThumbnail } = await import('@/lib/youtube/ab-youtube')
                const revertChannelId = await channelAccountIdForVideo(supabase, test.site_id, test.youtube_video_id)
                if (!revertChannelId) throw new Error(CHANNEL_NOT_IDENTIFIED_MESSAGE)
                const { accessToken } = await ensureFreshToken(test.site_id, 'youtube', revertChannelId)
                const { buffer, contentType } = await fetchVariantImageBuffer(test.original_thumbnail_url)
                await setThumbnail(revertVideo.youtube_video_id, buffer, contentType, accessToken)
                restauracao = 'feita'
              }
            }
          } catch (e) {
            Sentry.captureException(e, { extra: { context: 'max-duration-revert', testId: test.id } })
          }
        }
      }

      const agora = new Date().toISOString()
      const fechouCiclos = await supabase
        .from('ab_test_cycles')
        .update({ ended_at: agora })
        .eq('test_id', test.id)
        .is('ended_at', null)
      if (fechouCiclos.error) throw new Error(`fechar ciclos: ${fechouCiclos.error.message}`, { cause: fechouCiclos.error })

      // Encerra SÓ se ainda for 'active' e devolve a linha: zero linha não é "resolvido" (D-P2-1).
      // Limpa vencedor e carência: teste encerrado como inconclusive não fica com vencedor sugerido (S-C8).
      const restauracaoFalhou = restauracao === 'falhou' || restauracao === 'sem_original_no_blob'
      const encerrou = await supabase
        .from('ab_tests')
        .update({
          status: 'completed',
          completed_at: agora,
          completed_reason: 'inconclusive',
          confidence_at_completion: null,
          winner_variant_id: null,
          grace_expires_at: null,
          // só escreve status_note quando há o que dizer: não apaga nota do ab-rotate (S-C7)
          ...(restauracaoFalhou ? { status_note: `duração máxima: original não restaurado (${restauracao})` } : {}),
        })
        .eq('id', test.id)
        .eq('status', 'active')
        .select('id')
      if (encerrou.error) throw new Error(`encerrar teste: ${encerrou.error.message}`, { cause: encerrou.error })

      if ((encerrou.data ?? []).length === 1) {
        resolved++
        // restauração que falhou deixa a variante no ar: o cron fica vermelho nesse dia (S-C7)
        if (restauracaoFalhou) errors++
      }
      evaluated++
    } catch (err) {
      errors++
      Sentry.captureException(err, { tags: { cron: 'ab-evaluate' }, extra: { testId: test.id } })
    }
  }

  return { evaluated, resolved, errors }
}

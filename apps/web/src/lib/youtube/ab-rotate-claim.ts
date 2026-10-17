import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { applyVariantToYouTube } from '@/lib/youtube/ab-apply'
import { fanOutToSiteAdminsDetailed } from '@/lib/notifications/fan-out-to-admins'
import type { YouTubeApiError } from '@/lib/youtube/youtube-api-error'
import type { AbTestVariantRow } from '@/lib/youtube/ab-types'

/**
 * Reivindica a vez de rotacionar (P4a, 3.2): `restore_seq + 1` e o marcador da próxima variante, só se o teste
 * ainda está `active` no `restore_seq` que o chamador leu. Zero linhas (outra rotação, pausa, encerramento) = `null`:
 * o chamador não escreve nada. `marcadorLido` é o marcador velho de uma queda anterior (R2-7): a reivindicação aceita
 * exatamente ele; com `null` só passa quem tem o marcador limpo.
 */
export async function reivindicarRotacao(
  supabase: SupabaseClient,
  testId: string,
  seqLido: number,
  proxima: string,
  marcadorLido: string | null,
): Promise<number | null> {
  let q = supabase
    .from('ab_tests')
    .update({ restore_seq: seqLido + 1, last_applied_variant_id: proxima, updated_at: new Date().toISOString() })
    .eq('id', testId)
    .eq('status', 'active')
    .eq('restore_seq', seqLido)
  q = marcadorLido === null ? q.is('last_applied_variant_id', null) : q.eq('last_applied_variant_id', marcadorLido)
  const { data, error } = await q.select('restore_seq')
  if (error) throw new Error(`ab-rotate: reivindicação do teste ${testId}: ${error.message}`)
  const linha = (data as Array<{ restore_seq: number }> | null)?.[0]
  return linha ? linha.restore_seq : null
}

export interface ArgsAplicarRotacao {
  testId: string
  siteId: string
  testName: string
  seq: number
  youtubeVideoId: string
  accessToken: string
  testType: 'thumbnail' | 'title' | 'combo'
  variante: AbTestVariantRow
  originalTitle: string | null
  /** Só a escolha ABBA; o número gravado é max+1 calculado dentro de `ab_rotate_commit` (F-D7). */
  cycleNumber: number
  /** Acrescentado ao `applied_metadata` do ciclo aberto (forçar rotação grava `{ trigger: 'manual' }`). */
  metaExtra?: Record<string, unknown>
}

export type ResultadoAplicarRotacao =
  | { ok: true; cicloId: string }
  | { ok: false; motivo: 'perdeu_a_vez' | 'cruzou_com_pausa'; erro?: never }
  | { ok: false; motivo: 'youtube'; erro: YouTubeApiError | Error; appliedThumbnail: boolean; appliedMetadata: boolean }

/** Aviso do cruzamento rotação x pausa: o YouTube pode estar numa mistura que nenhum registro descreve. */
export async function avisarRotacaoCruzada(args: Pick<ArgsAplicarRotacao, 'testId' | 'siteId' | 'testName' | 'seq' | 'youtubeVideoId'>): Promise<void> {
  await fanOutToSiteAdminsDetailed({
    siteId: args.siteId,
    domain: 'youtube',
    type: 'youtube.ab_restore_failed',
    priority: 1,
    title: 'A/B: confira o vídeo',
    message: `Confira a thumbnail e o título do vídeo ${args.youtubeVideoId} (teste "${args.testName}"): a rotação e uma pausa se cruzaram.`,
    dedupKey: `ab-rotate-cruzada:${args.testId}:${args.seq}`,
    actionHref: `/cms/youtube/ab-lab/${args.testId}`,
    payload: { testId: args.testId, restoreSeq: args.seq },
  })
}

/**
 * Escreve a variante no YouTube e fecha a rotação em `ab_rotate_commit` (uma transação no banco).
 * Relê `restore_seq` antes de CADA escrita (thumbnail e título; Y-D8). `perdeu_a_vez` = alguém reivindicou antes da
 * escrita que faltava; `cruzou_com_pausa` = reivindicaram depois da última escrita (o fecho devolveu nulo).
 */
export async function aplicarRotacao(supabase: SupabaseClient, args: ArgsAplicarRotacao): Promise<ResultadoAplicarRotacao> {
  const antesDeEscrever = async (): Promise<boolean> => {
    const { data, error } = await supabase.from('ab_tests').select('restore_seq').eq('id', args.testId).single()
    if (error || !data) throw new Error(`ab-rotate: releitura de restore_seq do teste ${args.testId}: ${error?.message ?? 'sem linha'}`)
    return (data as { restore_seq: number }).restore_seq === args.seq
  }

  const aplicado = await applyVariantToYouTube(
    {
      youtubeVideoId: args.youtubeVideoId,
      accessToken: args.accessToken,
      testType: args.testType,
      variant: { id: args.variante.id, blob_url: args.variante.blob_url, title_text: args.variante.title_text },
      originalTitle: args.originalTitle,
    },
    { antesDeEscrever },
  )

  if (aplicado.perdeuAVez) {
    if (aplicado.appliedThumbnail || aplicado.appliedMetadata) {
      Sentry.captureMessage('ab-rotate: perdeu a vez no meio da escrita', { extra: { testId: args.testId, seq: args.seq } })
    }
    return { ok: false, motivo: 'perdeu_a_vez' }
  }
  if (!aplicado.ok) {
    return {
      ok: false,
      motivo: 'youtube',
      erro: aplicado.erroApi ?? new Error(aplicado.error ?? 'apply failed'),
      appliedThumbnail: aplicado.appliedThumbnail,
      appliedMetadata: aplicado.appliedMetadata,
    }
  }

  const { data: poll } = await supabase
    .from('ab_test_polls')
    .select('views, likes')
    .eq('test_id', args.testId)
    .order('polled_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const p = poll as { views: number | null; likes: number | null } | null

  const { data: cicloId, error } = await supabase.rpc('ab_rotate_commit', {
    p_test_id: args.testId,
    p_seq: args.seq,
    p_variant_id: args.variante.id,
    p_cycle_number: args.cycleNumber,
    p_applied_metadata: { ...(args.metaExtra ?? {}), ...aplicado.meta },
    p_views: p?.views ?? undefined,
    p_likes: p?.likes ?? undefined,
  })
  if (error) throw new Error(`ab-rotate: fecho da rotação do teste ${args.testId}: ${error.message}`)

  if (!cicloId) {
    Sentry.captureMessage('ab-rotate: reivindicação perdida depois da escrita', { extra: { testId: args.testId } })
    try {
      await avisarRotacaoCruzada(args)
    } catch (e) {
      // O aviso é best-effort: o Sentry acima já registrou o cruzamento e o resultado não pode virar erro de rotação.
      Sentry.captureException(e, { extra: { testId: args.testId, context: 'aviso-rotacao-cruzada' } })
    }
    return { ok: false, motivo: 'cruzou_com_pausa' }
  }
  return { ok: true, cicloId: cicloId as string }
}

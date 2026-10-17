import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { applyVariantToYouTube } from '@/lib/youtube/ab-apply'
import { fanOutToSiteAdminsDetailed } from '@/lib/notifications/fan-out-to-admins'
import type { YouTubeApiError } from '@/lib/youtube/youtube-api-error'
import { ehCopiaNoBlob } from '@/lib/youtube/ab-settle'
import type { AbTestVariantRow } from '@/lib/youtube/ab-types'

/**
 * Idade a partir da qual o marcador de uma rotação é "velho" (queda anterior) e pode ser aceito por outra
 * reivindicação. 300 s é o `maxDuration` do cron (`app/api/cron/ab-rotate/route.ts`) + 60 s de folga: uma rotação
 * viva nunca passa disso, então um marcador mais novo é de alguém em voo e não se toma (P4a T9, Yannis DEVE-1).
 * O cron e o `forceRotate` usam esta constante; mexer no `maxDuration` exige refazer a conta.
 */
export const MARCADOR_VELHO_MS = 360_000

/** O marcador de `atualizadoEm` já passou da idade de uma rotação viva? (`updated_at` ausente = velho.) */
export function marcadorEhVelho(atualizadoEm: string | null | undefined, agora: number = Date.now()): boolean {
  if (!atualizadoEm) return true
  const t = Date.parse(atualizadoEm)
  return Number.isNaN(t) || agora - t >= MARCADOR_VELHO_MS
}

/**
 * Antes de reivindicar: a variante da vez tem o que escrever? Thumbnail só com cópia no Blob (i.ytimg devolve a
 * thumbnail CORRENTE, isto é, a variante que já está no ar) e título só com texto (Phil I-1). Devolve o motivo ou null.
 */
export function motivoVarianteSemConteudo(
  testType: 'thumbnail' | 'title' | 'combo',
  variante: Pick<AbTestVariantRow, 'blob_url' | 'title_text' | 'is_original'>,
  originalTitle: string | null,
): string | null {
  if ((testType === 'thumbnail' || testType === 'combo') && !ehCopiaNoBlob(variante.blob_url)) return 'sem arquivo da thumbnail no Blob'
  if (testType === 'title' || testType === 'combo') {
    const texto = variante.title_text?.trim() || (variante.is_original ? originalTitle?.trim() : '')
    if (!texto) return 'sem texto de título'
  }
  return null
}

/** Aviso ao dono: a rotação do dia foi pulada porque a variante da vez não tem o que escrever. TEXTO-A-REVISAR (Logan, T17). */
export async function avisarRotacaoSemConteudo(
  args: { testId: string; siteId: string; testName: string; motivo: string; variantId: string },
): Promise<void> {
  Sentry.captureMessage('ab-rotate: variante sem arquivo/título, rotação pulada', {
    extra: { testId: args.testId, variantId: args.variantId, motivo: args.motivo },
  })
  try {
    await fanOutToSiteAdminsDetailed({
      siteId: args.siteId,
      domain: 'youtube',
      type: 'youtube.ab_restore_failed',
      priority: 1,
      title: 'A/B: rotação pulada',
      // TEXTO-A-REVISAR
      message: `A rotação de hoje do teste "${args.testName}" não foi feita: a variante da vez está ${args.motivo}. Abra o teste e confira as variantes.`,
      dedupKey: `ab-rotate-sem-conteudo:${args.testId}:${new Date().toISOString().slice(0, 10)}`,
      actionHref: `/cms/youtube/ab-lab/${args.testId}`,
      payload: { testId: args.testId, variantId: args.variantId },
    })
  } catch (e) {
    Sentry.captureException(e, { extra: { testId: args.testId, context: 'aviso-rotacao-sem-conteudo' } })
  }
}

/**
 * Reivindica a vez de rotacionar (P4a, 3.2): `restore_seq + 1` e o marcador da próxima variante, só se o teste
 * ainda está `active` no `restore_seq` que o chamador leu. Zero linhas (outra rotação, pausa, encerramento) = `null`:
 * o chamador não escreve nada. `marcadorLido` é o marcador velho de uma queda anterior (R2-7): a reivindicação aceita
 * exatamente ele, e só se a reivindicação que o gravou (`updated_at`) passou de `MARCADOR_VELHO_MS`: marcador novo é de
 * uma rotação em voo e não se toma; com `null` só passa quem tem o marcador limpo.
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
  q = marcadorLido === null
    ? q.is('last_applied_variant_id', null)
    : q.eq('last_applied_variant_id', marcadorLido).lt('updated_at', new Date(Date.now() - MARCADOR_VELHO_MS).toISOString())
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
  /** Prazo absoluto (epoch ms) das ações humanas (forçar rotação); o cron não passa. Ver `OpcoesApply.prazo`. */
  prazo?: number
  agora?: () => number
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

async function avisarCruzadaSemFalhar(args: Parameters<typeof avisarRotacaoCruzada>[0]): Promise<void> {
  try {
    await avisarRotacaoCruzada(args)
  } catch (e) {
    // O aviso é best-effort: o Sentry já registrou o cruzamento e o resultado não pode virar erro de rotação.
    Sentry.captureException(e, { extra: { testId: args.testId, context: 'aviso-rotacao-cruzada' } })
  }
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
    { antesDeEscrever, prazo: args.prazo, agora: args.agora },
  )

  if (aplicado.perdeuAVez) {
    if (aplicado.appliedThumbnail || aplicado.appliedMetadata) {
      Sentry.captureMessage('ab-rotate: perdeu a vez no meio da escrita', { extra: { testId: args.testId, seq: args.seq } })
      // Phil I-2: o YouTube ficou meio-a-meio e nenhum ciclo descreve; o dono precisa saber (mesmo aviso do cruzamento).
      await avisarCruzadaSemFalhar(args)
    }
    return { ok: false, motivo: 'perdeu_a_vez' }
  }
  if (!aplicado.ok) {
    return {
      ok: false,
      motivo: 'youtube',
      // TEXTO-A-REVISAR (Logan, T17)
      erro: aplicado.erroApi ?? new Error(aplicado.tempoEsgotado ? 'O YouTube demorou demais. Tente de novo.' : (aplicado.error ?? 'apply failed')),
      appliedThumbnail: aplicado.appliedThumbnail,
      appliedMetadata: aplicado.appliedMetadata,
    }
  }

  // Phil M-2: poll mais velho que o ciclo aberto é de antes de ele começar; gravá-lo no fecho viraria "medido em zero".
  // Sem poll (ou poll velho, ou erro de leitura) o fecho leva nulo = "não medido".
  const { data: aberto } = await supabase
    .from('ab_test_cycles').select('started_at').eq('test_id', args.testId).is('ended_at', null).limit(1).maybeSingle()
  const { data: poll, error: erroPoll } = await supabase
    .from('ab_test_polls')
    .select('views, likes, polled_at')
    .eq('test_id', args.testId)
    .order('polled_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (erroPoll) Sentry.captureMessage('ab-rotate: leitura do poll do fecho falhou', { extra: { testId: args.testId, erro: erroPoll.message } })
  const bruto = poll as { views: number | null; likes: number | null; polled_at: string | null } | null
  const inicioAberto = (aberto as { started_at: string } | null)?.started_at
  const pollValido = bruto && (!inicioAberto || (bruto.polled_at != null && bruto.polled_at >= inicioAberto))
  const p = pollValido ? bruto : null

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
    await avisarCruzadaSemFalhar(args)
    return { ok: false, motivo: 'cruzou_com_pausa' }
  }
  return { ok: true, cicloId: cicloId as string }
}

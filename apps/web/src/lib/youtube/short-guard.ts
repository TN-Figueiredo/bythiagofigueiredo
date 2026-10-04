import * as Sentry from '@sentry/nextjs'
import type { getSupabaseServiceClient } from '@/lib/supabase/service'
import { isYoutubeVideoId, probeShort, SHORT_MAX_SECONDS, type ProbeBudget, type ShortProbeStats } from '@/lib/youtube/short-classifier'

/**
 * Sonda de controle (I-2): um vídeo sabidamente longo (> 180 s) que o sync já conhece deve voltar 'normal'
 * (303 para /watch). Se não voltar, a sonda está sendo servida com interstício: nenhuma sonda da execução vale.
 */
export async function runControlProbe(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  budget: ProbeBudget,
  f: typeof fetch,
): Promise<'ok' | 'failed' | 'none'> {
  let control: 'ok' | 'failed' | 'none' = 'none'
  try {
    const { data } = await supabase
      .from('competitor_videos')
      .select('video_id')
      .gt('duration_seconds', SHORT_MAX_SECONDS)
      .order('published_at', { ascending: false })
      .limit(1)
    const id = (data as Array<{ video_id: string }> | null)?.[0]?.video_id
    if (id && isYoutubeVideoId(id)) control = (await probeShort(id, f)) === 'normal' ? 'ok' : 'failed'
  } catch {
    control = 'none'
  }
  if (control === 'failed') budget.controlFailed = true
  if (budget.stats) budget.stats.control = control
  return control
}

/** Aviso (uma vez por chamada, sem ids): sonda bloqueada ou controle reprovado. */
export function warnIfProbeBlocked(st: ShortProbeStats): void {
  const blocked = st.attempted >= 10 && st.shorts + st.regular === 0
  if (!blocked && st.control !== 'failed') return
  Sentry.captureMessage(
    st.control === 'failed'
      ? 'Sonda de Shorts reprovada no controle: um vídeo longo não voltou "normal" (provável interstício de consentimento/verificação); nenhuma sonda desta execução foi usada'
      : 'Sonda de Shorts bloqueada: nenhuma resposta conclusiva nesta execução (provável bloqueio de IP ou página de consentimento)',
    { level: 'warning', tags: { component: 'sync-youtube', mode: 'competitors-shorts-probe' } },
  )
}

import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PontoDaGuarda = 'rotacao' | 'start' | 'retomar' | 'forcar' | 'fila' | 'playoff'

/**
 * Modo `log` da flag AB_PAUSA_POR_DETECTADO: mede quantas vezes a guarda pausaria por linha só detectada. Nunca toca `status_note`
 * e nunca lança (o `log` é medição, não guarda): erro vai ao console e ao Sentry e a escrita segue como hoje.
 */
export async function anotarPausaDetectado(
  sb: SupabaseClient,
  a: { siteId: string; orgId: string | null; testId: string; videoId: string; nativeTestId: string; ponto: PontoDaGuarda },
): Promise<void> {
  try {
    let orgId = a.orgId
    if (orgId === null) {
      const o = await sb.from('sites').select('org_id').eq('id', a.siteId).maybeSingle()
      orgId = ((o.data as { org_id: string | null } | null)?.org_id) ?? null
    }
    const { error } = await sb.from('audit_log').insert({
      site_id: a.siteId, ...(orgId ? { org_id: orgId } : {}),
      action: 'ab_pausa_detectado_log', resource_type: 'ab_test', resource_id: a.testId, actor_user_id: null,
      after_data: { test_id: a.testId, video_id: a.videoId, native_test_id: a.nativeTestId, ponto: a.ponto, confirmado_em_nulo: true },
    })
    if (error) throw new Error(error.message)
  } catch (e) {
    console.error('[ab-guarda-nativa] audit_log do modo log falhou', e instanceof Error ? e.message : e)
    Sentry.captureException(e, { tags: { area: 'ab-guarda-nativa' }, extra: { testId: a.testId, ponto: a.ponto } })
  }
}

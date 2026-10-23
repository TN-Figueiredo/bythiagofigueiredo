import 'server-only'
/**
 * F3 T6: a faixa "algumas saíram" da abertura vinda do sino. Só vale para o aviso do PRÓPRIO usuário neste site; a chave vem da URL (hostil) e é
 * validada antes de qualquer consulta. Falha de leitura nunca vira faixa: `false` e Sentry (a página abre normal).
 */
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { contarAbertosEntre } from '@/lib/youtube/observatorio/sinais/leitura'

const CHAVE = /^nicho(-resumo)?:[\w:.-]{1,80}$/

export async function saiuDoAviso(sb: SupabaseClient, siteId: string, userId: string, dedupKey: string, agora: Date): Promise<boolean> {
  if (typeof dedupKey !== 'string' || !CHAVE.test(dedupKey)) return false
  try {
    const r = await sb.from('notifications').select('payload').eq('site_id', siteId).eq('user_id', userId).eq('dedup_key', dedupKey).maybeSingle()
    if (r.error) throw new Error('sugestoes: leitura da notificação falhou')
    if (!r.data) return false
    const ids = dedupKey.startsWith('nicho-resumo:')
      ? idsDoResumo((r.data as { payload?: unknown }).payload)
      : [dedupKey.slice('nicho:'.length)]
    const unicos = new Set(ids).size
    if (unicos === 0) return false
    const abertos = await contarAbertosEntre(sb, siteId, ids, agora)
    if (abertos === null) {
      Sentry.captureMessage('sugestoes: contagem do aviso nula', { level: 'warning' })
      return false
    }
    return abertos < unicos
  } catch {
    Sentry.captureMessage('sugestoes: saiuDoAviso falhou', { level: 'warning' })
    return false
  }
}

function idsDoResumo(payload: unknown): string[] {
  const ids = (payload as { ids?: unknown } | null | undefined)?.ids
  return Array.isArray(ids) ? ids.filter((i): i is string => typeof i === 'string') : []
}

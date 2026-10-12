// Observatório A5 (E1): as unidades da Data API gastas com os concorrentes, somadas na linha do dia.
import type { SupabaseClient } from '@supabase/supabase-js'

const PACIFIC = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' })
/** O dia em que a cota do YouTube zera: meia-noite do Pacífico (o fuso acompanha o horário de verão de lá). */
export const pacificDate = (ms: number): string => PACIFIC.format(new Date(ms))

/**
 * Soma numa instrução só (insert … on conflict do update, dentro de youtube_quota_add): dois disparos ao mesmo tempo
 * resultam na soma dos dois. Lança em erro; quem chama decide o que fazer (o sync segue e marca quotaError).
 */
export async function recordQuota(sb: SupabaseClient, p: { siteId: string; nowMs: number; units: number; mode: string; cut?: number; extra?: Record<string, number>; max?: Record<string, number> }): Promise<void> {
  // (emenda do portão: D-I5b) os contadores que só existiam na resposta do cron (que ninguém guarda) vão para a linha do dia
  const extra = Object.fromEntries(Object.entries(p.extra ?? {}).filter(([, v]) => v > 0))
  const max = { ...(p.cut ? { teto_diario_cortados: p.cut } : {}), ...Object.fromEntries(Object.entries(p.max ?? {}).filter(([, v]) => v > 0)) }
  if (p.units <= 0 && !Object.keys(extra).length && !Object.keys(max).length) return
  const { error } = await sb.rpc('youtube_quota_add', {
    p_site_id: p.siteId, p_day: pacificDate(p.nowMs), p_units: Math.max(p.units, 0), p_add: { ...(p.units > 0 ? { [p.mode]: p.units } : {}), ...extra },
    p_max: max,
  })
  if (error) throw new Error('cota: ' + (error.message ?? 'erro do banco'))
}

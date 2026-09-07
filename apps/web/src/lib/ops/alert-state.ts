// Acesso ao rate limiter `ops_alert_state` / `ops_alert_claim` (C1).
// `ops_alert_claim` é RATE LIMITER (comparação estrita), NUNCA contador de
// sequência — e variável de módulo é proibida como contador (reseta em todo
// cold start).
import type { SupabaseClient } from '@supabase/supabase-js'

/** `true` = a janela abriu e o carimbo foi renovado; `false` = ainda na janela. */
export async function claimAlert(
  supabase: SupabaseClient,
  key: string,
  interval: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('ops_alert_claim', {
    p_key: key,
    p_min_interval: interval,
  })
  if (error) throw new Error(`ops_alert_claim(${key}) failed: ${error.message}`)
  if (typeof data !== 'boolean') throw new Error(`ops_alert_claim(${key}) returned a non-boolean`)
  return data
}

/** Libera a janela — usado quando uma etapa opcional é PULADA por prazo. */
export async function releaseAlert(supabase: SupabaseClient, key: string): Promise<void> {
  await supabase.from('ops_alert_state').delete().eq('key', key)
}

export async function readAlertStamp(
  supabase: SupabaseClient,
  key: string,
): Promise<Date | null> {
  const { data } = await supabase
    .from('ops_alert_state')
    .select('last_at')
    .eq('key', key)
    .maybeSingle()
  const lastAt = (data as { last_at?: string } | null)?.last_at
  return lastAt ? new Date(lastAt) : null
}

/** Repõe o carimbo para agora sem passar pela janela (episódio contínuo/fóssil). */
export async function touchAlert(supabase: SupabaseClient, key: string): Promise<void> {
  await supabase
    .from('ops_alert_state')
    .upsert({ key, last_at: new Date().toISOString() }, { onConflict: 'key' })
}

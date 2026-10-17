// A5 G-1 (portão do L10, I-4): critério vermelho do retrato diário do canal próprio. O dia do retrato não volta (`ignoreDuplicates`, a API
// não devolve inscritos de ontem): dois dias de buraco calado são dois pontos perdidos para sempre na série de inscritos. Lê
// `yt_own_channel_snapshots` (dia de SP), nunca a tentativa (`attempt_day` é UTC e é "última escrita vence"). Fim definido: some sozinho
// no dia em que o canal voltar a gravar.
import type { SupabaseClient } from '@supabase/supabase-js'
import { spDateOf } from '@/lib/youtube/observatorio/time'

const DIA_MS = 86_400_000

/**
 * Depois do loop do `catchall` (04:00 SP): hoje já teve a chance de gravar, então "nenhum retrato em ontem nem hoje" = 2 dias sem retrato.
 * Leitura que falha é desconhecido, não "ok": vira frase vermelha também.
 */
export async function canaisSemRetrato(
  supabase: SupabaseClient,
  canais: ReadonlyArray<{ id: string; name?: string | null }>,
  agoraMs: number,
): Promise<string[]> {
  if (canais.length === 0) return []
  try {
    const desde = spDateOf(agoraMs - DIA_MS)
    const { data, error } = await supabase.from('yt_own_channel_snapshots')
      .select('youtube_channel_id')
      .in('youtube_channel_id', canais.map(c => c.id))
      .gte('snapshot_date', desde)
    if (error) return [`retrato público: não foi possível conferir os dias sem retrato (${error.code ?? error.message})`]
    const com = new Set((data ?? []).map(r => (r as { youtube_channel_id: string }).youtube_channel_id))
    return canais.filter(c => !com.has(c.id)).map(c => `canal ${c.name ?? c.id}: 2 dias sem retrato público`)
  } catch (e) {
    return [`retrato público: não foi possível conferir os dias sem retrato (${e instanceof Error ? e.message : String(e)})`]
  }
}

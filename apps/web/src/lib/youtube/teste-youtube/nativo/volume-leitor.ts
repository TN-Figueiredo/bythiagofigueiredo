// Leitura em lote do volume (D-4): a RPC `ab_lab_volume` lê impressões e privacidade, duas das doze tabelas privadas do canal próprio.
// Por isso só roda com a prova de leitura (`leituraValida`); o site da consulta sai DO TOKEN, nunca do chamador.
// Fica fora de `volume.ts` porque aquele módulo é importado por componente cliente e este puxa código de servidor.
import type { SupabaseClient } from '@supabase/supabase-js'
import { leituraValida, type LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import type { VolumeBruto } from './volume'

export interface VolumeLido extends VolumeBruto {
  /** Último `privacy_status` conhecido = 'public'; `null` = nunca capturado. */
  publico: boolean | null
}

const obj = (x: unknown): Record<string, unknown> | null =>
  typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null

/**
 * Uma ida à RPC `ab_lab_volume` (uma linha por vídeo pedido, `dias_cobertos = 0` quando não há relatório). Erro lança:
 * volume ausente por falha nunca vira "sem volume" calado. `bigint` volta como número ou texto, conforme o PostgREST.
 */
export async function lerVolumes(sb: SupabaseClient, leitura: LeituraPrivadaDoSite, videoIds: readonly string[]): Promise<Map<string, VolumeLido>> {
  if (!leituraValida(leitura)) throw new Error('ab_lab_volume: sem a prova de leitura do site')
  const saida = new Map<string, VolumeLido>()
  if (videoIds.length === 0) return saida
  const { data, error } = await sb.rpc('ab_lab_volume', { p_site: leitura.siteId, p_videos: [...videoIds] })
  if (error) throw new Error(`ab_lab_volume: ${error.message}`)
  for (const x of Array.isArray(data) ? data : []) {
    const o = obj(x)
    if (!o || typeof o.video_id !== 'string') continue
    const soma = Number(o.soma)
    const dias = Number(o.dias_cobertos)
    if (!Number.isFinite(soma) || !Number.isFinite(dias)) throw new Error('ab_lab_volume: linha em formato inesperado')
    saida.set(o.video_id, { soma, diasCobertos: dias, publico: typeof o.publico === 'boolean' ? o.publico : null })
  }
  return saida
}

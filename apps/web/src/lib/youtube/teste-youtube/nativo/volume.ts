// Volume de impressões por vídeo (D-4). A soma é feita no banco (`ab_lab_volume`); aqui só a regra do piso e a leitura em lote.
import type { SupabaseClient } from '@supabase/supabase-js'

/** Impressões que cada versão precisa para o teste do YouTube ter dado. */
export const IMPRESSOES_POR_VERSAO = 1540
export const JANELA_TESTE_DIAS = 14
/** Menos dias cobertos que isto: o volume ainda não foi lido (nunca "0"). */
export const DIAS_COBERTOS_MINIMOS = 3

/** Impressões por dia necessárias com `k` versões: ceil(1540·k/14) (k=2 → 220, k=3 → 330). */
export function pisoPorDia(k: number): number {
  return Math.ceil((IMPRESSOES_POR_VERSAO * k) / JANELA_TESTE_DIAS)
}

export interface VolumeDoVideo { porDia: number | null; acimaDoPiso: boolean | null; diasAtePiso: number | null }
export interface VolumeBruto { soma: number; diasCobertos: number }

/** Uma regra de arredondamento só (para cima), aqui; a fronteira 219/220 é de inteiros. */
export function volumeDoVideo(r: VolumeBruto | null, k: number): VolumeDoVideo {
  if (r === null || r.diasCobertos < DIAS_COBERTOS_MINIMOS) return { porDia: null, acimaDoPiso: null, diasAtePiso: null }
  const porDia = Math.ceil(r.soma / r.diasCobertos)
  return {
    porDia,
    acimaDoPiso: porDia >= pisoPorDia(k),
    diasAtePiso: porDia > 0 ? Math.ceil((IMPRESSOES_POR_VERSAO * k) / porDia) : null,
  }
}

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
export async function lerVolumes(sb: SupabaseClient, siteId: string, videoIds: readonly string[]): Promise<Map<string, VolumeLido>> {
  const saida = new Map<string, VolumeLido>()
  if (videoIds.length === 0) return saida
  const { data, error } = await sb.rpc('ab_lab_volume', { p_site: siteId, p_videos: [...videoIds] })
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

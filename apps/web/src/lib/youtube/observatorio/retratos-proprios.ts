import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChannelSnapshot } from './types'
import { JANELA_RETRATOS_DIAS } from './inscritos-28d'
import { DAY, H, spDateOf, spDateStart } from './time'

/** O PostgREST corta em 1.000 linhas sem avisar: chegar a esse número é erro visível, não dado parcial. */
const TETO_LINHAS = 1000

/** Mesma regra de `dmyOf` em load.ts (privado lá; provado igual por teste). */
const dmyOf = (date: string): string => { const [y, m, d] = date.slice(0, 10).split('-'); return d + '/' + m + '/' + y }

interface LinhaRetrato {
  youtube_channel_id: string
  snapshot_date: string
  subscriber_count: number | null
  subscribers_hidden: boolean
  view_count: number | null
}

export interface RetratosProprios { retratos: ChannelSnapshot[]; oculto: boolean }

/**
 * Retratos públicos diários dos canais próprios (MG20), no mesmo `ChannelSnapshot` dos concorrentes, só para a tela Inscritos.
 * Uma consulta pelo índice da PK (<= 91 linhas por canal). `oculto` vem do retrato mais novo, antes de descartar os nulos.
 * Erro de banco lança (a página decide). Sem canal próprio: não consulta.
 */
export async function lerRetratosProprios(
  sb: SupabaseClient,
  ownIds: readonly string[],
  agoraMs: number,
): Promise<Map<string, RetratosProprios>> {
  const out = new Map<string, RetratosProprios>()
  if (ownIds.length === 0) return out
  const { data, error } = await sb
    .from('yt_own_channel_snapshots')
    .select('youtube_channel_id, snapshot_date, subscriber_count, subscribers_hidden, view_count')
    .in('youtube_channel_id', [...ownIds])
    .gte('snapshot_date', spDateOf(agoraMs - JANELA_RETRATOS_DIAS * DAY))
    .order('snapshot_date')
  if (error) throw new Error(`retratos do canal próprio: ${error.message}`)
  const rows = (data ?? []) as LinhaRetrato[]
  if (rows.length >= TETO_LINHAS) throw new Error(`retratos do canal próprio: teto de ${TETO_LINHAS} linhas`)
  for (const id of ownIds) {
    const mine = rows.filter(r => r.youtube_channel_id === id).sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    const newest = mine[mine.length - 1]
    const oculto = newest !== undefined && newest.subscriber_count === null && newest.subscribers_hidden
    const retratos: ChannelSnapshot[] = mine
      .filter(r => r.subscriber_count !== null)
      .map(r => ({ t: spDateStart(r.snapshot_date) + 12 * H, date: dmyOf(r.snapshot_date), subs: r.subscriber_count as number, views: r.view_count ?? 0 }))
    out.set(id, { retratos, oculto })
  }
  return out
}

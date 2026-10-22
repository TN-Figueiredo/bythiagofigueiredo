// O retrato diário SEM variante (`ab_variant_id is null`) de um vídeo, para a ficha do caminho nativo (F1a): o título e a miniatura que o canal
// tinha num dia. `yt_own_video_meta_daily` é uma das doze tabelas privadas do canal próprio, então a leitura passa por `leituraValida` e o site
// sai DO TOKEN, nunca do chamador. Quem chama é o dono com acesso de edição ao site (as ações da ficha); `leituraDoEditor` repete a prova
// de edição e devolve `null` a quem não edita. Erro de banco é LANÇADO; sem acesso ou sem retrato devolve `null` (a ficha cai na próxima fonte).
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { leituraDoEditor, leituraValida } from './leitura-privada'
import type { LeituraPrivadaDoSite } from './leitura-privada'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ColunaRetrato = 'title_at_capture' | 'thumbnail_blob_url'

/** O retrato mais recente com a coluna preenchida, opcionalmente só de dias ANTERIORES a `antesDe` (`yyyy-mm-dd`, dia PT). */
export async function lerRetratoDiario(
  sb: SupabaseClient,
  p: { leitura: LeituraPrivadaDoSite | null; videoId: string; coluna: ColunaRetrato; antesDe?: string },
): Promise<string | null> {
  if (!leituraValida(p.leitura) || !UUID.test(p.videoId)) return null
  let q = sb.from('yt_own_video_meta_daily').select(`${p.coluna}, day_pt`)
    .eq('site_id', p.leitura.siteId).eq('video_id', p.videoId).is('ab_variant_id', null).not(p.coluna, 'is', null)
  if (p.antesDe !== undefined) q = q.lt('day_pt', p.antesDe)
  const { data, error } = await q.order('day_pt', { ascending: false }).limit(1)
  if (error) throw new Error(`yt_own_video_meta_daily: ${error.message}`)
  const v = ((data ?? []) as unknown as Array<Record<string, string | null>>)[0]?.[p.coluna]
  return typeof v === 'string' ? v : null
}

/** Para as ações da ficha: prova a edição do site e lê. Sem a prova: `null`, com aviso (a ficha segue sem essa fonte). */
export async function lerRetratoDoEditor(
  sb: SupabaseClient,
  p: { siteId: string; videoId: string; coluna: ColunaRetrato; antesDe?: string },
): Promise<string | null> {
  const leitura = await leituraDoEditor(p.siteId)
  if (!leitura || leitura.siteId !== p.siteId) {
    Sentry.captureMessage('ficha: retrato diário não lido, sem a prova de edição do site', { level: 'warning', extra: { siteId: p.siteId, coluna: p.coluna } })
    return null
  }
  return lerRetratoDiario(sb, { leitura, videoId: p.videoId, coluna: p.coluna, antesDe: p.antesDe })
}

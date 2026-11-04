// Observatório — o aquecimento de um site com as funções reais da tela (F3-cache T3). Leitura estreita: nada de `loadLiveRows`
// (que traz as tabelas leves de todos os canais); só `competitor_settings` e os canais pedidos.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { aquecerCanais, PRAZO_INTERNO_MS, type CanalViva, type ResultadoAquecer } from './aquecer'
import { ms, seriesStartAt } from './load'
import { readChannel } from './load-page'
import { lerPlanosDoCanal, novosAvisos } from './medidas-telas/carregar-do-site'

interface CanalDaChave extends CanalViva { video_limit: number; last_ok_synced_at: string | null }
const LOTE_DE_IDS = 100

/** Os mesmos 3 valores da chave que a tela monta: `last` = ms do last_ok_synced_at, `video_limit` cru, início da série na meia-noite de SP. */
async function lerVivasEstreito(sb: SupabaseClient, siteId: string, ids: readonly string[] | null): Promise<{ canais: CanalDaChave[]; descartados: number; seriesStartAt: number | null }> {
  const st = await sb.from('competitor_settings').select('series_started_at').eq('site_id', siteId).maybeSingle()
  if (st.error) throw new Error('competitor_settings: ' + st.error.message)
  const serie = seriesStartAt(ms((st.data as { series_started_at: string | null } | null)?.series_started_at))
  const COLS = 'id, site_id, video_limit, last_ok_synced_at'
  const linhas: Array<{ id: string; video_limit: number; last_ok_synced_at: string | null }> = []
  if (ids === null) {
    const r = await sb.from('competitor_channels').select(COLS).eq('site_id', siteId).order('id')
    if (r.error) throw new Error('competitor_channels: ' + r.error.message)
    linhas.push(...((r.data ?? []) as typeof linhas))
  } else {
    for (let i = 0; i < ids.length; i += LOTE_DE_IDS) {
      const r = await sb.from('competitor_channels').select(COLS).eq('site_id', siteId).in('id', ids.slice(i, i + LOTE_DE_IDS))
      if (r.error) throw new Error('competitor_channels: ' + r.error.message)
      linhas.push(...((r.data ?? []) as typeof linhas))
    }
  }
  const porId = new Map(linhas.map(l => [l.id, l]))
  const ordem = ids === null ? linhas.map(l => l.id) : [...new Set(ids)].filter(id => porId.has(id))
  const canais: CanalDaChave[] = ordem.map(id => { const l = porId.get(id)!; return { id, last: ms(l.last_ok_synced_at), video_limit: l.video_limit, last_ok_synced_at: l.last_ok_synced_at } })
  return { canais, descartados: ids === null ? 0 : new Set(ids).size - canais.length, seriesStartAt: serie }
}

export interface PedidoAquecer { siteId: string; ids: readonly string[] | null; invalidadoEm?: number | null }

export async function aquecerSite(sb: SupabaseClient, p: PedidoAquecer, o: { agora?: () => number; dormir?: (ms: number) => Promise<void>; prazoMs?: number } = {}): Promise<ResultadoAquecer> {
  const agora = o.agora ?? Date.now
  const avisos = novosAvisos()
  let serie: number | null = null
  try {
    return await aquecerCanais<CanalDaChave>(p.ids, {
      lerVivas: async ids => { const r = await lerVivasEstreito(sb, p.siteId, ids); serie = r.seriesStartAt; return { canais: r.canais, descartados: r.descartados } },
      lerPacote: c => readChannel(sb, p.siteId, c, serie, agora()),
      lerMedidas: async c => {
        const resposta = await lerPlanosDoCanal(sb, { siteId: p.siteId, channelId: c.id, agoraMs: agora() }, c.last, avisos)
        const nao = [resposta.canal, resposta.videos, resposta.marcas, resposta.retratos].find(x => !x.lido)
        return { resposta, parcial: nao && !nao.lido ? nao.causa : null }
      },
      agora,
      dormir: o.dormir ?? (t => new Promise<void>(r => setTimeout(r, t))),
      prazoMs: o.prazoMs ?? PRAZO_INTERNO_MS,
      invalidadoEm: p.invalidadoEm,
    })
  } finally {
    avisos.fechar()
  }
}

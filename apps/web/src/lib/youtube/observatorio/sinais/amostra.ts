// Amostra de título e miniatura por `video_id` (F2 T8): só para a página/bloco, NUNCA para a rota nem para o MCP (D5/D8: o payload
// do Cowork não leva texto de terceiro nem URL de imagem). Duas consultas por abertura, k ≤ 20 ids.
// `siteId` vem da guarda, nunca de parâmetro da pessoa. Título é texto de terceiro: quem renderiza usa só texto React.
import type { SupabaseClient } from '@supabase/supabase-js'

import { BLOCO_DO_IN } from './leitura'

export interface AmostraDoVideo {
  titulo: string
  miniatura: string | null
  origem: 'competidor' | 'proprio'
  /** Nome do canal (só competidor; `competitor_channels.channel_name`). */
  canal: string | null
  /** `video_lugares.chaves` do vídeo (as duas origens); `null` = vídeo sem linha de lugar. */
  chaves: string[] | null
}

const miniaturaDoProprio = (youtubeVideoId: string): string => `https://i.ytimg.com/vi/${youtubeVideoId}/mqdefault.jpg`

/**
 * `ids` mistura `competitor_videos.id` (outliers da evidência) e `youtube_videos.id` (`proprios_agora`). Id sem linha (outro site, oculto,
 * inexistente) fica AUSENTE do mapa e a linha usa o fallback. Tudo em blocos de `BLOCO_DO_IN` (o URL do PostgREST tem limite).
 */
export async function lerAmostraDasLinhas(sb: SupabaseClient, siteId: string, ids: string[]): Promise<Map<string, AmostraDoVideo>> {
  const saida = new Map<string, AmostraDoVideo>()
  const unicos = [...new Set(ids)]
  if (unicos.length === 0) return saida
  const lugares = new Map<string, string[]>()
  const comps: Array<{ id: string; title: string | null; thumbnail_url: string | null; competitor_channels: { channel_name: string | null } | Array<{ channel_name: string | null }> | null }> = []
  const props: Array<{ id: string; title: string | null; youtube_video_id: string | null }> = []
  for (let i = 0; i < unicos.length; i += BLOCO_DO_IN) {
    const bloco = unicos.slice(i, i + BLOCO_DO_IN)
    const [comp, prop, vl] = await Promise.all([
      // competitor_videos não tem site_id: o filtro de site é pelo canal (padrão de load.ts)
      sb.from('competitor_videos').select('id, title, thumbnail_url, competitor_channels!inner(site_id, channel_name)').in('id', bloco).eq('competitor_channels.site_id', siteId),
      sb.from('youtube_videos').select('id, title, youtube_video_id').in('id', bloco).eq('site_id', siteId).eq('is_hidden', false),
      sb.from('video_lugares').select('video_id, chaves').in('video_id', bloco).eq('site_id', siteId),
    ])
    if (comp.error) throw new Error('amostra: leitura de competitor_videos falhou')
    if (prop.error) throw new Error('amostra: leitura de youtube_videos falhou')
    if (vl.error) throw new Error('amostra: leitura de video_lugares falhou')
    comps.push(...((comp.data ?? []) as unknown as typeof comps))
    props.push(...((prop.data ?? []) as unknown as typeof props))
    for (const r of (vl.data ?? []) as unknown as Array<{ video_id: string; chaves: string[] | null }>) if (Array.isArray(r.chaves)) lugares.set(r.video_id, r.chaves)
  }
  for (const r of comps) {
    if (!r.title) continue
    const ch = Array.isArray(r.competitor_channels) ? r.competitor_channels[0] : r.competitor_channels
    saida.set(r.id, { titulo: r.title, miniatura: r.thumbnail_url ?? null, origem: 'competidor', canal: ch?.channel_name || null, chaves: lugares.get(r.id) ?? null })
  }
  for (const r of props) {
    if (r.title && !saida.has(r.id)) saida.set(r.id, { titulo: r.title, miniatura: r.youtube_video_id ? miniaturaDoProprio(r.youtube_video_id) : null, origem: 'proprio', canal: null, chaves: lugares.get(r.id) ?? null })
  }
  return saida
}

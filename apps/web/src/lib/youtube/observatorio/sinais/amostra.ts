// Amostra de título e miniatura por `video_id` (F2 T8): só para a página/bloco, NUNCA para a rota nem para o MCP (D5/D8: o payload
// do Cowork não leva texto de terceiro nem URL de imagem). Duas consultas por abertura, k ≤ 20 ids.
// `siteId` vem da guarda, nunca de parâmetro da pessoa. Título é texto de terceiro: quem renderiza usa só texto React.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface AmostraDoVideo { titulo: string; miniatura: string | null; origem: 'competidor' | 'proprio' }

const miniaturaDoProprio = (youtubeVideoId: string): string => `https://i.ytimg.com/vi/${youtubeVideoId}/mqdefault.jpg`

/**
 * `ids` mistura `competitor_videos.id` (outliers da evidência) e `youtube_videos.id` (`proprios_agora`). Id sem linha (outro site, oculto,
 * inexistente) fica AUSENTE do mapa e a linha usa o fallback.
 */
export async function lerAmostraDasLinhas(sb: SupabaseClient, siteId: string, ids: string[]): Promise<Map<string, AmostraDoVideo>> {
  const saida = new Map<string, AmostraDoVideo>()
  const unicos = [...new Set(ids)]
  if (unicos.length === 0) return saida
  const [comp, prop] = await Promise.all([
    // competitor_videos não tem site_id: o filtro de site é pelo canal (padrão de load.ts)
    sb.from('competitor_videos').select('id, title, thumbnail_url, competitor_channels!inner(site_id)').in('id', unicos).eq('competitor_channels.site_id', siteId).returns<Array<{ id: string; title: string | null; thumbnail_url: string | null }>>(),
    sb.from('youtube_videos').select('id, title, youtube_video_id').in('id', unicos).eq('site_id', siteId).eq('is_hidden', false).returns<Array<{ id: string; title: string | null; youtube_video_id: string | null }>>(),
  ])
  if (comp.error) throw new Error('amostra: leitura de competitor_videos falhou')
  if (prop.error) throw new Error('amostra: leitura de youtube_videos falhou')
  for (const r of (comp.data ?? [])) {
    if (r.title) saida.set(r.id, { titulo: r.title, miniatura: r.thumbnail_url ?? null, origem: 'competidor' })
  }
  for (const r of (prop.data ?? [])) {
    if (r.title && !saida.has(r.id)) saida.set(r.id, { titulo: r.title, miniatura: r.youtube_video_id ? miniaturaDoProprio(r.youtube_video_id) : null, origem: 'proprio' })
  }
  return saida
}

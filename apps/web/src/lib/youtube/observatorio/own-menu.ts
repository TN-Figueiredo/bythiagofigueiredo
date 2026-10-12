// Os canais próprios do site com a contagem de vídeos visíveis: a leitura leve do atalho "Meu canal" na página do canal, cujo conjunto de UM
// canal lança em `ownChannels` (spec 15.2, D15). Uma consulta só: a contagem e a data do vídeo mais novo saem das mesmas linhas. Cliente de serviço (sem RLS): quem chama já passou a guarda de acesso e tira `siteId` de
// getSiteContext(), nunca da URL. Os mesmos filtros do carregador do site: `site_id` e vídeo não escondido (`is_hidden = false`).
import 'server-only'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { readAll, readOwnChannels } from './load'

/** `ultimo` = publicação do vídeo mais novo do canal (ms), `null` se nenhum tem data legível: a regra do "meu canal" a usa (D-C.6). */
export interface OwnMenuRow { id: string; name: string; subs: number; videos: number; ultimo: number | null }

/** Um erro de leitura é lançado: uma lista vazia esconderia o atalho em silêncio. */
export async function loadOwnMenuRows(siteId: string): Promise<OwnMenuRow[]> {
  const sb = getSupabaseServiceClient()
  const [canais, videos] = await Promise.all([
    readOwnChannels(sb, siteId),
    readAll<{ channel_id: string; published_at: string | null }>('youtube_videos', () => sb.from('youtube_videos').select('channel_id, published_at').eq('site_id', siteId).eq('is_hidden', false).order('id')),
  ])
  const por = new Map<string, number>(), ultimo = new Map<string, number>()
  for (const v of videos) {
    por.set(v.channel_id, (por.get(v.channel_id) ?? 0) + 1)
    const t = v.published_at == null ? NaN : Date.parse(v.published_at)
    if (Number.isFinite(t) && t > (ultimo.get(v.channel_id) ?? -Infinity)) ultimo.set(v.channel_id, t)
  }
  return canais.map(c => ({ id: c.id, name: c.name, subs: c.subscriber_count, videos: por.get(c.id) ?? 0, ultimo: ultimo.get(c.id) ?? null }))
}

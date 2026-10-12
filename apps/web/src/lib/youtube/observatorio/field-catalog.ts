// Observatório A5 (E1): o catálogo FECHADO dos campos com histórico em competitor_field_versions.
// Campo fora daqui não é gravado (assertField lança). Título, miniatura e descrição do vídeo não entram: continuam em
// competitor_video_versions, para a conta "Trocas" das telas e competitor_changes não mudarem (spec A5, princípio D3).
// (emenda do portão: D-m8) views_hidden entra no catálogo: sem ele, a data em que a contagem foi ocultada só se deduzia da série.
export const VIDEO_FIELDS = ['tags', 'category_id', 'duration_seconds', 'default_language', 'default_audio_language', 'live_broadcast_content', 'comments_disabled', 'likes_hidden', 'views_hidden', 'availability'] as const
export const CHANNEL_FIELDS = ['name', 'custom_url', 'description', 'country', 'avatar_url', 'subscribers_hidden', 'availability'] as const
export type VideoField = (typeof VIDEO_FIELDS)[number]
export type ChannelField = (typeof CHANNEL_FIELDS)[number]
export type FieldScope = 'video' | 'canal'
/** 'gap' = a janela da mudança é um buraco de coleta; 'first' = primeira leitura do campo (não é mudança). */
export type FieldPrecision = '6h' | '1d' | '7d' | 'gap' | 'first'
export type Availability = 'no_ar' | 'sumiu'

export function assertField(scope: FieldScope, field: string): void {
  const list: readonly string[] = scope === 'video' ? VIDEO_FIELDS : CHANNEL_FIELDS
  if (!list.includes(field)) throw new Error('campo fora do catálogo do Observatório (' + scope + '): ' + field)
}

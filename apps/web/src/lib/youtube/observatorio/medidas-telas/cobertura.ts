/**
 * Até onde vai o histórico GUARDADO de um canal. A sincronização inicial para em `video_limit` vídeos (Shorts e lives inclusos) e depois só entram
 * vídeos novos; por isso a contagem de um período antigo (ex.: os 90 dias anteriores a 90 dias atrás) só vale se o guardado alcança o começo dele.
 * Sem esta conferência, "N contra 0" apareceria como "subindo" para quase todo canal recém-adicionado (portão Phil C1, 17/10).
 */
const DAY = 86_400_000

export interface HistoricoGuardado {
  /** Menor `published_at` dos vídeos com data (ms); null = nenhum vídeo com data. */
  desde: number | null
  /** Vídeos guardados (com e sem data). */
  guardados: number
  /** `youtube_video_count` do canal; null = o YouTube não informou. */
  noYouTube: number | null
  /** A primeira busca ainda não terminou. */
  backfill: boolean
}

export type Cobertura = { ok: true } | { ok: false; desde: number | null }

/** O período anterior (até `dias` dias atrás) está coberto: busca terminada E (o mais antigo guardado passa de `dias` dias OU tudo o que o canal tem está guardado). */
export function anteriorCoberto(h: HistoricoGuardado, nowMs: number, dias = 180): Cobertura {
  if (h.backfill) return { ok: false, desde: h.desde }
  const alcanca = h.desde !== null && h.desde <= nowMs - dias * DAY
  const tudo = h.noYouTube !== null && h.guardados >= h.noYouTube
  return alcanca || tudo ? { ok: true } : { ok: false, desde: h.desde }
}

// Catálogo fechado do `kind` de yt_own_collection_attempts. Sem import: qualquer módulo pode importar daqui.
// Mudar esta lista exige a migration que muda o CHECK da coluna (e o falso de teste a acompanha sozinho).

export const COLLECTION_KINDS = [
  'sondagem', 'meta', 'thumbnail', 'relatorio', 'diario', 'retencao_vida', 'retencao_7d', 'retencao_30d',
  'dimensoes', 'normalizador_trafego', 'normalizador_alcance_dim',
] as const

export type AttemptKind = (typeof COLLECTION_KINDS)[number]

/** A forma que o banco aceita para um `kind` (o CHECK da coluna). */
export const KIND_RE = /^[a-z0-9_]{1,40}$/

export function ehKind(x: unknown): x is AttemptKind {
  return typeof x === 'string' && (COLLECTION_KINDS as readonly string[]).includes(x)
}

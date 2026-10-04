/**
 * Uma campanha só é pública quando publicada: status 'published' com published_at já passado
 * (mesma regra da policy RLS "campaign_translations public read published" e do CHECK
 * campaigns_published_requires_published_at). Rascunho/ready/agendada/arquivada => não pública.
 * As rotas públicas usam o service client (bypassa RLS), então aplicam esta regra no código.
 */
export function isCampaignPublic(
  row: { status?: string | null; published_at?: string | null } | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!row || row.status !== 'published' || !row.published_at) return false
  const t = new Date(row.published_at).getTime()
  return !Number.isNaN(t) && t <= now
}

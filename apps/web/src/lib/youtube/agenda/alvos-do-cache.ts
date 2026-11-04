// O que o disparo da agenda escreveu, canal a canal, para o cache do Observatório cair só onde mudou (F3-cache T1).
// Lista ausente, vazia ou fora da forma = o site inteiro (nunca nada).
type Alvos = Map<string, Set<string> | 'inteiro'>

const ehObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** `Record<site, string[]>` válido; o que vier fora da forma é descartado (quem chama decide o que fazer com o site). */
export function listaPorSite(x: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  if (!ehObj(x)) return out
  for (const [site, ids] of Object.entries(x)) {
    if (!Array.isArray(ids)) continue
    const bons = ids.filter((i): i is string => typeof i === 'string' && i !== '')
    if (bons.length > 0) out[site] = bons
  }
  return out
}

function somar(alvos: Alvos, site: string, ids: readonly string[]): void {
  const atual = alvos.get(site)
  if (atual === 'inteiro') return
  const set = atual ?? new Set<string>()
  for (const i of ids) set.add(i)
  alvos.set(site, set)
}

/**
 * Une o lote de canais, a fase semanal e as marcas de idade. O lote traz `siteIds`; um site dele sem lista de canais (lote antigo, campo torto)
 * cai inteiro. As marcas trazem `sitesInteiros` para o vídeo cujo canal não foi resolvido.
 */
export function juntarAlvos(o: { lote?: { siteIds?: unknown; channelIdsBySite?: unknown } | null; semanal?: unknown; marcas?: unknown }): Array<{ siteId: string; channelIds: string[] | null }> {
  const alvos: Alvos = new Map()
  if (o.lote) {
    const porSite = listaPorSite(o.lote.channelIdsBySite)
    const sites = Array.isArray(o.lote.siteIds) ? o.lote.siteIds.filter((s): s is string => typeof s === 'string') : []
    for (const s of sites) { if (porSite[s]) somar(alvos, s, porSite[s]); else alvos.set(s, 'inteiro') }
    for (const [s, ids] of Object.entries(porSite)) somar(alvos, s, ids)
  }
  if (ehObj(o.semanal)) for (const [s, ids] of Object.entries(listaPorSite(o.semanal.channelIdsBySite))) somar(alvos, s, ids)
  if (ehObj(o.marcas)) {
    for (const [s, ids] of Object.entries(listaPorSite(o.marcas.channelIdsBySite))) somar(alvos, s, ids)
    if (Array.isArray(o.marcas.sitesInteiros)) for (const s of o.marcas.sitesInteiros) if (typeof s === 'string') alvos.set(s, 'inteiro')
  }
  return [...alvos].map(([siteId, v]) => ({ siteId, channelIds: v === 'inteiro' ? null : [...v] }))
}

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
export function juntarAlvos(o: { lote?: { siteIds?: unknown; channelIdsBySite?: unknown } | null; semanal?: unknown; marcas?: unknown; inteiros?: Iterable<string> }): Array<{ siteId: string; channelIds: string[] | null }> {
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
  // sites cuja tarefa rodou sem devolver a lista (prazo estourado, exceção): o site inteiro vence a lista
  if (o.inteiros) for (const s of o.inteiros) alvos.set(s, 'inteiro')
  return [...alvos].map(([siteId, v]) => ({ siteId, channelIds: v === 'inteiro' ? null : [...v] }))
}

/** Tarefas que a agenda despacha e o que cada uma devolve para o cache (só o que `sitesSemLista` precisa). */
interface FinalDeTarefa { tarefa: string; estado: string; motivo?: string; extra?: unknown }
const RODOU = new Set(['ok', 'parcial', 'erro'])

/**
 * Os sites que caem inteiros porque a tarefa RODOU e não devolveu a lista (o despachante corta `extra` quando o prazo estoura ou a tarefa lança,
 * e a promessa abandonada segue gravando). Lote e fase semanal: os sites que `visitados` registrou. Marcas de idade: só no prazo estourado ou
 * na exceção (sem `extra` num dia sem marca nova é normal), todos os sites das linhas. Tarefa que não rodou (nao_devida, adiada...) não derruba nada.
 */
export function sitesSemLista(o: { tarefas: readonly FinalDeTarefa[]; visitados: Iterable<string>; sitesDasLinhas: Iterable<string> }): string[] {
  const out = new Set<string>()
  const de = (nome: string): FinalDeTarefa | undefined => o.tarefas.find(t => t.tarefa === nome)
  const lote = de('sincronizar_canais')
  if (lote && RODOU.has(lote.estado) && !(ehObj(lote.extra) && Array.isArray(lote.extra.siteIds))) for (const s of o.visitados) out.add(s)
  const semanal = de('serie_semanal')
  if (semanal && RODOU.has(semanal.estado) && !(ehObj(semanal.extra) && ehObj(semanal.extra.channelIdsBySite))) for (const s of o.visitados) out.add(s)
  const marcas = de('marcas_de_idade')
  if (marcas && RODOU.has(marcas.estado) && marcas.extra === undefined && (marcas.motivo === 'passou_do_tempo' || marcas.motivo === 'excecao')) for (const s of o.sitesDasLinhas) out.add(s)
  return [...out]
}

/** A fase semanal sem a lista de canais, para a resposta e o log (a lista cresce com o surto e só serve ao cache). */
export function semListaDeCanais<T>(w: T): T {
  if (!ehObj(w) || !('channelIdsBySite' in w)) return w
  const { channelIdsBySite: _canais, ...resto } = w
  return resto as T
}

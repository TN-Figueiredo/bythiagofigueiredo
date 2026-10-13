// A5 · E14: quem é consultado, quem é autor de destaque e as faixas. Puro: sem banco, sem rede.
// Nenhum número de inscritos nem razão exata sai daqui: só o código da faixa.
import { optCount } from '@/lib/youtube/competitor-capture'
import { COMMENT_RULES, SIZE_BANDS, RATIO_BANDS } from './regras'
import { ordenar } from './ordem'
import type { Conversa, Destaque } from './tipos'

type Obj = Record<string, unknown>
const obj = (x: unknown): Obj | null => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Obj) : null)

/**
 * Dos `featuredLookup` comentários de topo mais curtidos (ordem única de `ordem.ts`), os canais distintos que não são o criador,
 * nem acompanhados do mesmo site, nem do dono. `semId` = quantos desses comentários não têm `canalId` (não dá para consultar).
 */
export function quemConsultar(
  conversas: Conversa[],
  ctx: { canalDoVideo: string; acompanhados: Map<string, string>; proprios: Set<string> },
): { ids: string[]; semId: number } {
  const topo = ordenar(conversas).slice(0, COMMENT_RULES.featuredLookup)
  const ids: string[] = []
  const vistos = new Set<string>()
  let semId = 0
  for (const c of topo) {
    const id = c.autor.canalId
    if (id === null) { semId += 1; continue }
    if (id === ctx.canalDoVideo || ctx.acompanhados.has(id) || ctx.proprios.has(id) || vistos.has(id)) continue
    vistos.add(id)
    ids.push(id)
  }
  return { ids, semId }
}

/**
 * `channels.list?part=statistics`: id → inscritos. `null` no valor = ocultos ou sem `subscriberCount` numérico ("não se sabe", nunca "pequeno").
 * Mapa nulo = a resposta não dá para ler (sem `items` e `pageInfo.totalResults` diferente de 0, ou ausente).
 * Sem `items` com `totalResults = 0` é mapa vazio: o YouTube omite `items` quando nenhum id existe. Só entram ids pedidos.
 */
export function inscritosDe(body: unknown, pedidos: string[]): Map<string, number | null> | null {
  const b = obj(body)
  if (!b) return null
  if (b.items === undefined) return obj(b.pageInfo)?.totalResults === 0 ? new Map() : null
  if (!Array.isArray(b.items)) return null
  const pedido = new Set(pedidos)
  const mapa = new Map<string, number | null>()
  for (const item of b.items) {
    const it = obj(item)
    const id = typeof it?.id === 'string' ? it.id : null
    if (id === null || !pedido.has(id)) continue
    const st = obj(it?.statistics)
    const n = st?.hiddenSubscriberCount === true ? null : optCount(st?.subscriberCount)
    mapa.set(id, n !== null && n >= 0 ? n : null)
  }
  return mapa
}

/** A maior faixa cujo piso `valor` alcança; nula abaixo da primeira. */
function faixaDe(bandas: ReadonlyArray<readonly [string, number]>, atinge: (piso: number) => boolean): string | null {
  let achada: string | null = null
  for (const [codigo, piso] of bandas) if (atinge(piso)) achada = codigo
  return achada
}

/**
 * (a) o autor, ou o autor de uma resposta vista, é canal acompanhado: `canal_acompanhado` (o do comentário vence); o autor é canal do dono:
 * `canal_proprio`. (b) inscritos >= `featuredMinSubs` e (razão >= `featuredMinRatio` ou razão que não se sabe): `inscritos`, só com as faixas.
 * O criador nunca é destaque (o canal do vídeo é acompanhado, e não pode marcar o que ele mesmo respondeu).
 */
export function destaqueDe(
  c: Conversa,
  ctx: {
    canalDoVideo: string; acompanhados: Map<string, string>; proprios: Set<string>
    inscritosDoCanalDoVideo: number | null; inscritos: Map<string, number | null> | null
  },
): Destaque | null {
  if (c.doCriador) return null
  const autor = c.autor.canalId
  if (autor !== null && autor !== ctx.canalDoVideo) {
    const linha = ctx.acompanhados.get(autor)
    if (linha !== undefined) return { motivo: 'canal_acompanhado', canalRowId: linha, faixaTamanho: null, faixaRazao: null }
  }
  for (const id of c.canaisNasRespostas) {
    if (id === ctx.canalDoVideo) continue
    const linha = ctx.acompanhados.get(id)
    if (linha !== undefined) return { motivo: 'canal_acompanhado', canalRowId: linha, faixaTamanho: null, faixaRazao: null }
  }
  if (autor === null) return null
  if (ctx.proprios.has(autor)) return { motivo: 'canal_proprio', canalRowId: null, faixaTamanho: null, faixaRazao: null }

  const subs = ctx.inscritos?.get(autor)
  if (subs === undefined || subs === null || subs < COMMENT_RULES.featuredMinSubs) return null
  const base = ctx.inscritosDoCanalDoVideo
  const razaoConhecida = base !== null && base > 0
  // razão >= piso, sem divisão: subs >= piso * base
  if (razaoConhecida && subs < COMMENT_RULES.featuredMinRatio * base) return null
  return {
    motivo: 'inscritos',
    canalRowId: null,
    faixaTamanho: faixaDe(SIZE_BANDS, piso => subs >= piso),
    faixaRazao: razaoConhecida ? faixaDe(RATIO_BANDS, piso => subs >= piso * base) : null,
  }
}

/**
 * Quantos dos consultados ficaram "não se sabe": sem `subscriberCount`, ocultos ou não devolvidos. Mapa nulo (a consulta falhou): todos.
 * Quem chama soma `semId` de `quemConsultar` para o `featured_unknown_n`.
 */
export function desconhecidos(consultados: string[], inscritos: Map<string, number | null> | null): number {
  if (inscritos === null) return consultados.length
  return consultados.filter(id => (inscritos.get(id) ?? null) === null).length
}

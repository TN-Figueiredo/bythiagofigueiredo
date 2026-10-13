// A5 · E14: a resposta de commentThreads.list e de comments.list vira valor nosso. Puro: sem banco, sem rede.
// Texto, nome e id de terceiros NUNCA vão a log, erro nem Sentry; as respostas de terceiros só deixam aqui o id do canal.
import { optCount, cleanText, sanitizeForDb } from '@/lib/youtube/competitor-capture'
import { COMMENT_RULES } from './regras'
import type { AgregadosDoLote, Conversa, RespostaVista } from './tipos'

type Obj = Record<string, unknown>
const obj = (x: unknown): Obj | null => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Obj) : null)
/** Texto não vazio, sem NUL nem substituto solitário (o Postgres os recusa). */
const str = (x: unknown): string | null => (typeof x === 'string' && x !== '' ? cleanText(x) : null)
/** Data que `Date.parse` aceita: uma data ilegível derrubaria a escrita do retrato inteiro, a cada tentativa. */
const dataValida = (x: unknown): string | null => {
  const s = str(x)
  return s !== null && Number.isFinite(Date.parse(s)) ? s : null
}
/** Contagem lida da API: nula quando ausente ou ilegível (nunca 0), e nula quando negativa. */
const contagem = (x: unknown): number | null => {
  const n = optCount(x)
  return n !== null && n >= 0 ? n : null
}
const canalDe = (snippet: Obj): string | null => str(obj(snippet.authorChannelId)?.value)
/** Um texto de comentário: limpo, cortado em `bodyMax` pontos de código, marcado quando cortado. */
export function limparTexto(s: string): { texto: string; cortado: boolean } {
  const limpo = sanitizeForDb(s).value
  const pontos = Array.from(limpo)
  if (pontos.length <= COMMENT_RULES.bodyMax) return { texto: limpo, cortado: false }
  return { texto: pontos.slice(0, COMMENT_RULES.bodyMax).join(''), cortado: true }
}
/** `textDisplay` legível: texto, e não vazio (nem só espaço) depois da limpeza. */
function textoDe(snippet: Obj): { texto: string; cortado: boolean } | null {
  const bruto = snippet.textDisplay
  if (typeof bruto !== 'string') return null
  const t = limparTexto(bruto)
  return t.texto.trim() === '' ? null : t
}
/** `updatedAt` só quando legível e diferente de `publishedAt`. */
const editadoEmDe = (snippet: Obj, publicadoEm: string): string | null => {
  const e = dataValida(snippet.updatedAt)
  return e !== null && e !== publicadoEm ? e : null
}

/** Uma resposta vista. Nula quando falta id, texto, data legível ou curtida legível: não conta como vista. */
function respostaDe(item: unknown): RespostaVista | null {
  const it = obj(item)
  const sn = obj(it?.snippet)
  if (!it || !sn) return null
  const id = str(it.id)
  const t = textoDe(sn)
  const publicadoEm = dataValida(sn.publishedAt)
  const curtidas = contagem(sn.likeCount)
  if (id === null || t === null || publicadoEm === null || curtidas === null) return null
  return { id, texto: t.texto, cortado: t.cortado, publicadoEm, editadoEm: editadoEmDe(sn, publicadoEm), curtidas, autorCanalId: canalDe(sn) }
}

export function conversaDe(item: unknown, posicao: number, canalDoVideo: string): Conversa | null {
  const it = obj(item)
  const snippet = obj(it?.snippet)
  const topo = obj(snippet?.topLevelComment)
  const sn = obj(topo?.snippet)
  if (!snippet || !topo || !sn) return null
  const id = str(topo.id)
  const curtidas = contagem(sn.likeCount)
  const publicadoEm = dataValida(sn.publishedAt)
  const t = textoDe(sn)
  if (id === null || curtidas === null || publicadoEm === null || t === null) return null

  // As respostas vistas: sem id repetido; só as do criador guardam texto.
  const vistas: RespostaVista[] = []
  const ids = new Set<string>()
  const lista = obj(it?.replies)?.comments
  if (Array.isArray(lista)) {
    for (const r of lista) {
      const v = respostaDe(r)
      if (v === null || ids.has(v.id)) continue
      ids.add(v.id)
      vistas.push(v)
    }
  }
  const doCriadorTodas = vistas
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v.autorCanalId !== null && v.autorCanalId === canalDoVideo)
    .sort((a, b) => Date.parse(a.v.publicadoEm) - Date.parse(b.v.publicadoEm) || a.i - b.i)
    .map(({ v }) => v)
  const totalLido = contagem(snippet.totalReplyCount)

  let criadorRespondeu: boolean | null
  if (doCriadorTodas.length > 0) criadorRespondeu = true
  else if (totalLido === null) criadorRespondeu = null // não se sabe quantas há, e nenhuma vista é dele
  else criadorRespondeu = vistas.length >= totalLido ? false : null

  const canalId = canalDe(sn)
  const canaisNasRespostas = [...new Set(vistas.map(v => v.autorCanalId).filter((c): c is string => c !== null))]
  return {
    id, posicao, texto: t.texto, cortado: t.cortado, publicadoEm, editadoEm: editadoEmDe(sn, publicadoEm), curtidas,
    respostasTotal: Math.max(totalLido ?? 0, vistas.length),
    autor: { nome: str(sn.authorDisplayName), canalId, foto: str(sn.authorProfileImageUrl) },
    doCriador: canalId !== null && canalId === canalDoVideo,
    criadorRespondeu,
    respostasDoCriador: doCriadorTodas.slice(0, COMMENT_RULES.creatorRepliesMax),
    canaisNasRespostas,
  }
}

/** Nulo quando `items` não é lista (nunca "lista vazia" no lugar de resposta ilegível). */
export function loteDe(body: unknown, canalDoVideo: string): { conversas: Conversa[]; descartadas: number; completo: boolean } | null {
  const b = obj(body)
  if (!b || !Array.isArray(b.items)) return null
  const conversas: Conversa[] = []
  const ids = new Set<string>()
  let descartadas = 0
  b.items.forEach((item, posicao) => {
    const c = conversaDe(item, posicao, canalDoVideo)
    if (c === null || ids.has(c.id)) { descartadas += 1; return }
    ids.add(c.id)
    conversas.push(c)
  })
  return { conversas, descartadas, completo: str(b.nextPageToken) === null }
}

/**
 * A conferência por id (`comments.list?id=`). `curtidas` é nulo quando a API não trouxe `likeCount` legível (não medido, nunca 0).
 * `respostasTotal` é sempre nulo: esta chamada não traz respostas. Item sem id ou sem texto legível não entra no mapa.
 */
export function porIdDe(body: unknown): Map<string, { texto: string; cortado: boolean; editadoEm: string | null; curtidas: number | null; respostasTotal: number | null }> | null {
  const b = obj(body)
  if (!b || !Array.isArray(b.items)) return null
  const mapa = new Map<string, { texto: string; cortado: boolean; editadoEm: string | null; curtidas: number | null; respostasTotal: number | null }>()
  for (const item of b.items) {
    const it = obj(item)
    const sn = obj(it?.snippet)
    const id = str(it?.id)
    const t = sn ? textoDe(sn) : null
    if (!sn || id === null || t === null) continue
    const publicadoEm = dataValida(sn.publishedAt)
    mapa.set(id, { texto: t.texto, cortado: t.cortado, editadoEm: publicadoEm === null ? null : editadoEmDe(sn, publicadoEm), curtidas: contagem(sn.likeCount), respostasTotal: null })
  }
  return mapa
}

/** Só número: nenhum texto, nome nem id (o banco recusa). Lote vazio: `curtidas_max` e `curtidas_mediana` ausentes. */
export function agregadosDoLote(lote: { conversas: Conversa[]; descartadas: number }, t0Ms: number): AgregadosDoLote {
  const cs = lote.conversas
  const a: AgregadosDoLote = {
    conversas: cs.length, descartadas: lote.descartadas, curtidas_soma: 0, respostas_soma: 0, do_criador: 0,
    criador_respondeu_sim: 0, criador_respondeu_nao: 0, criador_respondeu_nao_se_sabe: 0, autores_distintos: 0, sem_canal: 0, nas_primeiras_24h: 0,
  }
  const autores = new Set<string>()
  for (const c of cs) {
    a.curtidas_soma += c.curtidas
    a.respostas_soma += c.respostasTotal
    if (c.doCriador) a.do_criador += 1
    if (c.criadorRespondeu === true) a.criador_respondeu_sim += 1
    else if (c.criadorRespondeu === false) a.criador_respondeu_nao += 1
    else a.criador_respondeu_nao_se_sabe += 1
    if (c.autor.canalId === null) a.sem_canal += 1
    else autores.add(c.autor.canalId)
    if (Date.parse(c.publicadoEm) <= t0Ms + 24 * 3_600_000) a.nas_primeiras_24h += 1
  }
  a.autores_distintos = autores.size
  if (cs.length > 0) {
    const ord = cs.map(c => c.curtidas).sort((x, y) => x - y)
    const meio = ord.length >> 1
    a.curtidas_max = ord[ord.length - 1]
    a.curtidas_mediana = ord.length % 2 === 1 ? ord[meio] : ((ord[meio - 1] as number) + (ord[meio] as number)) / 2
  }
  return a
}

// A5 · E14: respostas SINTÉTICAS de commentThreads.list, comments.list e channels.list.
// Mesma FORMA da resposta real (C0.3), dado 100% inventado: nenhum texto, nome ou id de pessoa real.
// Datas relativas a T0 (nunca data futura fixa).

export const T0 = Date.parse('2026-01-10T12:00:00.000Z')
export const H = 3_600_000
export const iso = (ms: number): string => new Date(ms).toISOString()

/** Id de canal fictício: 'UC' + 22 caracteres. */
export const canal = (n: number): string => `UC${'Inventado' + String(n).padStart(13, '0')}`
export const CANAL_DO_VIDEO = canal(1)
export const CANAL_ACOMPANHADO = canal(2)
export const CANAL_DO_DONO = canal(3)

/** Sentinelas: nenhuma pode aparecer onde só número deve sair. */
export const SENT_TEXTO_TOPO = 'SENTINELA_TEXTO_TOPO_001'
export const SENT_NOME = 'Autor Inventado SENTINELA_NOME'
export const SENT_TEXTO_TERCEIRO = 'SENTINELA_TEXTO_TERCEIRO_002'
export const SENT_NOME_TERCEIRO = 'Terceiro Inventado SENTINELA_NOME_T'
export const SENT_ID_TOPO = 'Ugx-sintetico-SENTINELA-ID'

export interface OpcoesResposta {
  id?: string
  texto?: string | null
  nome?: string | null
  canalId?: string | null | 'sem-chave'
  curtidas?: number | string | null | 'sem-chave'
  publicadoEm?: string | null
  editadoEm?: string | null
}

export function resposta(pai: string, n: number, o: OpcoesResposta = {}): Record<string, unknown> {
  const id = o.id ?? `${pai}.Resposta-sintetica-${String(n).padStart(2, '0')}`
  const snippet: Record<string, unknown> = {
    channelId: CANAL_DO_VIDEO,
    parentId: pai,
    textDisplay: o.texto === undefined ? `Resposta inventada ${n}` : o.texto,
    textOriginal: `Resposta inventada ${n}`,
    authorDisplayName: o.nome === undefined ? `Autor Inventado ${n}` : o.nome,
    authorProfileImageUrl: `https://exemplo.invalid/foto/${n}.jpg`,
    authorChannelUrl: `https://exemplo.invalid/canal/${n}`,
    canRate: true,
    viewerRating: 'none',
    publishedAt: o.publicadoEm === undefined ? iso(T0 + n * H) : o.publicadoEm,
    updatedAt: o.editadoEm === undefined ? iso(T0 + n * H) : o.editadoEm,
  }
  if (o.canalId !== 'sem-chave') snippet.authorChannelId = { value: o.canalId === undefined ? canal(100 + n) : o.canalId }
  if (o.curtidas !== 'sem-chave') snippet.likeCount = o.curtidas === undefined ? 0 : o.curtidas
  return { kind: 'youtube#comment', etag: `etag-r-${n}`, id, snippet }
}

export interface OpcoesConversa {
  id?: string | null
  texto?: string | null
  nome?: string | null
  canalId?: string | null | 'sem-chave'
  curtidas?: number | string | null | 'sem-chave'
  publicadoEm?: string | null | 'sem-chave'
  editadoEm?: string | null
  totalReplyCount?: number | 'sem-chave'
  respostas?: Array<Record<string, unknown>> | 'sem-chave'
  semSnippet?: boolean
  semTopLevel?: boolean
}

export function conversa(n: number, o: OpcoesConversa = {}): Record<string, unknown> {
  if (o.semSnippet) return { kind: 'youtube#commentThread', etag: `etag-${n}`, id: `Ugx-sintetico-${n}` }
  const id = o.id === undefined ? `Ugx-sintetico-${String(n).padStart(2, '0')}` : o.id
  const topSnippet: Record<string, unknown> = {
    channelId: CANAL_DO_VIDEO,
    videoId: 'vid-inventado-01',
    textDisplay: o.texto === undefined ? `Comentário inventado ${n}` : o.texto,
    textOriginal: `Comentário inventado ${n}`,
    authorDisplayName: o.nome === undefined ? `Autor Inventado ${n}` : o.nome,
    authorProfileImageUrl: `https://exemplo.invalid/foto/${n}.jpg`,
    authorChannelUrl: `https://exemplo.invalid/canal/${n}`,
    canRate: true,
    viewerRating: 'none',
    updatedAt: o.editadoEm === undefined ? iso(T0 + n * H) : o.editadoEm,
  }
  if (o.publicadoEm !== 'sem-chave') topSnippet.publishedAt = o.publicadoEm === undefined ? iso(T0 + n * H) : o.publicadoEm
  if (o.canalId !== 'sem-chave') topSnippet.authorChannelId = { value: o.canalId === undefined ? canal(100 + n) : o.canalId }
  if (o.curtidas !== 'sem-chave') topSnippet.likeCount = o.curtidas === undefined ? n : o.curtidas
  const topLevelComment: Record<string, unknown> = { kind: 'youtube#comment', etag: `etag-t-${n}`, snippet: topSnippet }
  if (id !== null) topLevelComment.id = id
  const snippet: Record<string, unknown> = {
    channelId: CANAL_DO_VIDEO,
    videoId: 'vid-inventado-01',
    canReply: true,
    isPublic: true,
  }
  if (!o.semTopLevel) snippet.topLevelComment = topLevelComment
  if (o.totalReplyCount !== 'sem-chave') snippet.totalReplyCount = o.totalReplyCount ?? (Array.isArray(o.respostas) ? o.respostas.length : 0)
  const item: Record<string, unknown> = { kind: 'youtube#commentThread', etag: `etag-${n}`, id: id ?? `Ugx-sintetico-${n}`, snippet }
  if (o.respostas !== 'sem-chave' && o.respostas !== undefined) item.replies = { comments: o.respostas }
  return item
}

export function corpoDeConversas(items: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { kind: 'youtube#commentThreadListResponse', etag: 'etag-lista', pageInfo: { totalResults: 100, resultsPerPage: 100 }, items, ...extra }
}

/** Resposta de comments.list?id=…: itens são comentários soltos (sem replies). */
export function corpoPorId(items: unknown): Record<string, unknown> {
  return { kind: 'youtube#commentListResponse', etag: 'etag-ids', items }
}

export function comentarioPorId(id: string, o: OpcoesResposta = {}): Record<string, unknown> {
  const r = resposta('pai', 1, { ...o, id })
  const sn = r.snippet as Record<string, unknown>
  delete sn.parentId
  return { ...r, id, snippet: sn }
}

/** Resposta de commentThreads.list com comentários desligados. */
export const CORPO_DESLIGADOS = {
  error: { code: 403, message: 'comentários desligados (sintético)', errors: [{ reason: 'commentsDisabled', domain: 'youtube.commentThread', location: 'videoId' }] },
}

export function canalComInscritos(id: string, o: { inscritos?: number | 'sem-chave'; ocultos?: boolean } = {}): Record<string, unknown> {
  const statistics: Record<string, unknown> = { viewCount: '1', videoCount: '1', hiddenSubscriberCount: o.ocultos ?? false }
  if (o.inscritos !== 'sem-chave' && !o.ocultos) statistics.subscriberCount = String(o.inscritos ?? 0)
  return { kind: 'youtube#channel', etag: `etag-c-${id}`, id, statistics }
}

export function corpoDeCanais(items: unknown, totalResults?: number): Record<string, unknown> {
  const out: Record<string, unknown> = { kind: 'youtube#channelListResponse', etag: 'etag-canais' }
  if (totalResults !== undefined) out.pageInfo = { totalResults, resultsPerPage: 5 }
  if (items !== undefined) out.items = items
  return out
}

/**
 * A5 · E9, Tarefa 4: o leitor da fila "Saíram do YouTube". Lê tudo o que a tela mostra, com o site em TODO filtro, e nunca devolve "vazio" quando
 * não conseguiu ler: qualquer leitura com erro devolve `{ estado: 'erro' }` inteiro (não há fila parcial).
 *
 * Toda leitura de lista é paginada de 1.000 em 1.000 com `order` escrito e `count: 'exact'` (a API corta em 1.000 linhas SEM erro); passou de
 * `LISTA_TETO`, ou terminou com número de linhas diferente da contagem da ÚLTIMA página, é erro. Nada de texto de terceiros em log ou Sentry.
 */
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { schemaE9 } from './schema'
import {
  JANELA_FORJA_MIN, LISTA_TETO, MANTIDO_QUE_VOLTOU_DIAS, RESPONDIDOS_PAGINA, diasDesde,
  type CodigoDeErro, type FilaLida, type ItemApagando, type ItemEsperando, type ItemRespondido, type ItemVoltou, type LeituraDaFila, type Previa, type TipoDeItem,
} from './modelo'

type Linha = Record<string, unknown>
const PAGINA = 1000
const DIA_MS = 86_400_000

const ehObjeto = (v: unknown): v is Linha => typeof v === 'object' && v !== null && !Array.isArray(v)
const txt = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}
const linhas = (d: unknown): Linha[] => (Array.isArray(d) ? d.filter(ehObjeto) : [])
const aninhado = (v: unknown): Linha => (ehObjeto(v) ? v : Array.isArray(v) && ehObjeto(v[0]) ? v[0] : {})
const listaDeTexto = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

class ErroDeLeitura extends Error {
  constructor(readonly etapa: string, readonly codigo: CodigoDeErro, readonly detalhe?: string) { super(`leitura falhou: ${etapa}`) }
}

interface Pagina { data: unknown; error: { message: string } | null; count: number | null }

/** Lê uma lista inteira, de 1.000 em 1.000. `consulta` já traz `select(…, { count: 'exact' })`, o filtro do site e `order`. */
async function lerLista(etapa: string, consulta: (de: number, ate: number) => PromiseLike<Pagina>): Promise<Linha[]> {
  const todas: Linha[] = []
  let contagem: number | null = null
  for (let de = 0; ; de += PAGINA) {
    const r = await consulta(de, de + PAGINA - 1)
    if (r.error) throw new ErroDeLeitura(etapa, 'erro_de_banco')
    contagem = r.count
    if (contagem === null) throw new ErroDeLeitura(etapa, 'erro_de_banco', 'sem contagem')
    if (contagem > LISTA_TETO) throw new ErroDeLeitura(etapa, 'erro_de_banco', `${contagem} linhas (teto ${LISTA_TETO})`)
    const rows = linhas(r.data)
    todas.push(...rows)
    if (rows.length < PAGINA) break
  }
  if (todas.length !== contagem) throw new ErroDeLeitura(etapa, 'erro_de_banco', `${todas.length} linhas lidas, contagem ${contagem}`)
  return todas
}

const COLUNAS_VIDEO = 'id, video_id, title, view_count, like_count, comment_count, duration_seconds, is_short, published_at, discovered_at, thumbnail_url, missing_since, last_seen_at, removal_decision, removal_decided_at, competitor_channel_id, competitor_channels!inner(id, channel_name, site_id, missing_since, subscriber_count)'
const COLUNAS_CANAL = 'id, channel_id, channel_name, subscriber_count, thumbnail_url, missing_since, last_seen_at, removal_decision, removal_decided_at'
const COLUNAS_COMENTARIO = 'id, competitor_channel_id, video_id, missing_since, removal_decision, removal_decided_at, parent_id, competitor_videos(title, missing_since), canal:competitor_channels!competitor_channel_id(channel_name, missing_since)'
const COLUNAS_REMOVIDO = 'id, kind, youtube_id, competitor_channel_id, decided_at, blobs_pending, archive_pending, returned_seen_at, return_decision'

function tipoDoRemovido(kind: unknown): TipoDeItem {
  return kind === 'canal' ? 'canal' : kind === 'comentario' ? 'comentarios' : 'video'
}

const ms = (v: unknown): number => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN
  return Number.isFinite(t) ? t : 0
}

export async function lerFila(
  sb: SupabaseClient,
  o: { siteId: string; mostrar: number; agoraMs: number; podeResponder: boolean },
): Promise<LeituraDaFila> {
  const { siteId } = o
  const hojeSP = new Date(o.agoraMs - 3 * 3_600_000).toISOString().slice(0, 10)

  const texto = await schemaE9(sb)
  if (texto !== null) return { estado: 'schema_ausente', texto }

  try {
    const [vids, canais, coms, mantidosVoltaram, info, apagandoRows, voltaramRows, respondidosQ, grupos] = await Promise.all([
      lerLista('videos_ausentes', (de, ate) => sb.from('competitor_videos').select(COLUNAS_VIDEO, { count: 'exact' })
        .eq('competitor_channels.site_id', siteId).not('missing_since', 'is', null).order('id').range(de, ate)),
      lerLista('canais_ausentes', (de, ate) => sb.from('competitor_channels').select(COLUNAS_CANAL, { count: 'exact' })
        .eq('site_id', siteId).not('missing_since', 'is', null).order('id').range(de, ate)),
      lerLista('comentarios_ausentes', (de, ate) => sb.from('competitor_video_comments').select(COLUNAS_COMENTARIO, { count: 'exact' })
        .eq('site_id', siteId).not('missing_since', 'is', null).order('id').range(de, ate)),
      lerMantidosQueVoltaram(sb, siteId, o.agoraMs),
      sb.from('competitor_channels').select('last_ok_synced_at', { count: 'exact' }).eq('site_id', siteId)
        .order('last_ok_synced_at', { ascending: false, nullsFirst: false }).limit(1),
      lerLista('apagando', (de, ate) => sb.from('competitor_removed_items').select(COLUNAS_REMOVIDO, { count: 'exact' })
        .eq('site_id', siteId).or('archive_pending.eq.true,blobs_pending.neq.{}').order('id').range(de, ate)),
      lerLista('voltaram', (de, ate) => sb.from('competitor_removed_items').select(COLUNAS_REMOVIDO, { count: 'exact' })
        .eq('site_id', siteId).not('returned_seen_at', 'is', null).is('return_decision', null).order('id').range(de, ate)),
      sb.from('competitor_removed_items').select(COLUNAS_REMOVIDO, { count: 'exact' })
        .eq('site_id', siteId).in('kind', ['video', 'canal']).eq('archive_pending', false).eq('blobs_pending', '{}')
        .or('returned_seen_at.is.null,return_decision.not.is.null')
        .order('decided_at', { ascending: false }).order('id', { ascending: false }).range(0, RESPONDIDOS_PAGINA - 1),
      sb.rpc('competitor_removed_comment_groups', { p_site: siteId }),
    ])
    if (info.error) throw new ErroDeLeitura('ultima_leitura', 'erro_de_banco')
    if (respondidosQ.error) throw new ErroDeLeitura('respondidos', 'erro_de_banco')
    if (grupos.error || !Array.isArray(grupos.data)) throw new ErroDeLeitura('comentarios_apagados', 'erro_de_banco')

    const canaisAusentes = new Set(canais.map(c => String(c.id)))

    // ---- esperando
    const esperando: ItemEsperando[] = []
    const base = (tipo: TipoDeItem, chave: string): ItemEsperando => ({
      tipo, chave, titulo: null, canal: null, desde: '', diasEsperando: 0, ultimaLeitura: null, views: null, curtidas: null, comentarios: null, inscritos: null,
      canalNoAr: null, formato: null, duracaoSeg: null, publicadoEm: null, vistoPrimeiro: null, miniaturaUrl: null, codigo: null, videosDoGrupo: null,
      idsDoGrupo: null, previa: { erro: 'contagem_indisponivel' }, decisao: null,
    })
    const mantidos: ItemRespondido[] = []

    for (const v of vids) {
      const c = aninhado(v.competitor_channels)
      if (txt(c.missing_since) !== null || canaisAusentes.has(String(v.competitor_channel_id))) continue // o canal é o item
      const desde = txt(v.missing_since) ?? ''
      if (v.removal_decision === 'manter') {
        mantidos.push({ tipo: 'video', situacao: 'mantido', itemId: null, codigo: txt(v.video_id), titulo: txt(v.title), quando: txt(v.removal_decided_at) ?? desde, comentarios: null })
        continue
      }
      esperando.push({
        ...base('video', String(v.id)), titulo: txt(v.title), canal: txt(c.channel_name), desde, diasEsperando: diasDesde(desde, hojeSP), ultimaLeitura: txt(v.last_seen_at),
        views: num(v.view_count), curtidas: num(v.like_count), comentarios: num(v.comment_count), inscritos: num(c.subscriber_count), canalNoAr: true,
        formato: typeof v.is_short === 'boolean' ? (v.is_short ? 'short' : 'longo') : null, duracaoSeg: num(v.duration_seconds), publicadoEm: txt(v.published_at),
        vistoPrimeiro: txt(v.discovered_at), miniaturaUrl: txt(v.thumbnail_url), codigo: txt(v.video_id),
      })
    }
    for (const c of canais) {
      const desde = txt(c.missing_since) ?? ''
      if (c.removal_decision === 'manter') {
        mantidos.push({ tipo: 'canal', situacao: 'mantido', itemId: null, codigo: txt(c.channel_id), titulo: txt(c.channel_name), quando: txt(c.removal_decided_at) ?? desde, comentarios: null })
        continue
      }
      esperando.push({
        ...base('canal', String(c.id)), titulo: txt(c.channel_name), desde, diasEsperando: diasDesde(desde, hojeSP), ultimaLeitura: txt(c.last_seen_at),
        inscritos: num(c.subscriber_count), canalNoAr: false, miniaturaUrl: txt(c.thumbnail_url), codigo: txt(c.channel_id),
      })
    }
    // comentários: um item por canal; o de vídeo ou canal ausente vai com o vídeo/canal
    const porCanal = new Map<string, Linha[]>()
    for (const k of coms) {
      const v = aninhado(k.competitor_videos)
      const c = aninhado(k.canal)
      if (txt(v.missing_since) !== null || txt(c.missing_since) !== null || canaisAusentes.has(String(k.competitor_channel_id))) continue
      const chave = String(k.competitor_channel_id)
      porCanal.set(chave, [...(porCanal.get(chave) ?? []), k])
    }
    for (const [canalId, rows] of porCanal) {
      const abertos = rows.filter(k => k.removal_decision == null)
      const dMenor = (xs: Linha[]): string => xs.map(k => txt(k.missing_since) ?? '').filter(Boolean).sort()[0] ?? ''
      const nomeDoCanal = txt(aninhado(rows[0]?.canal).channel_name)
      if (abertos.length === 0) {
        const m = rows.filter(k => k.removal_decision === 'manter')
        if (m.length > 0) {
          mantidos.push({ tipo: 'comentarios', situacao: 'mantido', itemId: null, codigo: null, titulo: nomeDoCanal, quando: m.map(k => txt(k.removal_decided_at) ?? '').sort().reverse()[0] || dMenor(m), comentarios: m.length })
        }
        continue
      }
      const porVideo = new Map<string, { titulo: string | null; comentarios: number }>()
      for (const k of abertos) {
        const id = String(k.video_id)
        const atual = porVideo.get(id) ?? { titulo: txt(aninhado(k.competitor_videos).title), comentarios: 0 }
        atual.comentarios += 1
        porVideo.set(id, atual)
      }
      const desde = dMenor(abertos)
      const nVid = porVideo.size
      esperando.push({
        ...base('comentarios', canalId), titulo: `${abertos.length} ${abertos.length === 1 ? 'comentário' : 'comentários'} de ${nVid} ${nVid === 1 ? 'vídeo' : 'vídeos'}`,
        canal: nomeDoCanal, desde, diasEsperando: diasDesde(desde, hojeSP), comentarios: abertos.length, videosDoGrupo: [...porVideo.values()],
        idsDoGrupo: abertos.map(k => num(k.id)).filter((n): n is number => n !== null).sort((a, b) => a - b),
      })
    }
    esperando.sort((a, b) => (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0))
    const totalEsperando = esperando.length
    const mostrados = esperando.slice(0, Math.max(0, o.mostrar))
    await Promise.all(mostrados.map(async item => { item.previa = await pedirPrevia(sb, siteId, item) }))

    // ---- apagando / voltaram / respondidos
    const apagando: ItemApagando[] = apagandoRows.map(r => ({
      itemId: num(r.id) ?? 0, tipo: tipoDoRemovido(r.kind), codigo: r.kind === 'comentario' ? null : txt(r.youtube_id), decididoEm: txt(r.decided_at) ?? '',
      pendentes: listaDeTexto(r.blobs_pending), arquivoPendente: r.archive_pending === true, voltouEm: txt(r.returned_seen_at),
    }))
    const idsApagando = new Set(apagando.map(a => a.itemId))
    const voltaram: ItemVoltou[] = []
    const comentariosQueVoltaram = new Map<string, Linha[]>()
    for (const r of voltaramRows) {
      if (idsApagando.has(num(r.id) ?? -1)) continue // aparece só em "Apagando", com a data da volta
      if (r.kind === 'comentario') {
        const chave = String(r.competitor_channel_id ?? '')
        comentariosQueVoltaram.set(chave, [...(comentariosQueVoltaram.get(chave) ?? []), r])
        continue
      }
      voltaram.push({ tipo: tipoDoRemovido(r.kind), pedeResposta: true, itemIds: [num(r.id) ?? 0], codigo: txt(r.youtube_id), titulo: null, voltouEm: txt(r.returned_seen_at), comentarios: null })
    }
    for (const rows of comentariosQueVoltaram.values()) {
      voltaram.push({
        tipo: 'comentarios', pedeResposta: true, itemIds: rows.map(r => num(r.id) ?? 0).sort((a, b) => a - b), codigo: null, titulo: null,
        voltouEm: rows.map(r => txt(r.returned_seen_at) ?? '').sort().reverse()[0] || null, comentarios: rows.length,
      })
    }
    voltaram.push(...mantidosVoltaram)

    const apagados: ItemRespondido[] = linhas(respondidosQ.data).map(r => ({
      tipo: tipoDoRemovido(r.kind), situacao: 'apagado' as const, itemId: num(r.id), codigo: txt(r.youtube_id), titulo: null, quando: txt(r.decided_at) ?? '', comentarios: null,
    }))
    const gruposApagados: ItemRespondido[] = linhas(grupos.data).map(g => ({
      tipo: 'comentarios' as const, situacao: 'apagado' as const, itemId: null, codigo: null, titulo: null, quando: txt(g.decided_at) ?? '', comentarios: num(g.comentarios),
    }))
    const respondidosTotal = mantidos.length + (respondidosQ.count ?? apagados.length) + gruposApagados.length
    const respondidos = [...mantidos, ...apagados, ...gruposApagados].sort((a, b) => ms(b.quando) - ms(a.quando)).slice(0, RESPONDIDOS_PAGINA)

    const fila: FilaLida = {
      esperando: mostrados, totalEsperando, apagando, voltaram, respondidos, respondidosTotal,
      ultimaLeituraDosCanais: txt(linhas(info.data)[0]?.last_ok_synced_at), canaisDoSite: info.count ?? 0, podeResponder: o.podeResponder,
    }
    return { estado: 'ok', fila }
  } catch (err) {
    const e = err instanceof ErroDeLeitura ? err : new ErroDeLeitura('desconhecida', 'erro_de_banco')
    Sentry.captureException(e, { tags: { component: 'observatorio-saiu', step: e.etapa }, extra: { siteId, codigo: e.codigo, detalhe: e.detalhe } })
    return { estado: 'erro', codigo: e.codigo, ...(e.detalhe ? { detalhe: e.detalhe } : {}) }
  }
}

/** Mantidos nos últimos 30 dias (auditoria) que voltaram ao ar: só informam, não pedem resposta. */
async function lerMantidosQueVoltaram(sb: SupabaseClient, siteId: string, agoraMs: number): Promise<ItemVoltou[]> {
  const desde = new Date(agoraMs - MANTIDO_QUE_VOLTOU_DIAS * DIA_MS).toISOString()
  const audit = await lerLista('auditoria', (de, ate) => sb.from('audit_log').select('resource_id, created_at', { count: 'exact' })
    .eq('site_id', siteId).eq('action', 'competitor_missing_keep').eq('resource_type', 'competitor_video').gte('created_at', desde)
    .order('created_at', { ascending: false }).order('id').range(de, ate))
  const ids = [...new Set(audit.map(a => txt(a.resource_id)).filter((x): x is string => x !== null))].slice(0, 200)
  if (ids.length === 0) return []
  const r = await sb.from('competitor_videos').select('id, video_id, title, missing_since, competitor_channels!inner(site_id)')
    .in('id', ids).eq('competitor_channels.site_id', siteId)
  if (r.error) throw new ErroDeLeitura('mantidos_que_voltaram', 'erro_de_banco')
  const quando = new Map(audit.map(a => [txt(a.resource_id) ?? '', txt(a.created_at)]))
  return linhas(r.data).filter(v => txt(v.missing_since) === null).map(v => ({
    tipo: 'video' as const, pedeResposta: false, itemIds: [], codigo: txt(v.video_id), titulo: txt(v.title), voltouEm: quando.get(String(v.id)) ?? null, comentarios: null,
  }))
}

/** A prévia de um item. Qualquer falha vira `{ erro }` do item: o item perde "Guardado" e o botão de apagar, mas "Manter" continua. */
async function pedirPrevia(sb: SupabaseClient, siteId: string, item: ItemEsperando): Promise<Previa | { erro: CodigoDeErro }> {
  try {
    if (item.tipo === 'comentarios') {
      const r = await sb.rpc('competitor_comments_preview', { p_site: siteId, p_channel: item.chave, p_comment_ids: (item.idsDoGrupo ?? []).slice(0, 500) })
      const d: unknown = r.data
      if (r.error || !ehObjeto(d) || d.status !== 'ok' || !ehObjeto(d.rows)) return { erro: 'contagem_indisponivel' }
      return { linhas: contagens(d.rows), miniaturas: 0, forjaEmAndamento: false, respostasDoCriador: num(d.respostas) ?? 0 }
    }
    const kind = item.tipo === 'canal' ? 'canal' : 'video'
    const [r, versoes] = await Promise.all([
      sb.rpc('competitor_purge_preview', { p_site: siteId, p_kind: kind, p_id: item.chave, p_janela_min: JANELA_FORJA_MIN }),
      contarVersoes(sb, kind, item.chave),
    ])
    const d: unknown = r.data
    if (r.error || !ehObjeto(d) || d.status !== 'ok' || !ehObjeto(d.rows) || versoes === null) return { erro: 'contagem_indisponivel' }
    return { linhas: contagens(d.rows), miniaturas: num(d.blobs) ?? 0, forjaEmAndamento: d.forja_em_andamento === true, respostasDoCriador: 0, versoes }
  } catch {
    return { erro: 'contagem_indisponivel' }
  }
}

function contagens(rows: Linha): Record<string, number> {
  const saida: Record<string, number> = {}
  for (const [k, v] of Object.entries(rows)) { const n = num(v); if (n !== null) saida[k] = n }
  return saida
}

/** Versões do item por campo (a frase "3 títulos, 2 miniaturas, 1 descrição"). `null` = não deu para contar. */
async function contarVersoes(sb: SupabaseClient, kind: 'video' | 'canal', id: string): Promise<{ title: number; thumb: number; desc: number } | null> {
  const conta = async (field: 'title' | 'thumb' | 'desc'): Promise<number | null> => {
    const q = kind === 'video'
      ? sb.from('competitor_video_versions').select('id', { count: 'exact', head: true }).eq('video_id', id).eq('field', field)
      : sb.from('competitor_video_versions').select('id, competitor_videos!inner(competitor_channel_id)', { count: 'exact', head: true })
        .eq('competitor_videos.competitor_channel_id', id).eq('field', field)
    const r = await q
    return r.error ? null : r.count ?? 0
  }
  const [title, thumb, desc] = await Promise.all([conta('title'), conta('thumb'), conta('desc')])
  return title === null || thumb === null || desc === null ? null : { title, thumb, desc }
}

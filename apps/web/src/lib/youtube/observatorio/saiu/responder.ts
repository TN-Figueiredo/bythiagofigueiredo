/**
 * A5 · E9, Tarefa 6: as respostas da fila como funções de orquestração, sem Next e sem leitura de sessão (quem chama já passou pela guarda de
 * administração). Nunca lançam. Cada resposta é UMA função do banco (transação única, com a auditoria dentro); o Blob é depois do commit, com o
 * pendente já gravado pela função, e só o que o Blob CONFIRMOU sai de `blobs_pending`.
 *
 * Nenhum título, texto de comentário ou nome de autor passa por aqui para o Sentry: só ids internos, códigos e contagens.
 */
import * as Sentry from '@sentry/nextjs'
import { isIP } from 'node:net'
import type { SupabaseClient } from '@supabase/supabase-js'
import { apagarDoBlob as apagarDoBlobPadrao, type ResultadoDoBlob } from './blob'
import { JANELA_FORJA_MIN, faltaNoBlob, palavraConfere, type CodigoDeErro, type Desfecho } from './modelo'

export interface CtxDeResposta { siteId: string; actorId: string; ip: string | null; ua: string | null }
export interface Resposta { desfecho: Desfecho; codigo?: CodigoDeErro; faltam?: { miniaturas: number; pastas: number }; n?: number }
export interface DepsDoApagar {
  apagarDoBlob?: (pendentes: readonly string[], o: { prazoMs: number; agora?: () => number }) => Promise<ResultadoDoBlob>
  prazoMs?: number
  agora?: () => number
}

export const PRAZO_DO_BLOB_MS = 20_000
export const MAX_IDS_POR_CHAMADA = 500

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const ipValido = (ip: string | null): string | null => (ip !== null && isIP(ip) !== 0 ? ip : null)

/** Código do Postgres para o código do catálogo: o texto do banco nunca chega à tela. */
function codigoDoBanco(code: unknown, message?: unknown): CodigoDeErro {
  // M9: o gatilho do mês destacado recusa com P0001 e o texto `mes_destacado_em_transito` (pode vir com os meses depois)
  if (typeof message === 'string' && /^mes_destacado_em_transito\b/.test(message)) return 'mes_destacado_em_transito'
  if (typeof message === 'string' && /^sem_direito\b/.test(message)) return 'sem_direito'
  if (code === '57014') return 'tempo_esgotado'
  if (code === '40P01' || code === '55P03') return 'impasse' // 55P03: lock_timeout de 8 s do authenticator; espera passageira (forja/sincronização), não defeito
  if (code === '23503') return 'impedido_por_tabela'
  return 'erro_de_banco'
}

function relatar(etapa: string, codigo: CodigoDeErro, ids: Record<string, string | number>): void {
  Sentry.captureException(new Error(`observatorio-saiu: ${etapa}`), { tags: { component: 'observatorio-saiu', step: etapa }, extra: { codigo, ...ids } })
}

type Chamada = { ok: true; data: unknown } | { ok: false; codigo: CodigoDeErro }
async function chamar(rpc: () => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>, etapa: string, ids: Record<string, string | number>): Promise<Chamada> {
  try {
    const r = await rpc()
    if (r.error) {
      const codigo = codigoDoBanco(r.error.code, r.error.message)
      if (codigo !== 'mes_destacado_em_transito' && codigo !== 'sem_direito') relatar(etapa, codigo, ids) // recusa de regra: não é falha, não vai ao Sentry
      return { ok: false, codigo }
    }
    return { ok: true, data: r.data }
  } catch {
    relatar(etapa, 'erro_de_banco', ids)
    return { ok: false, codigo: 'erro_de_banco' }
  }
}

const erro = (codigo: CodigoDeErro, n?: number): Resposta => ({ desfecho: 'erro', codigo, ...(n !== undefined ? { n } : {}) })

/** O Blob depois do commit e a gravação do que foi confirmado. Nunca devolve `apagado` se sobrou algo ou se a gravação falhou. */
async function concluirBlob(
  sb: SupabaseClient, ctx: CtxDeResposta, itemId: number, pendentes: string[], deps: DepsDoApagar,
): Promise<Resposta> {
  const apagar = deps.apagarDoBlob ?? apagarDoBlobPadrao
  const b = await apagar(pendentes, { prazoMs: deps.prazoMs ?? PRAZO_DO_BLOB_MS, ...(deps.agora ? { agora: deps.agora } : {}) })
  let restam = b.restam
  let gravou = true
  let bancoRestam = 0
  if (b.feitos.length > 0) {
    const g = await chamar(() => sb.rpc('competitor_removed_blobs_done', { p_site: ctx.siteId, p_item: itemId, p_done: b.feitos }), 'blobs_done', { itemId })
    const d = g.ok ? g.data : null
    if (!g.ok || !ehObjeto(d) || d.status !== 'ok') {
      gravou = false
      restam = pendentes
    } else if (typeof d.restam === 'number' && d.restam > 0 && restam.length === 0) {
      gravou = false // o banco diz que sobrou o que o Blob jurou ter feito: não é "apagado"
      bancoRestam = d.restam
    }
  }
  if (restam.length === 0 && gravou) return { desfecho: 'apagado' }
  // o que falta: o que o Blob não fez; se o Blob jurou ter feito tudo e o banco diz que sobrou, a conta do banco (m-8 do portão 14/10)
  const naoFeitos = pendentes.filter(p => !b.feitos.includes(p))
  const faltam = restam.length > 0 ? faltaNoBlob(restam)
    : bancoRestam > 0 ? { miniaturas: bancoRestam, pastas: 0 }
      : faltaNoBlob(naoFeitos.length > 0 ? naoFeitos : pendentes)
  return { desfecho: 'apagando', faltam, ...(b.motivo === 'blob_nao_configurado' ? { codigo: 'blob_nao_configurado' as const } : {}) }
}

async function apagarUm(
  sb: SupabaseClient, ctx: CtxDeResposta, funcao: 'competitor_video_purge' | 'competitor_channel_purge', id: string, palavra: string, deps: DepsDoApagar,
): Promise<Resposta> {
  if (!palavraConfere(palavra)) return { desfecho: 'palavra_errada' }
  const comum = { p_site: ctx.siteId, p_actor: ctx.actorId, p_janela_min: JANELA_FORJA_MIN, p_ip: ipValido(ctx.ip), p_ua: ctx.ua }
  const c = await chamar(() => (funcao === 'competitor_video_purge'
    ? sb.rpc('competitor_video_purge', { ...comum, p_video: id })
    : sb.rpc('competitor_channel_purge', { ...comum, p_channel: id })), funcao, { id })
  if (!c.ok) return erro(c.codigo)
  const d = c.data
  if (!ehObjeto(d)) return erro('resposta_inesperada')
  switch (d.status) {
    case 'no_ar': case 'forja_em_andamento': case 'not_found': case 'mudou': return { desfecho: d.status }
    case 'apagado': {
      const item = typeof d.item_id === 'number' ? d.item_id : null
      const blobs = Array.isArray(d.blobs) ? d.blobs.filter((x): x is string => typeof x === 'string') : null
      if (item === null || blobs === null) return erro('resposta_inesperada')
      return concluirBlob(sb, ctx, item, blobs, deps)
    }
    default: return erro('resposta_inesperada')
  }
}

export const apagarVideo = (sb: SupabaseClient, ctx: CtxDeResposta, videoId: string, palavra: string, deps: DepsDoApagar = {}): Promise<Resposta> =>
  apagarUm(sb, ctx, 'competitor_video_purge', videoId, palavra, deps)

export const apagarCanal = (sb: SupabaseClient, ctx: CtxDeResposta, canalId: string, palavra: string, deps: DepsDoApagar = {}): Promise<Resposta> =>
  apagarUm(sb, ctx, 'competitor_channel_purge', canalId, palavra, deps)

export async function apagarComentarios(sb: SupabaseClient, ctx: CtxDeResposta, canalId: string, ids: number[], palavra: string): Promise<Resposta> {
  if (!palavraConfere(palavra)) return { desfecho: 'palavra_errada' }
  if (ids.length === 0) return { desfecho: 'nada' }
  if (ids.length > MAX_IDS_POR_CHAMADA) return erro('resposta_inesperada')
  const c = await chamar(() => sb.rpc('competitor_comments_purge', { p_site: ctx.siteId, p_channel: canalId, p_comment_ids: ids, p_actor: ctx.actorId, p_ip: ipValido(ctx.ip), p_ua: ctx.ua }), 'competitor_comments_purge', { canalId })
  if (!c.ok) return erro(c.codigo)
  const d = c.data
  if (!ehObjeto(d)) return erro('resposta_inesperada')
  if (d.status === 'apagado') return typeof d.comentarios === 'number' ? { desfecho: 'apagado', n: d.comentarios } : erro('resposta_inesperada')
  if (d.status === 'mudou' || d.status === 'not_found') return { desfecho: d.status }
  return erro('resposta_inesperada')
}

export async function manter(sb: SupabaseClient, ctx: CtxDeResposta, tipo: 'video' | 'canal' | 'comentario', ids: ReadonlyArray<string | number>): Promise<Resposta> {
  if (ids.length === 0) return { desfecho: 'nada' }
  if (ids.length > MAX_IDS_POR_CHAMADA) return erro('resposta_inesperada')
  const comentario = tipo === 'comentario'
  const c = await chamar(() => sb.rpc('competitor_missing_keep', {
    p_site: ctx.siteId, p_kind: tipo, p_ids: comentario ? null : ids, p_comment_ids: comentario ? ids : null, p_actor: ctx.actorId, p_ip: ipValido(ctx.ip), p_ua: ctx.ua,
  }), 'competitor_missing_keep', { tipo })
  if (!c.ok) return erro(c.codigo)
  const d = c.data
  if (!ehObjeto(d)) return erro('resposta_inesperada')
  if (d.status === 'mantido') return { desfecho: 'mantido', n: typeof d.mantidos === 'number' ? d.mantidos : undefined }
  if (d.status === 'nada') return { desfecho: 'nada', n: 0 }
  return erro('resposta_inesperada')
}

async function decidir(sb: SupabaseClient, ctx: CtxDeResposta, itemId: number, decisao: 'voltar' | 'ignorar'): Promise<Resposta> {
  const c = await chamar(() => sb.rpc('competitor_return_decide', { p_site: ctx.siteId, p_item: itemId, p_decision: decisao, p_actor: ctx.actorId, p_ip: ipValido(ctx.ip), p_ua: ctx.ua }), 'competitor_return_decide', { itemId })
  if (!c.ok) return erro(c.codigo)
  const d = c.data
  if (!ehObjeto(d)) return erro('resposta_inesperada')
  if (d.status === 'ok') return { desfecho: 'respondido', n: 1 }
  if (d.status === 'nada') return { desfecho: 'nada', n: 0 }
  return erro('resposta_inesperada')
}

export const decidirVolta = decidir

/** "Não perguntar de novo" do grupo de comentários que voltou. Sequencial e idempotente: se uma falhar, para e diz quantas passaram. */
export async function ignorarVoltaDoGrupo(sb: SupabaseClient, ctx: CtxDeResposta, itemIds: number[]): Promise<Resposta> {
  if (itemIds.length === 0) return { desfecho: 'nada', n: 0 }
  if (itemIds.length > MAX_IDS_POR_CHAMADA) return erro('resposta_inesperada', 0)
  let n = 0
  for (const id of itemIds) {
    const r = await decidir(sb, ctx, id, 'ignorar')
    if (r.desfecho === 'erro') return { ...r, n }
    if (r.desfecho === 'respondido') n += 1
  }
  return { desfecho: n > 0 ? 'respondido' : 'nada', n }
}

/** "Tentar de novo": lê o pendente da linha DO SITE, apaga e grava. */
export async function tentarDeNovo(sb: SupabaseClient, ctx: CtxDeResposta, itemId: number, deps: DepsDoApagar = {}): Promise<Resposta> {
  let pendentes: string[] | null = null
  try {
    const r = await sb.from('competitor_removed_items').select('id, blobs_pending').eq('site_id', ctx.siteId).eq('id', itemId).limit(1)
    if (r.error || !Array.isArray(r.data)) return erro('erro_de_banco')
    const linha: unknown = r.data[0]
    if (!ehObjeto(linha)) return { desfecho: 'not_found' }
    pendentes = Array.isArray(linha.blobs_pending) ? linha.blobs_pending.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return erro('erro_de_banco')
  }
  if (pendentes.length === 0) return { desfecho: 'apagado' }
  return concluirBlob(sb, ctx, itemId, pendentes, deps)
}

const ERRO_DE_LEITURA_PENDENTES = 'não foi possível ler os apagamentos pendentes'

/** Para o cron: no máximo 50 linhas do site com pendência, a mais antiga primeiro, enquanto houver prazo. */
export async function concluirApagamentos(
  sb: SupabaseClient, siteId: string, o: { prazoMs: number; deps?: DepsDoApagar },
): Promise<{ tentados: number; concluidos: number; erro?: string }> {
  const agora = o.deps?.agora ?? Date.now
  const fim = agora() + o.prazoMs
  let tentados = 0
  let concluidos = 0
  let rows: unknown[] = []
  try {
    const r = await sb.from('competitor_removed_items').select('id, blobs_pending').eq('site_id', siteId).not('blobs_pending', 'eq', '{}')
      .order('decided_at', { ascending: true }).order('id', { ascending: true }).limit(50)
    if (r.error || !Array.isArray(r.data)) {
      relatar('concluir_apagamentos_leitura', 'erro_de_banco', { siteId })
      return { tentados, concluidos, erro: ERRO_DE_LEITURA_PENDENTES }
    }
    rows = r.data
  } catch {
    relatar('concluir_apagamentos_leitura', 'erro_de_banco', { siteId })
    return { tentados, concluidos, erro: ERRO_DE_LEITURA_PENDENTES }
  }
  for (const linha of rows) {
    const restante = fim - agora()
    if (restante <= 0) break
    if (!ehObjeto(linha) || typeof linha.id !== 'number') continue
    const pendentes = Array.isArray(linha.blobs_pending) ? linha.blobs_pending.filter((x): x is string => typeof x === 'string') : []
    if (pendentes.length === 0) continue
    tentados += 1
    const r = await concluirBlob(sb, { siteId, actorId: '', ip: null, ua: null }, linha.id, pendentes, { ...o.deps, prazoMs: restante })
    if (r.desfecho === 'apagado') concluidos += 1
  }
  return { tentados, concluidos }
}

/** Os sites que têm pendência de Blob (de onde o cron tira a conclusão, sem depender de o site ainda ter canal). */
export async function sitesComApagamentoPendente(sb: SupabaseClient): Promise<string[] | { erro: string }> {
  try {
    const r = await sb.from('competitor_removed_items').select('site_id').not('blobs_pending', 'eq', '{}').order('decided_at', { ascending: true }).limit(1000)
    if (r.error || !Array.isArray(r.data)) return { erro: 'não foi possível ler os sites com apagamento pendente' }
    const sites: string[] = []
    for (const l of r.data as unknown[]) if (ehObjeto(l) && typeof l.site_id === 'string' && !sites.includes(l.site_id)) sites.push(l.site_id)
    return sites
  } catch {
    return { erro: 'não foi possível ler os sites com apagamento pendente' }
  }
}

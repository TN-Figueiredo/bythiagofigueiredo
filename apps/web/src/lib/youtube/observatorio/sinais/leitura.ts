// Leitura dos sinais do nicho (F2 T8): o ÚNICO leitor de `niche_signals`. Tela, rota, `get_signals` do Cowork e a ação `sugestoes`
// do Claude Code chamam `listarSinaisDoNicho`; nenhum lê a tabela nem a coluna `acao` direto (teste de importação).
// Lista vazia nunca é muda: `n = 0 ⇒ motivoVazio != null`. Sem escrita aqui, salvo `dispensarSinal` (RPC atômica).
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAll } from '../load'
import { HORAS_ATE_DESATUALIZAR } from './frases'
import { derivarAcao, type AcaoDerivada, type RotuloDaAcao } from './acao'
import type { Evidence, MotivoVazio } from './oportunidades'

export type MotivoDaLista = MotivoVazio | 'nunca-calculado' | 'tudo-respondido'

export interface ItemDeSinal {
  id: string
  kind: 'destino' | 'parecido'
  subject_key: string
  /** Derivada agora dos próprios (r6). */
  acao: AcaoDerivada
  rotulo_acao: RotuloDaAcao
  n_proprios: number | null
  /** A coluna, só para auditoria e para a F2b. */
  acao_gravada: string
  forca: number
  motivo: string
  rule_version: string
  evidence: Evidence
  first_seen_at: string
  expires_at: string
  /** ids de `youtube_videos` públicos e visíveis que cobrem o lugar HOJE (no máximo `TETO_PROPRIOS_AGORA`, por id); `null` = não medido (site sem `video_lugares` de origem `proprio`). */
  proprios_agora: string[] | null
  /** Total REAL de vídeos próprios que cobrem o lugar (a lista acima pode ser só os primeiros); `null` = não medido. */
  proprios_agora_n: number | null
}

export interface ListaDeSinais {
  /** Total de abertos e vigentes (não o tamanho da página). */
  n: number
  itens: ItemDeSinal[]
  computado_em: string | null
  desatualizado: boolean
  motivoVazio: MotivoDaLista | null
  contagens: Record<string, number>
  calculoLigado: boolean
}

export { HORAS_ATE_DESATUALIZAR }
const DIA_MS = 86_400_000
const JANELA_PRIVACIDADE_DIAS = 30
/** Teto de ids por item em `proprios_agora` (o total real vai em `proprios_agora_n`). */
export const TETO_PROPRIOS_AGORA = 20
/** Tamanho do bloco dos `.in(...)` que dependem de N (o URL do PostgREST tem limite). */
export const BLOCO_DO_IN = 200

function emBlocos<T>(xs: T[], tam: number): T[][] {
  const blocos: T[][] = []
  for (let i = 0; i < xs.length; i += tam) blocos.push(xs.slice(i, i + tam))
  return blocos
}

interface LinhaSinal {
  id: string; kind: 'destino' | 'parecido'; subject_key: string; acao: string; forca: number | string; motivo: string; rule_version: string
  evidence: Evidence; first_seen_at: string; expires_at: string
}
interface LinhaEstado { computed_at: string; motivo_vazio: MotivoVazio | null; contagens: Record<string, unknown> | null }

export const calculoLigadoNoAmbiente = (): boolean => process.env.OBS_SINAIS_NICHO === 'on'

class ErroDeLeitura extends Error {
  constructor(onde: string, readonly code?: string) { super(`sinais: leitura de ${onde} falhou`); this.name = 'ErroDeLeitura' }
}
const quebra = (onde: string, e: { code?: string } | null): void => { if (e) throw new ErroDeLeitura(onde, e.code) }

function soNumeros(o: Record<string, unknown> | null): Record<string, number> {
  const saida: Record<string, number> = {}
  for (const [k, v] of Object.entries(o ?? {})) if (typeof v === 'number' && Number.isFinite(v)) saida[k] = v
  return saida
}

/** Ids de vídeo próprio que contam: cadastrados, não ocultos e com o ÚLTIMO `privacy_status` igual a `public` (C0.11; sem linha = não conta). */
async function filtrarPublicos(sb: SupabaseClient, siteId: string, ids: string[], agora: Date): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const yt = new Map<string, string>() // youtube_video_id → id
  for (const bloco of emBlocos(ids, BLOCO_DO_IN)) {
    const v = await sb.from('youtube_videos').select('id, youtube_video_id').eq('site_id', siteId).eq('is_hidden', false).in('id', bloco)
    quebra('youtube_videos', v.error)
    for (const r of (v.data ?? []) as Array<{ id: string; youtube_video_id: string }>) yt.set(r.youtube_video_id, r.id)
  }
  if (yt.size === 0) return new Set()
  const desde = new Date(agora.getTime() - JANELA_PRIVACIDADE_DIAS * DIA_MS).toISOString().slice(0, 10)
  const ultimo = new Map<string, string | null>()
  for (const bloco of emBlocos([...yt.keys()], BLOCO_DO_IN)) {
    const metas = await readAll<{ youtube_video_id: string; privacy_status: string | null; day_pt: string }>('yt_own_video_meta_daily', () =>
      sb.from('yt_own_video_meta_daily').select('youtube_video_id, privacy_status, day_pt')
        .eq('site_id', siteId).in('youtube_video_id', bloco).not('privacy_status', 'is', null).gte('day_pt', desde)
        .order('day_pt', { ascending: false }).order('youtube_video_id'))
    for (const m of metas) if (!ultimo.has(m.youtube_video_id)) ultimo.set(m.youtube_video_id, m.privacy_status) // desc: a 1ª é a última
  }
  const publicos = new Set<string>()
  for (const [ytId, id] of yt) if (ultimo.get(ytId) === 'public') publicos.add(id)
  return publicos
}

/** `Map<subject_key, ids[]>` (null = o site não tem `video_lugares` de origem `proprio`: nunca calculou os vídeos dele; as linhas `competidor` não contam). Uma consulta para os lugares, mais uma de cadastro/privacidade. */
async function propriosPorChave(sb: SupabaseClient, siteId: string, chaves: string[], agora: Date): Promise<Map<string, string[]> | null> {
  const r = await sb.from('video_lugares').select('video_id, chaves').eq('site_id', siteId).eq('origem', 'proprio').overlaps('chaves', chaves)
  quebra('video_lugares', r.error)
  const linhas = (r.data ?? []) as Array<{ video_id: string; chaves: string[] }>
  if (linhas.length === 0) {
    const medido = await sb.from('video_lugares').select('video_id').eq('site_id', siteId).eq('origem', 'proprio').limit(1)
    quebra('video_lugares', medido.error)
    if (((medido.data ?? []) as unknown[]).length === 0) return null
    return new Map()
  }
  const publicos = await filtrarPublicos(sb, siteId, [...new Set(linhas.map((l) => l.video_id))], agora)
  const alvo = new Set(chaves)
  const mapa = new Map<string, string[]>()
  for (const l of linhas) {
    if (!publicos.has(l.video_id)) continue
    for (const c of l.chaves) {
      if (!alvo.has(c)) continue
      const lista = mapa.get(c) ?? []
      lista.push(l.video_id)
      mapa.set(c, lista)
    }
  }
  for (const lista of mapa.values()) lista.sort()
  return mapa
}

async function respondidosEm30d(sb: SupabaseClient, siteId: string, agora: Date): Promise<number> {
  const corte = new Date(agora.getTime() - 30 * DIA_MS).toISOString()
  const r = await sb.from('niche_signals').select('id', { count: 'exact', head: true }).eq('site_id', siteId)
    .in('status', ['dispensado', 'feito', 'expirado'])
    .or(`dispensado_em.gt.${corte},and(dispensado_em.is.null,expires_at.gt.${corte})`)
  quebra('niche_signals', r.error)
  return r.count ?? 0
}

export async function listarSinaisDoNicho(
  sb: SupabaseClient, siteId: string, agora: Date, limite = 50, calculoLigado: boolean = calculoLigadoNoAmbiente(),
): Promise<ListaDeSinais> {
  const [lista, est] = await Promise.all([
    sb.from('niche_signals')
      .select('id, kind, subject_key, acao, forca, motivo, rule_version, evidence, first_seen_at, expires_at', { count: 'exact' })
      .eq('site_id', siteId).eq('status', 'aberto').gt('expires_at', agora.toISOString())
      .order('forca', { ascending: false }).order('first_seen_at', { ascending: true }).order('id', { ascending: true })
      .limit(limite),
    sb.from('niche_signals_estado').select('computed_at, motivo_vazio, contagens').eq('site_id', siteId).maybeSingle(),
  ])
  quebra('niche_signals', lista.error)
  quebra('niche_signals_estado', est.error)
  const linhas = (lista.data ?? []) as unknown as LinhaSinal[]
  const estado = (est.data ?? null) as LinhaEstado | null
  const n = lista.count ?? linhas.length
  const computado_em = estado?.computed_at ?? null
  const desatualizado = computado_em === null || Date.parse(computado_em) < agora.getTime() - HORAS_ATE_DESATUALIZAR * 3_600_000
  const contagens = soNumeros(estado?.contagens ?? null)

  if (n === 0) {
    let motivoVazio: MotivoDaLista
    if (estado === null) motivoVazio = 'nunca-calculado'
    else {
      const respondidos = await respondidosEm30d(sb, siteId, agora)
      contagens.respondidos_30d = respondidos
      motivoVazio = estado.motivo_vazio ?? (respondidos > 0 ? 'tudo-respondido' : 'sem-grupo')
      // catch-all com o cálculo velho (gravador parado, linhas abertas já vencidas): a frase não pode dizer "nenhum grupo" como se fosse medido hoje
      if (motivoVazio === 'sem-grupo' && desatualizado) contagens.calculo_atrasado = 1
    }
    return { n: 0, itens: [], computado_em, desatualizado, motivoVazio, contagens, calculoLigado }
  }

  const proprios = await propriosPorChave(sb, siteId, [...new Set(linhas.map((l) => l.subject_key))], agora)
  const itens = linhas.map((l): ItemDeSinal => {
    const todos = proprios === null ? null : (proprios.get(l.subject_key) ?? [])
    const d = derivarAcao(l.kind, l.acao, todos === null ? null : todos.length)
    const agoraProprios = todos === null ? null : todos.slice(0, TETO_PROPRIOS_AGORA)
    return {
      id: l.id, kind: l.kind, subject_key: l.subject_key, acao: d.acao, rotulo_acao: d.rotulo, n_proprios: d.n, acao_gravada: l.acao,
      forca: Number(l.forca), motivo: l.motivo, rule_version: l.rule_version, evidence: l.evidence,
      first_seen_at: l.first_seen_at, expires_at: l.expires_at, proprios_agora: agoraProprios, proprios_agora_n: todos === null ? null : todos.length,
    }
  })
  return { n, itens, computado_em, desatualizado, motivoVazio: null, contagens, calculoLigado }
}

export type StatusDeResposta = 'dispensado' | 'feito'
export type MotivoDeDispensa = 'nao_e_parecido' | 'lugar_errado' | 'ja_fiz' | 'nao_interessa'

/** Chama `niche_signals_dispensar`. Id de outro site → `nao_encontrado` (a função filtra por `site_id`). */
export async function dispensarSinal(
  sb: SupabaseClient, siteId: string, id: string, status: StatusDeResposta, motivo: MotivoDeDispensa | null, por: string,
): Promise<{ ok: boolean; motivo?: string }> {
  const r = await sb.rpc('niche_signals_dispensar', { p_site: siteId, p_id: id, p_status: status, p_motivo: motivo, p_por: por })
  quebra('niche_signals_dispensar', r.error)
  const d = r.data as { ok?: boolean; motivo?: string } | null
  return d?.ok === true ? { ok: true } : { ok: false, motivo: d?.motivo ?? 'falhou' }
}

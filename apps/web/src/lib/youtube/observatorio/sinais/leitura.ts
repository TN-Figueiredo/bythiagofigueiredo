// Leitura dos sinais do nicho (F2 T8): o ÚNICO leitor de `niche_signals`. Tela, rota, `get_signals` do Cowork e a ação `sugestoes`
// do Claude Code chamam `listarSinaisDoNicho`; nenhum lê a tabela nem a coluna `acao` direto (teste de importação).
// Lista vazia nunca é muda: `n = 0 ⇒ motivoVazio != null`. Sem escrita aqui, salvo `dispensarSinal` (RPC atômica).
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAll } from '../load'
import { dayPt } from '../../coleta/day-pt'
import type { AcessoPrivado, LeituraPrivadaDoSite } from '../proprio/leitura-privada'
import { lerTrafegoDoTerceiro } from './trafego-terceiro/ler'
import type { TrafegoDoTerceiro } from './trafego-terceiro/regra'
import { DIAS_DO_ADIAR, HORAS_ATE_DESATUALIZAR } from './frases'
import { derivarAcao, type AcaoDerivada, type RotuloDaAcao } from './acao'
import type { Evidence, MotivoVazio } from './oportunidades'

/** `adiado` (F3b): n = 0 porque o que existe foi adiado por quem usa (e volta); a razão do cálculo vai em `motivoDoCalculo`. */
export type MotivoDaLista = MotivoVazio | 'nunca-calculado' | 'tudo-respondido' | 'adiado'

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
  /** F3b: quando foi adiada pela última vez (o `adiado_ate` já passou, voltou à lista); `null` = nunca adiada. */
  adiada_em: string | null
  /** ids de `youtube_videos` públicos e visíveis que cobrem o lugar HOJE (no máximo `TETO_PROPRIOS_AGORA`, por id); `null` = não medido (site sem `video_lugares` de origem `proprio`). */
  proprios_agora: string[] | null
  /** Total REAL de vídeos próprios que cobrem o lugar (a lista acima pode ser só os primeiros); `null` = não medido. */
  proprios_agora_n: number | null
  /** F4: o vídeo do terceiro que puxa o sinal já nos manda tráfego (origem "vídeos sugeridos")? Sem a prova de leitura, `nao_medido`. */
  trafego_do_terceiro: TrafegoDoTerceiro
}

export interface ListaDeSinais {
  /** Total de abertos e vigentes (não o tamanho da página). */
  n: number
  itens: ItemDeSinal[]
  computado_em: string | null
  desatualizado: boolean
  motivoVazio: MotivoDaLista | null
  /** F3b: com `motivoVazio === 'adiado'`, a razão do cálculo para a 2ª linha do vazio (P-C2); senão `null`. */
  motivoDoCalculo: MotivoDaLista | null
  /** F3b: quando volta a próxima adiada (só as que voltam antes de vencer); `null` = nenhuma ou não medido. */
  proximaVolta: string | null
  /** `adiados` (só os que voltam) existe só quando MEDIDO; chave ausente = "não medido", nunca 0. */
  contagens: Record<string, number>
  calculoLigado: boolean
  /** Só no `get_signals` do Cowork: a resposta foi cortada para caber no teto de texto. */
  aviso?: string
}

export { HORAS_ATE_DESATUALIZAR, DIAS_DO_ADIAR }
const DIA_MS = 86_400_000

/**
 * F3b: o filtro "não está adiado" de toda consulta de vigentes (`.or(naoAdiado(iso))`). Adiada = `adiado_ate` no futuro; passou, volta sozinha.
 * Fonte única: o teste-varredura exige este filtro em toda consulta de abertos de leitura.ts e avisos.ts.
 */
export const naoAdiado = (iso: string): string => `adiado_ate.is.null,adiado_ate.lte.${iso}`
const JANELA_PRIVACIDADE_DIAS = 30
/** Teto de ids por item em `proprios_agora` (o total real vai em `proprios_agora_n`). */
export const TETO_PROPRIOS_AGORA = 20
/** Tamanho do bloco dos `.in(...)` que dependem de N (o URL do PostgREST tem limite). */
export const BLOCO_DO_IN = 200
/** Teto de ids que o resumo do sino carrega (e que `contarAbertosEntre` aceita). */
export const LIMITE_PENDENTES = 500

function emBlocos<T>(xs: T[], tam: number): T[][] {
  const blocos: T[][] = []
  for (let i = 0; i < xs.length; i += tam) blocos.push(xs.slice(i, i + tam))
  return blocos
}

interface LinhaSinal {
  id: string; kind: 'destino' | 'parecido'; subject_key: string; acao: string; forca: number | string; motivo: string; rule_version: string
  evidence: Evidence; first_seen_at: string; expires_at: string; adiado_ate: string | null; adiado_em: string | null
}
interface LinhaEstado { computed_at: string; motivo_vazio: MotivoVazio | null; contagens: Record<string, unknown> | null }

/** Placeholder até a borda da F4 responder (a borda substitui todos; sem prova nada é lido). */
const SEM_LEITURA: TrafegoDoTerceiro = { estado: 'nao_medido', motivo: 'sem_direito', terceiro_video_id: null, videos_com_trafego: 0, videos_medidos: 0, videos_total: 0, views: null, ate: null, regra: 'f4-trafego-v1' }

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

interface Proprios {
  /** destino: `Map<subject_key, ids[]>` (null = o site não tem `video_lugares` de origem `proprio`). */
  porChave: Map<string, string[]> | null
  /** ids públicos e visíveis entre os de `video_lugares` e os `extras` (parecido). */
  publicos: Set<string>
}

/** Destino: `video_lugares` por `subject_key` (null = site sem `video_lugares` de origem `proprio`; as linhas `competidor` não contam). Parecido: os ids em `extras` (evidence.proprios). Uma só chamada a `filtrarPublicos` para a união. */
async function propriosPorChave(sb: SupabaseClient, siteId: string, chaves: string[], extras: string[], agora: Date): Promise<Proprios> {
  let linhas: Array<{ video_id: string; chaves: string[] }> = []
  let medido = true
  if (chaves.length > 0) {
    const r = await sb.from('video_lugares').select('video_id, chaves').eq('site_id', siteId).eq('origem', 'proprio').overlaps('chaves', chaves)
    quebra('video_lugares', r.error)
    linhas = (r.data ?? []) as Array<{ video_id: string; chaves: string[] }>
    if (linhas.length === 0) {
      const sonda = await sb.from('video_lugares').select('video_id').eq('site_id', siteId).eq('origem', 'proprio').limit(1)
      quebra('video_lugares', sonda.error)
      medido = ((sonda.data ?? []) as unknown[]).length > 0
    }
  }
  const publicos = await filtrarPublicos(sb, siteId, [...new Set([...linhas.map((l) => l.video_id), ...extras])], agora)
  if (!medido) return { porChave: null, publicos }
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
  return { porChave: mapa, publicos }
}

/** Adiadas por quem usa que VOLTAM (voltam antes de vencer): `null` = não medido (erro de leitura; nunca vira 0). */
async function adiadosQueVoltam(sb: SupabaseClient, siteId: string, agora: Date): Promise<{ n: number; proxima: string | null } | null> {
  const iso = agora.toISOString()
  const r = await sb.from('niche_signals').select('adiado_ate, expires_at', { count: 'exact' })
    .eq('site_id', siteId).eq('status', 'aberto').gt('expires_at', iso).gt('adiado_ate', iso)
    .order('adiado_ate', { ascending: true }).limit(LIMITE_PENDENTES)
  if (r.error) {
    // não medido na tela, mas nunca em silêncio: sem isto a aba fica em "?" para sempre sem alarme (Yannis I1)
    Sentry.captureMessage('sinais: contagem das adiadas falhou', { level: 'warning', tags: { area: 'sinais-nicho' }, extra: { code: r.error.code } })
    return null
  }
  const linhas = (r.data ?? []) as Array<{ adiado_ate: string; expires_at: string }>
  const voltam = linhas.filter((x) => Date.parse(x.adiado_ate) < Date.parse(x.expires_at))
  // Phil M-3: a página para em LIMITE_PENDENTES; o resto vem do `count` exato e o corte é avisado, não calado.
  const alemDaPagina = typeof r.count === 'number' ? Math.max(0, r.count - linhas.length) : 0
  if (alemDaPagina > 0) Sentry.captureMessage('sinais: adiadas além do teto da página', { level: 'warning', tags: { area: 'sinais-nicho' }, extra: { total: r.count, teto: LIMITE_PENDENTES } })
  return { n: voltam.length + alemDaPagina, proxima: voltam[0]?.adiado_ate ?? null }
}

async function respondidosEm30d(sb: SupabaseClient, siteId: string, agora: Date): Promise<number> {
  const corte = new Date(agora.getTime() - 30 * DIA_MS).toISOString()
  const r = await sb.from('niche_signals').select('id', { count: 'exact', head: true }).eq('site_id', siteId)
    .in('status', ['dispensado', 'feito', 'expirado'])
    .or(`dispensado_em.gt.${corte},and(dispensado_em.is.null,expires_at.gt.${corte})`)
  quebra('niche_signals', r.error)
  return r.count ?? 0
}

/** Quando foi adiada pela última vez: a coluna `adiado_em` (gravada por `niche_signals_adiar`); `null` = nunca adiada. */
const adiadaEm = (adiadoEm: string | null): string | null =>
  adiadoEm === null || Number.isNaN(Date.parse(adiadoEm)) ? null : new Date(Date.parse(adiadoEm)).toISOString()

export async function listarSinaisDoNicho(
  sb: SupabaseClient, siteId: string, agora: Date, limite = 50, calculoLigado: boolean = calculoLigadoNoAmbiente(),
  /** F4 (6º parâmetro, obrigatório no tipo): a prova de leitura do dado privado; `null`/ausente em execução = `sem_direito`, zero consultas. */
  leitura: AcessoPrivado | LeituraPrivadaDoSite | null,
): Promise<ListaDeSinais> {
  const [lista, est, adiados] = await Promise.all([
    sb.from('niche_signals')
      .select('id, kind, subject_key, acao, forca, motivo, rule_version, evidence, first_seen_at, expires_at, adiado_ate, adiado_em', { count: 'exact' })
      .eq('site_id', siteId).eq('status', 'aberto').gt('expires_at', agora.toISOString()).or(naoAdiado(agora.toISOString()))
      .order('forca', { ascending: false }).order('first_seen_at', { ascending: true }).order('id', { ascending: true })
      .limit(limite)
      .returns<LinhaSinal[]>(),
    sb.from('niche_signals_estado').select('computed_at, motivo_vazio, contagens').eq('site_id', siteId).maybeSingle(),
    adiadosQueVoltam(sb, siteId, agora),
  ])
  quebra('niche_signals', lista.error)
  quebra('niche_signals_estado', est.error)
  const linhas = lista.data ?? []
  const estado = (est.data ?? null) as LinhaEstado | null
  const n = lista.count ?? linhas.length
  const computado_em = estado?.computed_at ?? null
  const desatualizado = computado_em === null || Date.parse(computado_em) < agora.getTime() - HORAS_ATE_DESATUALIZAR * 3_600_000
  const contagens = soNumeros(estado?.contagens ?? null)
  delete contagens.adiados // nunca herdado do estado do cálculo: só a medida de agora vale
  if (adiados !== null) contagens.adiados = adiados.n
  const proximaVolta = adiados?.proxima ?? null

  if (n === 0) {
    let motivoVazio: MotivoDaLista
    let motivoDoCalculo: MotivoDaLista | null = null
    if (estado === null) motivoVazio = 'nunca-calculado'
    else {
      const respondidos = await respondidosEm30d(sb, siteId, agora)
      contagens.respondidos_30d = respondidos
      motivoVazio = estado.motivo_vazio ?? (respondidos > 0 ? 'tudo-respondido' : 'sem-grupo')
      // catch-all com o cálculo velho (gravador parado, linhas abertas já vencidas): a frase não pode dizer "nenhum grupo" como se fosse medido hoje
      if (motivoVazio === 'sem-grupo' && desatualizado) contagens.calculo_atrasado = 1
      // P-C2: o que o dono adiou explica a lista vazia melhor que o cálculo; sem a medida (null), a frase diz "não medido".
      if (adiados === null || adiados.n > 0) { motivoDoCalculo = motivoVazio; motivoVazio = 'adiado' }
    }
    return { n: 0, itens: [], computado_em, desatualizado, motivoVazio, motivoDoCalculo, proximaVolta, contagens, calculoLigado }
  }

  const idsDoParecido = (l: LinhaSinal): string[] => (Array.isArray(l.evidence?.proprios) ? l.evidence.proprios : [])
  const proprios = await propriosPorChave(
    sb, siteId,
    [...new Set(linhas.filter((l) => l.kind === 'destino').map((l) => l.subject_key))],
    [...new Set(linhas.filter((l) => l.kind === 'parecido').flatMap(idsDoParecido))],
    agora,
  )
  const itens = linhas.map((l): ItemDeSinal => {
    const todos = l.kind === 'parecido'
      ? [...new Set(idsDoParecido(l))].filter((id) => proprios.publicos.has(id)).sort()
      : proprios.porChave === null ? null : (proprios.porChave.get(l.subject_key) ?? [])
    const d = derivarAcao(l.kind, l.acao, todos === null ? null : todos.length)
    const agoraProprios = todos === null ? null : todos.slice(0, TETO_PROPRIOS_AGORA)
    return {
      id: l.id, kind: l.kind, subject_key: l.subject_key, acao: d.acao, rotulo_acao: d.rotulo, n_proprios: d.n, acao_gravada: l.acao,
      forca: Number(l.forca), motivo: l.motivo, rule_version: l.rule_version, evidence: l.evidence,
      first_seen_at: l.first_seen_at, expires_at: l.expires_at, adiada_em: adiadaEm(l.adiado_em), proprios_agora: agoraProprios, proprios_agora_n: todos === null ? null : todos.length,
      trafego_do_terceiro: SEM_LEITURA,
    }
  })
  // F4: o tráfego do vídeo do terceiro (nunca derruba a lista: a borda captura toda exceção como `erro_de_leitura`)
  const trafego = await lerTrafegoDoTerceiro(sb, siteId, leitura, itens, dayPt(agora))
  for (const it of itens) it.trafego_do_terceiro = trafego.porItem.get(it.id) ?? it.trafego_do_terceiro
  if (trafego.codigo32 !== null) contagens.f4_codigo_32 = trafego.codigo32
  return { n, itens, computado_em, desatualizado, motivoVazio: null, motivoDoCalculo: null, proximaVolta, contagens, calculoLigado }
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

export type ResultadoDoAdiar =
  | { ok: true; adiado_ate: string }
  | { ok: false; motivo: string; adiado_ate?: string; expira_em?: string }

/** Chama `niche_signals_adiar` (F3b). Motivos da função: nao_encontrado, nao_aberto (inclui vencida), ja_adiado (com `adiado_ate`), expira_antes (com `expira_em`). */
export async function adiarSinal(sb: SupabaseClient, siteId: string, id: string, por: string): Promise<ResultadoDoAdiar> {
  const r = await sb.rpc('niche_signals_adiar', { p_site: siteId, p_id: id, p_por: por })
  quebra('niche_signals_adiar', r.error)
  const d = r.data as { ok?: boolean; motivo?: string; adiado_ate?: string; expira_em?: string } | null
  if (d?.ok === true && typeof d.adiado_ate === 'string') return { ok: true, adiado_ate: d.adiado_ate }
  return { ok: false, motivo: d?.motivo ?? 'falhou', ...(d?.adiado_ate ? { adiado_ate: d.adiado_ate } : {}), ...(d?.expira_em ? { expira_em: d.expira_em } : {}) }
}

/** N da aba: abertos e vigentes. `count` nulo sem erro → `null` ("?" na tela, nunca 0); erro do banco lança. */
export async function contarSinaisAbertos(sb: SupabaseClient, siteId: string, agora: Date): Promise<number | null> {
  const r = await sb.from('niche_signals').select('id', { count: 'exact', head: true })
    .eq('site_id', siteId).eq('status', 'aberto').gt('expires_at', agora.toISOString()).or(naoAdiado(agora.toISOString()))
  quebra('niche_signals', r.error)
  return typeof r.count === 'number' ? r.count : null
}

/** Quantos dos `ids` (do resumo do sino) ainda estão abertos e vigentes NESTE site. Mais de `LIMITE_PENDENTES` ids únicos → `null` (não medido). */
export async function contarAbertosEntre(sb: SupabaseClient, siteId: string, ids: string[], agora: Date): Promise<number | null> {
  const unicos = [...new Set(ids)]
  if (unicos.length > LIMITE_PENDENTES) return null
  let total = 0
  for (const bloco of emBlocos(unicos, BLOCO_DO_IN)) {
    const r = await sb.from('niche_signals').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId).eq('status', 'aberto').gt('expires_at', agora.toISOString()).or(naoAdiado(agora.toISOString())).in('id', bloco)
    quebra('niche_signals', r.error)
    if (typeof r.count !== 'number') return null
    total += r.count
  }
  return total
}

/** Estado do cálculo para a aba: `calculado` = há linha em `niche_signals_estado`; `velho` = mais de `HORAS_ATE_DESATUALIZAR` h. `null` = erro de leitura. */
export async function lerEstadoDaAba(sb: SupabaseClient, siteId: string, agora: Date): Promise<{ calculado: boolean; velho: boolean; computado_em: string | null } | null> {
  const r = await sb.from('niche_signals_estado').select('computed_at').eq('site_id', siteId).maybeSingle()
  if (r.error) return null
  const computado_em = (r.data as { computed_at?: string } | null)?.computed_at ?? null
  if (computado_em === null) return { calculado: false, velho: false, computado_em: null }
  return { calculado: true, velho: Date.parse(computado_em) < agora.getTime() - HORAS_ATE_DESATUALIZAR * 3_600_000, computado_em }
}

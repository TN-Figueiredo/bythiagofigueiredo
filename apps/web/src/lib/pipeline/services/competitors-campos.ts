import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json } from '@/lib/youtube/competitor-capture'

// A5 · E7, Tarefa 4: as mudanças de campo (`changes?campos=todos`), lidas de competitor_field_versions.
// Lista fechada do que sai (a descrição do canal nunca sai), valor anterior por item, e a diferença entre "nenhuma mudança"
// (`lido`, com até quando a lista vale) e "não lemos" (`nao_lido`). Falha de consulta nunca vira lista. Roda com o cliente de
// serviço (ignora RLS): TODA consulta filtra por site, direto (`site_id`) ou pelos canais do site.
// Ordem das consultas: (1) primeira leitura do site, (5) canais, (7) ponta dos vídeos, (2) página, (6) vídeos da página,
// (3) valores anteriores dos vídeos, (4) valores anteriores dos canais.

export const CAMPOS_DE_VIDEO_QUE_SAEM = ['tags', 'category_id', 'duration_seconds', 'default_language', 'default_audio_language', 'live_broadcast_content', 'comments_disabled', 'likes_hidden', 'views_hidden', 'availability'] as const
export const CAMPOS_DE_CANAL_QUE_SAEM = ['name', 'custom_url', 'country', 'avatar_url', 'subscribers_hidden', 'availability'] as const
export const CAMPOS_DE_CANAL_QUE_NUNCA_SAEM = ['description'] as const
export const CAMPOS_DE_VIDEO_QUE_NUNCA_SAEM = [] as const

export type ValorAnterior =
  | { estado: 'lido'; valor: Json }
  | { estado: 'nao_lido'; motivo: 'sem_versao_anterior' | 'erro_do_banco' | 'cortado' }

export interface MudancaDeCampo {
  id: number
  alvo: 'video' | 'canal'
  channel_name: string
  video_id: string | null
  video_title: string | null
  campo: string
  valor_novo: Json
  valor_anterior: ValorAnterior
  visto_em: string
  janela_desde: string | null
  precisao: '6h' | '1d' | '7d' | 'gap'
}

/** A ponta final da cobertura: até quando a lista vale. `mais_*` valem para os campos do CANAL; `videos_*` para os de VÍDEO. */
export interface LidoAte {
  mais_antigo: string | null
  mais_recente: string | null
  canais_sem_leitura: number
  videos_mais_antigo: string | null
  videos_mais_recente: string | null
}

export type MotivoDeCampo = 'coleta_ainda_nao_comecou' | 'tabela_ausente' | 'erro_do_banco' | 'cortado'

export type MudancasDeCampo =
  | {
      estado: 'lido'; itens: MudancaDeCampo[]; count: number; limite: number; cortado: boolean; coleta_desde: string; lido_ate: LidoAte
      fora_da_lista: number; video_de_outro_site: number; video_ausente: number
    }
  | { estado: 'nao_lido'; motivo: MotivoDeCampo; frase: string }

export const FRASES_DE_CAMPO: Record<MotivoDeCampo, string> = {
  coleta_ainda_nao_comecou: 'o histórico de campos deste site ainda não tem nenhuma leitura',
  tabela_ausente: 'o histórico de campos não existe neste banco; as mudanças de campo não foram lidas',
  erro_do_banco: 'a leitura das mudanças de campo falhou nesta consulta; a lista não é conhecida',
  cortado: 'a leitura das mudanças de campo foi cortada pelo limite de páginas; a lista não é conhecida',
}

export const LEITURA_MS = 5_000
export const TAMANHO_DA_PAGINA = 1_000
export const MAX_PAGINAS = 10
export const TAMANHO_DO_BLOCO = 150

type Linha = Record<string, unknown>
type Resposta = { data: unknown; error: { code?: string; message?: string } | null }
type Falha = 'tabela_ausente' | 'erro_do_banco' | 'cortado'
type Lida<T> = { ok: true; valor: T } | { ok: false; motivo: Falha }

const TABELA_AUSENTE = new Set(['42P01', 'PGRST205'])
const sinal = () => AbortSignal.timeout(LEITURA_MS)
const texto = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const precisaoDe = (v: unknown): MudancaDeCampo['precisao'] | null => (v === '6h' || v === '1d' || v === '7d' || v === 'gap' ? v : null)

/** Executa uma consulta. Nunca lança; nenhuma mensagem do banco sai daqui (ao Sentry vai só o SQLSTATE). */
async function executar(tabela: string, consulta: () => PromiseLike<Resposta>): Promise<Lida<Linha[]>> {
  let r: Resposta
  try {
    r = await consulta()
  } catch (e) {
    Sentry.captureMessage('e7.leitura_falhou', { extra: { leitor: 'campos', tabela, classe: e instanceof Error ? e.name : 'desconhecida' } })
    return { ok: false, motivo: 'erro_do_banco' }
  }
  if (r.error) {
    const codigo = r.error.code ?? 'sem_codigo'
    Sentry.captureMessage('e7.leitura_falhou', { extra: { leitor: 'campos', tabela, sqlstate: codigo } })
    return { ok: false, motivo: TABELA_AUSENTE.has(codigo) ? 'tabela_ausente' : 'erro_do_banco' }
  }
  if (!Array.isArray(r.data)) {
    Sentry.captureMessage('e7.leitura_falhou', { extra: { leitor: 'campos', tabela, sqlstate: 'resposta_nula' } })
    return { ok: false, motivo: 'erro_do_banco' }
  }
  return { ok: true, valor: r.data.filter((x): x is Linha => typeof x === 'object' && x !== null) }
}

/**
 * Lê em páginas de 1.000, ordenadas por `id`, até uma página incompleta. Exatamente 1.000 linhas e uma página vazia é leitura
 * completa; `cortado` é só o teto de páginas atingido com a última cheia.
 */
async function emPaginas(tabela: string, pedir: (de: number, ate: number) => PromiseLike<Resposta>): Promise<Lida<Linha[]>> {
  const todas: Linha[] = []
  for (let p = 0; p < MAX_PAGINAS; p++) {
    const r = await executar(tabela, () => pedir(p * TAMANHO_DA_PAGINA, p * TAMANHO_DA_PAGINA + TAMANHO_DA_PAGINA - 1))
    if (!r.ok) return r
    todas.push(...r.valor)
    if (r.valor.length < TAMANHO_DA_PAGINA) return { ok: true, valor: todas }
  }
  return { ok: false, motivo: 'cortado' }
}

function blocos<T>(lista: readonly T[], tamanho: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < lista.length; i += tamanho) out.push(lista.slice(i, i + tamanho))
  return out
}

const TS = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)$/

/**
 * Instante com microssegundos, para comparar `first_seen_at` sem perder dígito (o Postgres corta zeros à direita:
 * "…18.45+00" e "…18.450+00" são o mesmo instante, e comparar texto erraria). Texto que não é timestamp: NaN.
 */
function instante(s: string): number {
  const m = TS.exec(s)
  if (!m) return Number.NaN
  const zona = m[4] === 'Z' ? 'Z' : m[4]!.length === 3 ? m[4] + ':00' : m[4]!.length === 5 ? m[4]!.slice(0, 3) + ':' + m[4]!.slice(3) : m[4]!
  const ms = Date.parse(m[1] + 'T' + m[2] + '.000' + zona)
  const frac = (m[3] ?? '').padEnd(6, '0').slice(0, 6)
  return ms + Number(frac) / 1_000_000
}

const maisRecente = (a: string | null, b: string | null): string | null => (a === null ? b : b === null ? a : instante(b) > instante(a) ? b : a)
const maisAntigo = (a: string | null, b: string | null): string | null => (a === null ? b : b === null ? a : instante(b) < instante(a) ? b : a)

/** Valor de jsonb lido do banco: já é JSON; o que não for (não deve acontecer) vira nulo. */
function comoJson(v: unknown): Json {
  if (v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) return v
  if (Array.isArray(v)) return v.map(comoJson)
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, comoJson(x)]))
  return null
}

function naoLido(motivo: MotivoDeCampo): MudancasDeCampo {
  return { estado: 'nao_lido', motivo, frase: FRASES_DE_CAMPO[motivo] }
}

interface Previa { id: number; chave: string; instante: number; valor: Json }

/**
 * Lê as versões anteriores de uma lista de alvos (vídeo ou canal) e devolve, por chave, as linhas (id, instante, valor).
 * `escopo` monta a consulta de um bloco; todas levam o site.
 */
async function lerVersoes(
  sb: SupabaseClient, siteId: string, alvo: 'video' | 'canal', ids: readonly string[], campos: readonly string[], tamanho: number,
): Promise<Lida<Previa[]>> {
  const out: Previa[] = []
  for (const bloco of blocos(ids, tamanho)) {
    const r = await emPaginas('competitor_field_versions', (de, ate) => {
      const base = sb.from('competitor_field_versions').select('id, video_id, competitor_channel_id, field, value, first_seen_at').eq('site_id', siteId)
      const filtrado = alvo === 'video'
        ? base.in('video_id', bloco).in('field', [...campos])
        : base.is('video_id', null).in('competitor_channel_id', bloco).in('field', [...campos])
      return filtrado.order('id').range(de, ate).abortSignal(sinal())
    })
    if (!r.ok) return r
    for (const l of r.valor) {
      const dono = texto(alvo === 'video' ? l['video_id'] : l['competitor_channel_id']), campo = texto(l['field']), quando = texto(l['first_seen_at']), id = numero(l['id'])
      if (!dono || !campo || !quando || id === null) continue
      out.push({ id, chave: dono + '|' + campo, instante: instante(quando), valor: comoJson(l['value']) })
    }
  }
  return { ok: true, valor: out }
}

/**
 * As mudanças de campo do site. Nunca lança. `o.limite` corta a lista (cada lista, o seu corte); `o.bloco` existe para o
 * teste forçar o tamanho do bloco de `in()`.
 */
export async function listarMudancasDeCampo(sb: SupabaseClient, siteId: string, o: { limite: number; bloco?: number }): Promise<MudancasDeCampo> {
  try {
    return await listar(sb, siteId, o)
  } catch (e) {
    Sentry.captureMessage('e7.leitura_falhou', { extra: { leitor: 'campos', classe: e instanceof Error ? e.name : 'desconhecida', etapa: 'defeito' } })
    return naoLido('erro_do_banco')
  }
}

async function listar(sb: SupabaseClient, siteId: string, o: { limite: number; bloco?: number }): Promise<MudancasDeCampo> {
  const limite = o.limite, tamanho = o.bloco ?? TAMANHO_DO_BLOCO

  // (1) a primeira leitura do site: zero linhas é "a coleta não começou"; resposta nula é erro, nunca zero
  const primeira = await executar('competitor_field_versions', () =>
    sb.from('competitor_field_versions').select('first_seen_at').eq('site_id', siteId).order('first_seen_at').limit(1).abortSignal(sinal()))
  if (!primeira.ok) return naoLido(primeira.motivo)
  if (primeira.valor.length === 0) return naoLido('coleta_ainda_nao_comecou')
  const coletaDesde = texto(primeira.valor[0]!['first_seen_at'])
  if (!coletaDesde) return naoLido('erro_do_banco')

  // (5) os canais do site (nome e última leitura boa); daqui sai a ponta dos canais
  const canais = await emPaginas('competitor_channels', (de, ate) =>
    sb.from('competitor_channels').select('id, channel_name, last_seen_at').eq('site_id', siteId).order('id').range(de, ate).abortSignal(sinal()))
  if (!canais.ok) return naoLido(canais.motivo)
  const nomeDoCanal = new Map<string, string>()
  const lidoAte: LidoAte = { mais_antigo: null, mais_recente: null, canais_sem_leitura: 0, videos_mais_antigo: null, videos_mais_recente: null }
  for (const c of canais.valor) {
    const id = texto(c['id'])
    if (!id) continue
    nomeDoCanal.set(id, texto(c['channel_name']) ?? '')
    const visto = texto(c['last_seen_at'])
    if (visto === null) lidoAte.canais_sem_leitura++
    else { lidoAte.mais_antigo = maisAntigo(lidoAte.mais_antigo, visto); lidoAte.mais_recente = maisRecente(lidoAte.mais_recente, visto) }
  }
  const idsDosCanais = [...nomeDoCanal.keys()]

  // sem canal não há o que ler: lista vazia e pontas nulas (no banco a cascata impede; o caso prova que a função não lança)
  if (idsDosCanais.length === 0) {
    return { estado: 'lido', itens: [], count: 0, limite, cortado: false, coleta_desde: coletaDesde, lido_ate: lidoAte, fora_da_lista: 0, video_de_outro_site: 0, video_ausente: 0 }
  }

  // (7) a ponta dos vídeos: a maior e a menor última leitura entre os vídeos dos canais do site (competitor_videos não tem site_id)
  for (const blocoDeCanais of blocos(idsDosCanais, tamanho)) {
    for (const recente of [true, false]) {
      const r = await executar('competitor_videos', () =>
        sb.from('competitor_videos').select('last_seen_at').in('competitor_channel_id', blocoDeCanais).is('missing_since', null)
          .order('last_seen_at', { ascending: !recente, nullsFirst: false }).limit(1).abortSignal(sinal()))
      if (!r.ok) return naoLido(r.motivo)
      const v = r.valor.length > 0 ? texto(r.valor[0]!['last_seen_at']) : null
      if (v === null) continue // nenhum vídeo com leitura neste bloco
      if (recente) lidoAte.videos_mais_recente = maisRecente(lidoAte.videos_mais_recente, v)
      else lidoAte.videos_mais_antigo = maisAntigo(lidoAte.videos_mais_antigo, v)
    }
  }

  // (2) a página: as mudanças mais recentes dos campos que saem, nos canais do site, fora a primeira leitura
  const camposQueSaem = [...CAMPOS_DE_VIDEO_QUE_SAEM, ...CAMPOS_DE_CANAL_QUE_SAEM]
  const candidatas: Linha[] = []
  for (const blocoDaPagina of blocos(idsDosCanais, tamanho)) {
    const r = await executar('competitor_field_versions', () =>
      sb.from('competitor_field_versions').select('id, competitor_channel_id, video_id, field, value, first_seen_at, window_start, precision')
        .eq('site_id', siteId).in('competitor_channel_id', blocoDaPagina).in('field', camposQueSaem).neq('precision', 'first')
        .order('first_seen_at', { ascending: false }).order('id', { ascending: false }).limit(limite + 1).abortSignal(sinal()))
    if (!r.ok) return naoLido(r.motivo)
    candidatas.push(...r.valor)
  }
  candidatas.sort((a, b) => {
    const d = instante(texto(b['first_seen_at']) ?? '') - instante(texto(a['first_seen_at']) ?? '')
    return d !== 0 && !Number.isNaN(d) ? d : (numero(b['id']) ?? 0) - (numero(a['id']) ?? 0)
  })
  const cortado = candidatas.length > limite
  const pagina = cortado ? candidatas.slice(0, limite) : candidatas

  // cada linha é conferida de novo contra a lista do alvo dela
  let foraDaLista = 0
  const doCanal: Linha[] = [], doVideo: Linha[] = []
  for (const l of pagina) {
    const campo = texto(l['field']) ?? ''
    if (l['video_id'] === null || l['video_id'] === undefined) {
      if ((CAMPOS_DE_CANAL_QUE_SAEM as readonly string[]).includes(campo)) doCanal.push(l); else foraDaLista++
    } else if ((CAMPOS_DE_VIDEO_QUE_SAEM as readonly string[]).includes(campo)) doVideo.push(l)
    else foraDaLista++
  }

  // (6) os vídeos da página: título, id do YouTube e canal; vídeo de canal que não é do site é descartado
  const idsDeVideo = [...new Set(doVideo.map(l => texto(l['video_id'])).filter((x): x is string => x !== null))]
  const videos = new Map<string, { youtube: string; titulo: string | null; canal: string | null }>()
  for (const blocoDeVideos of blocos(idsDeVideo, tamanho)) {
    const r = await executar('competitor_videos', () =>
      sb.from('competitor_videos').select('id, video_id, title, competitor_channel_id').in('id', blocoDeVideos).abortSignal(sinal()))
    if (!r.ok) return naoLido(r.motivo)
    for (const v of r.valor) {
      const id = texto(v['id'])
      if (id) videos.set(id, { youtube: texto(v['video_id']) ?? '', titulo: texto(v['title']), canal: texto(v['competitor_channel_id']) })
    }
  }
  let deOutroSite = 0, ausentes = 0
  const videoValidos: Linha[] = []
  for (const l of doVideo) {
    const v = videos.get(texto(l['video_id']) ?? '')
    if (!v) ausentes++
    else if (!v.canal || !nomeDoCanal.has(v.canal)) deOutroSite++
    else videoValidos.push(l)
  }
  if (deOutroSite > 0) Sentry.captureMessage('e7.video_de_outro_site', { extra: { contagem: deOutroSite } })

  // (3) e (4) os valores anteriores: falha aqui degrada por item, nunca derruba a lista
  const idsVideoValidos = [...new Set(videoValidos.map(l => String(l['video_id'])))]
  const idsCanalValidos = [...new Set(doCanal.map(l => String(l['competitor_channel_id'])))].filter(id => nomeDoCanal.has(id))
  const anterioresDeVideo = idsVideoValidos.length > 0 ? await lerVersoes(sb, siteId, 'video', idsVideoValidos, CAMPOS_DE_VIDEO_QUE_SAEM, tamanho) : { ok: true as const, valor: [] as Previa[] }
  const anterioresDeCanal = idsCanalValidos.length > 0 ? await lerVersoes(sb, siteId, 'canal', idsCanalValidos, CAMPOS_DE_CANAL_QUE_SAEM, tamanho) : { ok: true as const, valor: [] as Previa[] }

  const anterior = (lida: Lida<Previa[]>, chave: string, id: number, quando: number): ValorAnterior => {
    if (!lida.ok) return { estado: 'nao_lido', motivo: lida.motivo === 'cortado' ? 'cortado' : 'erro_do_banco' }
    let melhor: Previa | null = null
    for (const p of lida.valor) {
      if (p.chave !== chave || p.id === id || !(p.instante < quando)) continue
      if (!melhor || p.instante > melhor.instante || (p.instante === melhor.instante && p.id > melhor.id)) melhor = p
    }
    return melhor ? { estado: 'lido', valor: melhor.valor } : { estado: 'nao_lido', motivo: 'sem_versao_anterior' }
  }

  const itens: MudancaDeCampo[] = []
  for (const l of pagina) {
    const id = numero(l['id']), campo = texto(l['field']), visto = texto(l['first_seen_at']), precisao = precisaoDe(l['precision'])
    if (id === null || !campo || !visto || !precisao) continue
    const comum = { id, campo, valor_novo: comoJson(l['value']), visto_em: visto, janela_desde: texto(l['window_start']), precisao }
    if (l['video_id'] === null || l['video_id'] === undefined) {
      if (!doCanal.includes(l)) continue
      const canal = String(l['competitor_channel_id'])
      if (!nomeDoCanal.has(canal)) continue
      itens.push({ ...comum, alvo: 'canal', channel_name: nomeDoCanal.get(canal) ?? '', video_id: null, video_title: null, valor_anterior: anterior(anterioresDeCanal, canal + '|' + campo, id, instante(visto)) })
    } else {
      if (!videoValidos.includes(l)) continue
      const v = videos.get(String(l['video_id']))!
      itens.push({ ...comum, alvo: 'video', channel_name: nomeDoCanal.get(v.canal ?? '') ?? '', video_id: v.youtube, video_title: v.titulo, valor_anterior: anterior(anterioresDeVideo, String(l['video_id']) + '|' + campo, id, instante(visto)) })
    }
  }

  return {
    estado: 'lido', itens, count: itens.length, limite, cortado, coleta_desde: coletaDesde, lido_ate: lidoAte,
    fora_da_lista: foraDaLista, video_de_outro_site: deOutroSite, video_ausente: ausentes,
  }
}

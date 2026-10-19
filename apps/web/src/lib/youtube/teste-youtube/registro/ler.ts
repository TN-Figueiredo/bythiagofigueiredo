import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isRec } from '@/lib/youtube/competitor-capture'
import { resumoTecnico } from '@/lib/youtube/agenda/motivos'
import { BANCO_MS } from '@/lib/youtube/agenda/relogio'
import type { CausaDaFalha, Lido } from '@/lib/youtube/agenda/tipos'
import { leiturasDoBanco } from '@/lib/youtube/watch/puro'
import type { LinhaLeituraBanco, LinhaThumbBanco } from '@/lib/youtube/watch/expansor'
import type { CampoTeste, LeituraWatch, VereditoTesteYoutube } from '../tipos'
import { INTERVALO_SEM_RODADA_MS, RETENCAO_S4_MS, RETENTATIVA_ERRO_MS } from './constantes'
import type { LinhasEscrita } from './escritas'
import { FRESCOR_MAX_MS } from './frescor'
import type { EvidenciaRodada, Fechamentos, RegistroAberto } from './tipos'

export type Prioridade = 1 | 2 | 3 | 4 | 5
export interface UltimasAvaliacoes {
  /** Existe avaliação SEM erro. */
  alguma: boolean
  ultimaEm: string | null
  /** Exclui erro e sem_rodada_nova. */
  ultimaOkEm: string | null
  ultimoErroEm: string | null
  ultimoErro: string | null
  ultimoErroId: number | null
  /** Avaliação mais recente, qualquer estado. */
  ultimaId: number | null
  ultimoSemRodadaEm: string | null
}
export interface Candidato {
  siteId: string
  /** uuid de `youtube_videos.id` */
  videoId: string
  ytId: string
  prioridade: Prioridade
  motivo: 'teste_nosso' | 'registro_aberto' | 'rodada_nova' | 'sem_rodada_nova' | 'reproduzir'
  ultimaRodadaEm: string | null
  aberto: RegistroAberto | null
  fechamentos: Fechamentos
  ultimas: UltimasAvaliacoes | null
}
export interface LidoDeLeituras { leituras: LeituraWatch[]; invalidas: number }

const PAGINA = 1000
const MAX_PAGINAS = 60
const DIA_MS = 86_400_000
const JANELA_DRAFT_DIAS = 30
const LOTE_UUIDS = 100
const LOTE_IDS_YT = 200
const LOTE_THUMBS = 500
const REGEX_ID = /^[A-Za-z0-9_-]{11}$/

class FalhaDeLeitura extends Error {
  constructor(msg: string, readonly causa: CausaDaFalha, readonly codigo?: string) { super(msg) }
}

function comoLido<T>(e: unknown): Lido<T> {
  if (e instanceof FalhaDeLeitura) return { porque: e.message, causa: e.causa, ...(e.codigo !== undefined ? { codigo: e.codigo } : {}) }
  return { porque: 'leitura do registro lançou', causa: 'excecao' }
}
function erroDoBanco(oQue: string, error: unknown): FalhaDeLeitura {
  const s = resumoTecnico(error).sqlstate
  return new FalhaDeLeitura(`leitura de ${oQue} falhou`, 'erro_do_banco', s ?? undefined)
}
const textoOuNulo = (x: unknown): x is string | null => x === null || typeof x === 'string'
const ms = (s: string | null): number | null => {
  if (s === null) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : null
}
const em = (s: string | null): number => ms(s) ?? Number.NEGATIVE_INFINITY

interface Resposta { data: unknown; error: unknown; count?: number | null }

/** Lê tudo de uma consulta paginada por `range` de 1.000. Lança `FalhaDeLeitura`: nunca devolve lista parcial como se fosse inteira. */
async function paginar<T>(oQue: string, pagina: (de: number, ate: number) => PromiseLike<Resposta>, guarda: (x: unknown) => x is T): Promise<T[]> {
  const out: T[] = []
  for (let p = 0; p < MAX_PAGINAS; p++) {
    let r: Resposta
    try { r = await pagina(p * PAGINA, p * PAGINA + PAGINA - 1) } catch (e) { throw new FalhaDeLeitura(`leitura de ${oQue} lançou`, 'excecao', resumoTecnico(e).sqlstate ?? undefined) }
    if (r.error) throw erroDoBanco(oQue, r.error)
    if (!Array.isArray(r.data) || !r.data.every(guarda)) throw new FalhaDeLeitura(`${oQue}: resposta fora da forma`, 'forma_invalida')
    out.push(...r.data)
    if (r.data.length < PAGINA) return out
  }
  throw new FalhaDeLeitura(`${oQue}: mais de ${MAX_PAGINAS * PAGINA} linhas`, 'forma_invalida')
}

function lotes<T>(xs: readonly T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out
}

// ───────────────────────── candidatos ─────────────────────────
interface LinhaAlvo { site_id: string; youtube_video_id: string; rodadas_por_dia: 1 | 4; ultima_rodada_em: string | null; saiu_em: string | null; ativo_desde: string }
const eLinhaAlvo = (x: unknown): x is LinhaAlvo =>
  isRec(x) && typeof x.site_id === 'string' && typeof x.youtube_video_id === 'string' && (x.rodadas_por_dia === 1 || x.rodadas_por_dia === 4)
  && textoOuNulo(x.ultima_rodada_em) && textoOuNulo(x.saiu_em) && typeof x.ativo_desde === 'string'
interface LinhaVideo { id: string; site_id: string; youtube_video_id: string }
const eLinhaVideo = (x: unknown): x is LinhaVideo => isRec(x) && typeof x.id === 'string' && typeof x.site_id === 'string' && typeof x.youtube_video_id === 'string'
interface LinhaTesteNosso { youtube_video_id: string; status: string; created_at: string; updated_at: string | null }
const eLinhaTesteNosso = (x: unknown): x is LinhaTesteNosso =>
  isRec(x) && typeof x.youtube_video_id === 'string' && typeof x.status === 'string' && typeof x.created_at === 'string' && textoOuNulo(x.updated_at)
interface LinhaNativo {
  id: string; site_id: string; video_id: string; youtube_video_id: string; estado: string; origem: 'detectado' | 'confirmado'; campos: CampoTeste[]
  variantes_titulo: string[] | null; votos_titulo: Record<string, number> | null; primeira_vista: string | null; ultima_vista: string | null
  veredito: VereditoTesteYoutube | null; evidencia: EvidenciaRodada[]; desfecho_estado: string | null; desfecho_motivo: string | null; updated_at: string
}
const eLinhaNativo = (x: unknown): x is LinhaNativo =>
  isRec(x) && typeof x.id === 'string' && typeof x.site_id === 'string' && typeof x.video_id === 'string' && typeof x.youtube_video_id === 'string'
  && typeof x.updated_at === 'string' && (x.origem === 'detectado' || x.origem === 'confirmado') && Array.isArray(x.campos) && Array.isArray(x.evidencia)
  && textoOuNulo(x.primeira_vista) && textoOuNulo(x.ultima_vista) && textoOuNulo(x.desfecho_estado) && textoOuNulo(x.desfecho_motivo)
interface LinhaFechada { video_id: string; estado: string; encerrado_em: string | null; descartado_em: string | null }
const eLinhaFechada = (x: unknown): x is LinhaFechada => isRec(x) && typeof x.video_id === 'string' && typeof x.estado === 'string' && textoOuNulo(x.encerrado_em) && textoOuNulo(x.descartado_em)

const COLUNAS_NATIVO = 'id, site_id, video_id, youtube_video_id, estado, origem, campos, variantes_titulo, votos_titulo, primeira_vista, ultima_vista, veredito, evidencia, desfecho_estado, desfecho_motivo, updated_at'

function abertoDe(l: LinhaNativo): RegistroAberto {
  return {
    id: l.id, updatedAt: l.updated_at, origem: l.origem, campos: l.campos, variantesTitulo: l.variantes_titulo, votosTitulo: l.votos_titulo,
    primeiraVista: l.primeira_vista, ultimaVista: l.ultima_vista, veredito: l.veredito, evidencia: l.evidencia,
    desfechoEstado: l.desfecho_estado, desfechoMotivo: l.desfecho_motivo,
  }
}

function ultimasDe(x: unknown): [string, UltimasAvaliacoes] | null {
  if (!isRec(x) || typeof x.video_id !== 'string' || typeof x.alguma !== 'boolean') return null
  const t = (k: string): string | null | undefined => (textoOuNulo(x[k]) ? (x[k] as string | null) : undefined)
  const n = (k: string): number | null | undefined => (x[k] === null || typeof x[k] === 'number' ? (x[k] as number | null) : undefined)
  const ultimaEm = t('ultima_em'), ok = t('ultima_ok_em'), erroEm = t('ultimo_erro_em'), erro = t('ultimo_erro'), srn = t('ultimo_sem_rodada_em')
  const erroId = n('ultimo_erro_id'), id = n('ultima_id')
  if ([ultimaEm, ok, erroEm, erro, srn, erroId, id].some(v => v === undefined)) return null
  return [x.video_id, { alguma: x.alguma, ultimaEm: ultimaEm!, ultimaOkEm: ok!, ultimoErroEm: erroEm!, ultimoErro: erro!, ultimoErroId: erroId!, ultimaId: id!, ultimoSemRodadaEm: srn! }]
}

interface Entrada { siteId: string; videoId: string; ytId: string; alvo: LinhaAlvo | null; aberto: LinhaNativo | null; testeNosso: boolean }

/**
 * Quem é devido agora (§5.2). Prioridade: teste nosso (1), registro aberto (2), alvo com rodada nova ou primeira avaliação (3),
 * `sem_rodada_nova` (4), primeira avaliação de alvo que saiu (5). A primeira avaliação herda o nível do vídeo; `motivo 'reproduzir'`
 * é a primeira avaliação (acerto do passado).
 */
function decidir(e: Entrada, u: UltimasAvaliacoes, agoraMs: number): { motivo: Candidato['motivo']; prioridade: Prioridade } | null {
  const ativo = e.alvo !== null && e.alvo.saiu_em === null
  const nivel = (base: Prioridade): Prioridade => (e.testeNosso ? 1 : e.aberto !== null ? 2 : base)
  const ultimaRodada = e.alvo?.ultima_rodada_em ?? null

  // erro mais recente que a última avaliação boa: uma tentativa por RETENTATIVA_ERRO_MS
  const erroEm = ms(u.ultimoErroEm)
  if (erroEm !== null && erroEm > em(u.ultimaOkEm) && agoraMs - erroEm < RETENTATIVA_ERRO_MS) return null

  if (!u.alguma) return { motivo: 'reproduzir', prioridade: nivel(ativo ? 3 : 5) }
  if (ultimaRodada !== null && em(ultimaRodada) > em(u.ultimaOkEm)) return { motivo: e.testeNosso ? 'teste_nosso' : 'rodada_nova', prioridade: nivel(3) }
  const ultimaEm = ms(u.ultimaEm)
  if (e.aberto !== null && ultimaEm !== null && agoraMs - ultimaEm >= DIA_MS) return { motivo: 'registro_aberto', prioridade: nivel(2) }
  if (ativo) {
    const base = ms(ultimaRodada) ?? ms(e.alvo!.ativo_desde)
    const srn = ms(u.ultimoSemRodadaEm)
    if (base !== null && agoraMs - base > FRESCOR_MAX_MS && (srn === null || agoraMs - srn >= INTERVALO_SEM_RODADA_MS)) {
      return { motivo: 'sem_rodada_nova', prioridade: nivel(4) }
    }
  }
  return null
}

export async function lerCandidatos(sb: SupabaseClient, agoraMs: number): Promise<Lido<{ devidos: Candidato[]; semVideo: number; antigosFora: number; total: number }>> {
  try {
    const corteSaida = new Date(agoraMs - RETENCAO_S4_MS).toISOString()
    const alvos = await paginar<LinhaAlvo>('alvos próprios',
      (de, ate) => sb.from('yt_watch_alvos').select('site_id, youtube_video_id, rodadas_por_dia, ultima_rodada_em, saiu_em, ativo_desde')
        .eq('tipo', 'proprio').or(`saiu_em.is.null,saiu_em.gte.${corteSaida}`).order('id').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)),
      eLinhaAlvo)

    const abertos = await paginar<LinhaNativo>('registros abertos',
      (de, ate) => sb.from('ab_native_tests').select(COLUNAS_NATIVO).eq('estado', 'em_andamento').order('created_at').order('id').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)),
      eLinhaNativo)

    // youtube_videos pelo par (site_id, youtube_video_id) dos alvos; os registros abertos já trazem o uuid
    const ids = [...new Set(alvos.map(a => a.youtube_video_id).filter(i => REGEX_ID.test(i)))]
    const videos = new Map<string, LinhaVideo>()
    for (const lote of lotes(ids, LOTE_IDS_YT)) {
      const linhas = await paginar<LinhaVideo>('vídeos',
        (de, ate) => sb.from('youtube_videos').select('id, site_id, youtube_video_id').in('youtube_video_id', lote).order('id').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)),
        eLinhaVideo)
      for (const v of linhas) videos.set(`${v.site_id}|${v.youtube_video_id}`, v)
    }

    const testesNossos = await paginar<LinhaTesteNosso>('testes abertos',
      (de, ate) => sb.from('ab_tests').select('youtube_video_id, status, created_at, updated_at').not('status', 'in', '(completed,archived)').order('created_at').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)),
      eLinhaTesteNosso)
    const corteDraft = agoraMs - JANELA_DRAFT_DIAS * DIA_MS
    const comTeste = new Set<string>()
    for (const t of testesNossos) {
      if (t.status === 'draft' && !(em(t.created_at) >= corteDraft || em(t.updated_at) >= corteDraft)) continue
      comTeste.add(t.youtube_video_id)
    }

    // universo: um item por vídeo (uuid)
    const abertoPorVideo = new Map(abertos.map(a => [a.video_id, a]))
    const universo = new Map<string, Entrada>()
    let semVideo = 0
    let antigosFora = 0
    for (const a of alvos) {
      const v = videos.get(`${a.site_id}|${a.youtube_video_id}`)
      if (v === undefined) { semVideo++; continue }
      const aberto = abertoPorVideo.get(v.id) ?? null
      const testeNosso = comTeste.has(v.id)
      if (a.saiu_em === null && a.rodadas_por_dia === 1 && !testeNosso && aberto === null) { antigosFora++; continue }
      universo.set(v.id, { siteId: a.site_id, videoId: v.id, ytId: a.youtube_video_id, alvo: a, aberto, testeNosso })
    }
    for (const r of abertos) {
      if (!universo.has(r.video_id)) universo.set(r.video_id, { siteId: r.site_id, videoId: r.video_id, ytId: r.youtube_video_id, alvo: null, aberto: r, testeNosso: comTeste.has(r.video_id) })
    }

    const todos = [...universo.keys()]
    const fechados = new Map<string, Fechamentos>()
    for (const lote of lotes(todos, LOTE_UUIDS)) {
      const linhas = await paginar<LinhaFechada>('registros fechados',
        (de, ate) => sb.from('ab_native_tests').select('video_id, estado, encerrado_em, descartado_em').in('video_id', lote).in('estado', ['encerrado', 'sem_desfecho', 'descartado']).order('created_at', { ascending: false }).order('id').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)),
        eLinhaFechada)
      for (const l of linhas) {
        const f = fechados.get(l.video_id) ?? { encerradoEm: null, descartadoEm: null }
        if (l.encerrado_em !== null && em(l.encerrado_em) > em(f.encerradoEm)) f.encerradoEm = l.encerrado_em
        if (l.descartado_em !== null && em(l.descartado_em) > em(f.descartadoEm)) f.descartadoEm = l.descartado_em
        fechados.set(l.video_id, f)
      }
    }

    const ultimas = new Map<string, UltimasAvaliacoes>()
    for (const lote of lotes(todos, LOTE_UUIDS)) {
      let r: Resposta
      try { r = await sb.rpc('ab_native_ultimas', { p_videos: lote }).abortSignal(AbortSignal.timeout(BANCO_MS)) } catch (e) { throw new FalhaDeLeitura('leitura das últimas avaliações lançou', 'excecao', resumoTecnico(e).sqlstate ?? undefined) }
      if (r.error) throw erroDoBanco('últimas avaliações', r.error)
      if (!Array.isArray(r.data)) throw new FalhaDeLeitura('últimas avaliações: resposta fora da forma', 'forma_invalida')
      for (const x of r.data) {
        const u = ultimasDe(x)
        if (u === null) throw new FalhaDeLeitura('últimas avaliações: linha fora da forma', 'forma_invalida')
        ultimas.set(u[0], u[1])
      }
    }

    const devidos: Candidato[] = []
    for (const e of universo.values()) {
      const u = ultimas.get(e.videoId)
      if (u === undefined) throw new FalhaDeLeitura('últimas avaliações: vídeo sem linha', 'forma_invalida')
      const d = decidir(e, u, agoraMs)
      if (d === null) continue
      devidos.push({
        siteId: e.siteId, videoId: e.videoId, ytId: e.ytId, prioridade: d.prioridade, motivo: d.motivo,
        ultimaRodadaEm: e.alvo?.ultima_rodada_em ?? null, aberto: e.aberto === null ? null : abertoDe(e.aberto),
        fechamentos: fechados.get(e.videoId) ?? { encerradoEm: null, descartadoEm: null }, ultimas: u,
      })
    }
    devidos.sort((a, b) => a.prioridade - b.prioridade || em(a.ultimaRodadaEm) - em(b.ultimaRodadaEm) || (a.ytId < b.ytId ? -1 : a.ytId > b.ytId ? 1 : 0))
    return { valor: { devidos, semVideo, antigosFora, total: alvos.length } }
  } catch (e) {
    return comoLido(e)
  }
}

// ───────────────────────── leituras ─────────────────────────
const COLUNAS_LEITURA = 'id, site_id, youtube_video_id, lida_em, rodada_id, origem_rede, versao_leitor, http, erro, idioma, titulo_oficial, titulo_oficial_fonte, titulo_exibido, renderers_presentes, titulos_divergentes, rendicoes_sqp, jogador_bloqueado, miniatura_id'
const COLUNAS_THUMB = 'id, site_id, youtube_video_id, host, variante, http, etag, sha16, dhash, largura, altura'
const eLinhaLeitura = (x: unknown): x is LinhaLeituraBanco => isRec(x) && typeof x.lida_em === 'string'
const eLinhaThumb = (x: unknown): x is LinhaThumbBanco => isRec(x) && typeof x.id === 'number'

/**
 * Todas as leituras do vídeo em `[desde, t0]`, ordenadas por `(lida_em, id)`, paginadas com `count` conferido: o PostgREST corta em 1.000 linhas
 * sem erro. O teto `t0` deixa de fora o que a coleta gravar entre as páginas. Soma diferente do `count` = falha (nunca leitura parcial).
 */
export async function lerLeiturasPaginadas(sb: SupabaseClient, ytId: string, siteId: string, desdeMs: number, t0Iso: string): Promise<Lido<LidoDeLeituras>> {
  try {
    const desde = new Date(desdeMs).toISOString()
    const linhas: LinhaLeituraBanco[] = []
    let total: number | null = null
    for (let p = 0; p < MAX_PAGINAS; p++) {
      let q = sb.from('yt_watch_readings').select(COLUNAS_LEITURA, p === 0 ? { count: 'exact' } : undefined)
        .eq('site_id', siteId).eq('youtube_video_id', ytId).gte('lida_em', desde).lte('lida_em', t0Iso).order('lida_em').order('id')
      q = q.range(p * PAGINA, p * PAGINA + PAGINA - 1).abortSignal(AbortSignal.timeout(BANCO_MS))
      let r: Resposta
      try { r = await q } catch (e) { throw new FalhaDeLeitura('leitura das leituras lançou', 'excecao', resumoTecnico(e).sqlstate ?? undefined) }
      if (r.error) throw erroDoBanco('leituras', r.error)
      if (!Array.isArray(r.data) || !r.data.every(eLinhaLeitura)) throw new FalhaDeLeitura('leituras: resposta fora da forma', 'forma_invalida')
      if (p === 0) {
        if (typeof r.count !== 'number') throw new FalhaDeLeitura('leituras: sem count', 'forma_invalida')
        total = r.count
      }
      linhas.push(...r.data)
      if (r.data.length < PAGINA) break
      if (p === MAX_PAGINAS - 1) throw new FalhaDeLeitura('leituras: páginas demais', 'forma_invalida')
    }
    if (total === null || linhas.length !== total) throw new FalhaDeLeitura('leituras: a soma das páginas não confere com o count', 'forma_invalida')

    const idsThumb = [...new Set(linhas.map(l => l.miniatura_id).filter((x): x is number => typeof x === 'number'))]
    const thumbs: LinhaThumbBanco[] = []
    for (const lote of lotes(idsThumb, LOTE_THUMBS)) {
      thumbs.push(...await paginar<LinhaThumbBanco>('miniaturas',
        (de, ate) => sb.from('yt_watch_thumbs').select(COLUNAS_THUMB).in('id', lote).order('id').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)),
        eLinhaThumb))
    }
    const { validas, invalidas } = leiturasDoBanco(linhas, thumbs)
    return { valor: { leituras: validas, invalidas } }
  } catch (e) {
    return comoLido(e)
  }
}

// ───────────────────────── escritas conhecidas ─────────────────────────
interface LinhaTesteEscrita { id: string; test_type: string; winner_applied_at: string | null }
const eTesteEscrita = (x: unknown): x is LinhaTesteEscrita => isRec(x) && typeof x.id === 'string' && typeof x.test_type === 'string' && textoOuNulo(x.winner_applied_at)
const eCiclo = (x: unknown): x is LinhasEscrita['ciclos'][number] => isRec(x) && typeof x.test_id === 'string' && textoOuNulo(x.started_at) && textoOuNulo(x.ended_at) && textoOuNulo(x.end_reason)
const eRestauracao = (x: unknown): x is LinhasEscrita['restauracoes'][number] =>
  isRec(x) && typeof x.test_id === 'string' && (x.campo === 'title' || x.campo === 'thumbnail') && (x.escreveu === null || typeof x.escreveu === 'boolean') && typeof x.em === 'string'

/** Escritas do próprio app no vídeo (uuid de `youtube_videos.id`), na janela. Sem teste do vídeo: três listas vazias, sem tocar nas outras tabelas. */
export async function lerEscritas(sb: SupabaseClient, videoId: string, janela: { deMs: number; ateMs: number }): Promise<Lido<LinhasEscrita>> {
  try {
    const de = new Date(janela.deMs).toISOString()
    const ate = new Date(janela.ateMs).toISOString()
    const testes = await paginar<LinhaTesteEscrita>('testes do vídeo',
      (a, b) => sb.from('ab_tests').select('id, test_type, winner_applied_at').eq('youtube_video_id', videoId).order('id').range(a, b).abortSignal(AbortSignal.timeout(BANCO_MS)),
      eTesteEscrita)
    if (testes.length === 0) return { valor: { testes: [], ciclos: [], restauracoes: [] } }
    const ids = testes.map(t => t.id)
    const ciclos: LinhasEscrita['ciclos'] = []
    const restauracoes: LinhasEscrita['restauracoes'] = []
    for (const lote of lotes(ids, LOTE_UUIDS)) {
      ciclos.push(...await paginar('ciclos',
        (a, b) => sb.from('ab_test_cycles').select('test_id, started_at, ended_at, end_reason').in('test_id', lote)
          .or(`and(started_at.gte.${de},started_at.lte.${ate}),and(ended_at.gte.${de},ended_at.lte.${ate})`).order('id').range(a, b).abortSignal(AbortSignal.timeout(BANCO_MS)),
        eCiclo))
      restauracoes.push(...await paginar('restaurações',
        (a, b) => sb.from('ab_test_restores').select('test_id, campo, escreveu, em').in('test_id', lote).gte('em', de).lte('em', ate).order('id').range(a, b).abortSignal(AbortSignal.timeout(BANCO_MS)),
        eRestauracao))
    }
    return { valor: { testes, ciclos, restauracoes } }
  } catch (e) {
    return comoLido(e)
  }
}

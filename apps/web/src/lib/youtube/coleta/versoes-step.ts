// Passo `versoes` do cron dos canais próprios (E18, plano seções 4.3 e 6): deriva, dia a dia, as versões de título,
// thumbnail e descrição a partir de `yt_own_video_meta_daily`. Grava SÓ por `rpc('yt_own_versions_apply_day')`, um canal e
// um dia por vez (uma transação no banco). Zero chamada ao YouTube. Nenhuma nota nem campo do resumo leva título de vídeo
// nem texto de erro do Postgres: só nome de canal, dia, contagem e códigos de catálogo.
import type { CompletedReason } from '@/lib/youtube/ab-types'
import type { OrigemGravavel } from '@/lib/youtube/observatorio/proprio-versoes/tipos'
import { addDays, boundsAnalytics, diffDias } from './day-pt'
import { comPrazo, restante } from './clock'
import { lerPaginado } from './paginar'
import { conferirBanco, ehSchemaAusente, pushUnico, type ErroBanco } from './schema'
import type { ColetaChannel, StepCtx } from './types'
import {
  aplicarPlanoNasCorrentes, derivarDia,
  type AberturaSemOrigem, type CorrenteDoCampo, type FatoDoDia, type MotivoPulo, type PlanoDoDia,
} from './versoes-derivar'
import { fatosDoDia, videosCobertosSemLinha, type IntervaloMeta } from './versoes-fatos-cobertura'
import { atribuirOrigem, FOLGA_REGISTRO_MS, type CicloAb, type LeituraAb, type RestauroAb, type TesteAb } from './versoes-origem'

export const TETO_VERSOES_MS = 10_000
export const MAX_DIAS_POR_EXECUCAO = 30
/** Teto de linhas lidas por consulta paginada (linhas diárias, correntes, texto de descrição, privacidade). */
export const TETO_LINHAS_VERSOES = 20_000
/** Teto de cada leitura do A/B Lab: chegar a ele é leitura possivelmente cortada. */
const TETO_AB = 1_000
/** Com menos que isto antes de um dia, o passo para (um `apply_day` ainda cabe em ~1 s). */
const FOLGA_MIN_MS = 1_500
/** Vídeos por leitura da última linha guardada (o `in` vai na URL). */
const LOTE_ULTIMAS = 150

export interface VersoesResumo {
  dia_ate: string
  canais: number
  dias_derivados: number
  confirmadas: number
  abertas: Record<OrigemGravavel, number>
  retoques: number
  pulados: Record<MotivoPulo, number>
  dias_sem_linha: number
  ja_derivado: number
  desc_sem_texto: number
  origem_sem_video: number
  origem_ab_incerta: number
  /** troca cuja parada do A/B Lab (teste do mundo novo) não tem registro no histórico: vermelho */
  origem_ab_sem_registro: number
  /** `youtube_channels.id` → dias de atraso de `derived_through` (ou do menor `day_pt`, sem estado) */
  atraso_dias: Record<string, number>
  sem_videos: string[]
  sem_tempo: boolean
  /** `youtube_channels.id` → atraso, para canal que parou por falta de tempo ou no teto com 2 dias ou mais derivados */
  recuperando: Record<string, number>
  /** dias (`AAAA-MM-DD`) cujo `apply_day` não respondeu até o prazo */
  dia_sem_resposta: string[]
  /** `youtube_channels.id` cujo atraso o passo não chegou a saber */
  atraso_desconhecido: string[]
  /** por site: a resposta da prova diária, ou 'sem_tempo' */
  prova: Record<string, unknown>
  /** A5 E18 P2: dias derivados em que o vídeo estava coberto e sem linha (a dieta tirou a linha igual à vizinha). */
  cobertos_sem_linha: number
  /** A5 E18 P2: leitura de `yt_own_video_coverage`. `nao_lida` = nenhum canal chegou a ler (nunca vira "lida" em silêncio). */
  cobertura_meta: 'nao_lida' | 'lida' | 'schema_ausente' | 'erro'
}

interface LinhaDia {
  youtube_video_id: string
  day_pt: string
  video_id: string | null
  title_at_capture: string | null
  description_sha256: string | null
  thumbnail_dhash: string | null
  thumbnail_sha256_at_capture: string | null
  thumbnail_blob_url: string | null
  privacy_status: 'public' | 'unlisted' | 'private' | null
  captured_at: string
}
const COLUNAS_DIA = 'youtube_video_id, day_pt, video_id, title_at_capture, description_sha256, thumbnail_dhash, thumbnail_sha256_at_capture, thumbnail_blob_url, privacy_status, captured_at'

interface LinhaCorrente {
  id: string
  youtube_video_id: string
  field: 'title' | 'thumb' | 'desc'
  value_hash: string
  thumb_anchor_dhash: string | null
  thumb_sha256: string | null
  last_day_pt: string
  last_seen_at: string
}
const COLUNAS_CORRENTE = 'id, youtube_video_id, field, value_hash, thumb_anchor_dhash, thumb_sha256, last_day_pt, last_seen_at'

interface TesteLinha {
  id: string
  youtube_video_id: string
  test_type: TesteAb['tipo']
  paused_at: string | null
  completed_at: string | null
  completed_reason: CompletedReason | null
  winner_variant_id: string | null
  winner_applied_at: string | null
  original_title: string | null
  restore_status: unknown
}
interface RestauroLinha {
  test_id: string
  seq: number
  campo: string
  destino: string
  estado: string
  escreveu: boolean | null
  em: string
  iniciativa?: string | null
}
interface CicloLinha {
  id: string
  test_id: string
  variant_id: string
  started_at: string
  applied_metadata: { title_set?: unknown; thumbnail_set?: unknown } | null
}

const ESTADOS_RESTAURO: readonly string[] = ['ok', 'falhou', 'pulado_sem_original', 'pulado_drift', 'desistiu']
const COLUNAS_RESTAUROS = 'test_id, seq, campo, destino, estado, escreveu, em, iniciativa'
// Fuso explícito (Z ou ±hh:mm): sem ele o V8 lê como horário local do servidor e a janela desloca em silêncio.
const ISO_COM_FUSO = /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/
const instanteLegivel = (x: unknown): x is string => typeof x === 'string' && ISO_COM_FUSO.test(x) && !Number.isNaN(Date.parse(x))

/**
 * `ab_tests.restore_status` (jsonb) em mundo novo/em_andamento. Nulo = mundo antigo. Forma fora do esperado (campo com estado
 * desconhecido ou `em` que `Date.parse` não lê, como 'now') = ilegível: o Lab do canal inteiro vira `nao_se_sabe` (emenda 15/10, E.3).
 * `erro` e `motivo` do jsonb nunca saem daqui.
 */
function lerRestoreStatus(rs: unknown): { ok: true; mundoNovo: boolean; emAndamento: { title?: string; thumb?: string } } | { ok: false } {
  if (rs === null || rs === undefined) return { ok: true, mundoNovo: false, emAndamento: {} }
  if (typeof rs !== 'object' || Array.isArray(rs)) return { ok: false }
  const emAndamento: { title?: string; thumb?: string } = {}
  for (const [chave, campo] of [['title', 'title'], ['thumbnail', 'thumb']] as const) {
    const v = (rs as Record<string, unknown>)[chave]
    if (v === undefined) continue
    if (v === null || typeof v !== 'object') return { ok: false }
    const { estado, em } = v as { estado?: unknown; em?: unknown }
    if (typeof estado !== 'string' || (estado !== 'em_andamento' && !ESTADOS_RESTAURO.includes(estado))) return { ok: false }
    if (!instanteLegivel(em)) return { ok: false }
    if (estado === 'em_andamento') emAndamento[campo] = em
  }
  return { ok: true, mundoNovo: true, emAndamento }
}

/** Códigos de recusa que a função do banco lança (catálogo fechado). Qualquer outra mensagem vira `erro_desconhecido`. */
const CODIGOS_RECUSA: readonly string[] = [
  'touch_recusado', 'abertura_invalida', 'canal_fora_do_site', 'dia_nao_fechado', 'sem_linha_do_dia',
  'linha_de_base_incoerente', 'argumento_nulo', 'argumento_invalido',
]

function codigoDoErro(e: ErroBanco): string {
  if (ehSchemaAusente(e)) return 'funcao_ausente'
  const m = (e.message ?? '').trim()
  return CODIGOS_RECUSA.includes(m) ? m : 'erro_desconhecido'
}

function resumoVazio(ontem: string, canais: number): VersoesResumo {
  return {
    dia_ate: ontem, canais, dias_derivados: 0, confirmadas: 0,
    abertas: { linha_de_base: 0, ab_lab: 0, fora_do_sistema: 0, nao_se_sabe: 0 },
    retoques: 0, pulados: { sem_captura: 0, sem_dhash: 0, privado: 0 }, dias_sem_linha: 0, ja_derivado: 0,
    desc_sem_texto: 0, origem_sem_video: 0, origem_ab_incerta: 0, origem_ab_sem_registro: 0, atraso_dias: {}, sem_videos: [], sem_tempo: false,
    recuperando: {}, dia_sem_resposta: [], atraso_desconhecido: [], prova: {}, cobertos_sem_linha: 0, cobertura_meta: 'nao_lida',
  }
}

type Leitura<T> = { ok: true; linhas: T[] } | { ok: false; motivo: 'erro_de_banco' | 'passou_do_teto' | 'sem_tempo'; schemaAusente: boolean }

export async function passoVersoes(ctx: StepCtx & { ontem: string }): Promise<VersoesResumo> {
  const ontem = ctx.ontem
  const resumo = resumoVazio(ontem, ctx.channels.length)
  if (ctx.channels.length === 0) return resumo
  const fimDeOntem = new Date(boundsAnalytics(ontem).end).toISOString()
  const fimDoDia = (dia: string): string => new Date(boundsAnalytics(dia).end).toISOString()

  /** Acumuladores que viram nota no fim. */
  let labIlegivelTrocas = 0
  /** canais com vídeos cadastrados e linha capturada (base de "zero públicos" na prova) */
  const comCaptura = new Set<string>()

  // ── leitura com prazo ──────────────────────────────────────────────────────────────────────────────
  /** Uma consulta de uma resposta só. `null` = o prazo do passo acabou. */
  async function uma<T>(q: PromiseLike<{ data: T | null; error: ErroBanco | null; count?: number | null }>): Promise<{ data: T | null; error: ErroBanco | null; count: number | null } | null> {
    const r = await comPrazo(Promise.resolve(q), ctx.deadline)
    return r === null ? null : { data: r.data, error: r.error, count: r.count ?? null }
  }
  /** Leitura paginada com prazo em cada página. */
  async function paginada<T>(pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: ErroBanco | null }>): Promise<Leitura<T>> {
    let estourou = false
    let schema = false
    const r = await lerPaginado<T>(async (de, ate) => {
      const res = await comPrazo(Promise.resolve(pagina(de, ate)), ctx.deadline)
      if (res === null) { estourou = true; return { data: null, error: { code: 'prazo', message: 'prazo' } } }
      if (res.error && ehSchemaAusente(res.error)) schema = true
      return res
    }, TETO_LINHAS_VERSOES)
    if (r.ok) return { ok: true, linhas: r.linhas }
    return { ok: false, motivo: estourou ? 'sem_tempo' : r.motivo, schemaAusente: schema }
  }

  // ── canais ─────────────────────────────────────────────────────────────────────────────────────────
  const semAtraso = new Set<string>() // canais cujo atraso foi calculado
  let parouPorSchema = false

  for (const c of ctx.channels) {
    if (parouPorSchema) break
    if (restante(ctx.deadline) <= 0) { resumo.sem_tempo = true; resumo.atraso_desconhecido.push(c.id); continue }
    await derivarCanal(c)
  }

  async function derivarCanal(c: ColetaChannel): Promise<void> {
    // 1. estado
    const est = await uma<{ derived_through: string; tracking_since: string }>(
      ctx.supabase.from('yt_own_versions_state').select('derived_through, tracking_since').eq('channel_id', c.id).eq('site_id', c.site_id).maybeSingle(),
    )
    if (est === null) { resumo.sem_tempo = true; resumo.atraso_desconhecido.push(c.id); return }
    const rEst = conferirBanco(est, 'yt_own_versions_state', ctx.falhas, 'ler')
    if (rEst === 'schema_ausente') { parouPorSchema = true; return }
    if (rEst === 'erro') return
    let derivadoAte: string | null = est.data?.derived_through ?? null
    let temEstado = est.data !== null

    // 2. quantos vídeos o canal tem (mesmo filtro do passo de metadados)
    // Contagem nula não é zero: vira a nota "não foi possível avaliar" e `null` (nunca "sem vídeos").
    const contar = async (fim: string): Promise<number | null | 'sem_tempo'> => {
      const r = await uma<unknown>(
        ctx.supabase.from('youtube_videos').select('id', { count: 'exact', head: true }).eq('channel_id', c.id).not('published_at', 'is', null).lt('published_at', fim),
      )
      if (r === null) return 'sem_tempo'
      const ok = conferirBanco(r, 'youtube_videos', ctx.falhas, 'ler') === 'ok'
      if (!ok || r.count === null) {
        pushUnico(ctx.falhas, `critérios: não foi possível avaliar se ${c.name} tem vídeos`)
        return null
      }
      return r.count
    }
    const nVideos = await contar(fimDeOntem)
    if (nVideos === 'sem_tempo') { resumo.sem_tempo = true; if (!temEstado || derivadoAte === null) resumo.atraso_desconhecido.push(c.id); else registrarAtraso(c, derivadoAte, false); return }
    const avaliaVideos = typeof nVideos === 'number'

    // 3. intervalo a derivar
    let menorDia: string | null = null
    if (!temEstado) {
      const m = await uma<Array<{ day_pt: string }>>(
        ctx.supabase.from('yt_own_video_meta_daily').select('day_pt').eq('site_id', c.site_id).eq('channel_id', c.id).order('day_pt', { ascending: true }).limit(1),
      )
      if (m === null) { resumo.sem_tempo = true; resumo.atraso_desconhecido.push(c.id); return }
      if (conferirBanco(m, 'yt_own_video_meta_daily', ctx.falhas, 'ler') !== 'ok') return
      menorDia = m.data?.[0]?.day_pt ?? null
      if (menorDia === null) {
        // Sem estado e sem nenhuma linha diária.
        if (avaliaVideos && nVideos === 0) resumo.sem_videos.push(c.id)
        else if (avaliaVideos) pushUnico(ctx.falhas, `versões: ${c.name} tem vídeos e nenhuma linha diária`)
        return
      }
    }
    const ini = temEstado && derivadoAte !== null ? addDays(derivadoAte, 1) : menorDia!
    const dias = Math.max(0, diffDias(ini, ontem) + 1)
    const aDerivar = Math.min(dias, MAX_DIAS_POR_EXECUCAO)
    const noTeto = dias > MAX_DIAS_POR_EXECUCAO
    if (aDerivar === 0) { registrarAtraso(c, derivadoAte ?? addDays(ini, -1), false); return }
    const fim = addDays(ini, aDerivar - 1)

    // 4. linhas diárias do intervalo (sem description_text)
    const lidas = await paginada<LinhaDia>((de, ate) =>
      ctx.supabase.from('yt_own_video_meta_daily').select(COLUNAS_DIA)
        .eq('site_id', c.site_id).eq('channel_id', c.id).gte('day_pt', ini).lte('day_pt', fim)
        .order('day_pt', { ascending: true }).order('youtube_video_id', { ascending: true }).range(de, ate))
    if (!lidas.ok) {
      if (lidas.motivo === 'sem_tempo') { resumo.sem_tempo = true; semDia(c, derivadoAte, menorDia, temEstado); return }
      if (lidas.schemaAusente) pushUnico(ctx.falhas, 'schema_ausente: yt_own_video_meta_daily')
      else if (lidas.motivo === 'passou_do_teto') pushUnico(ctx.falhas, `versões: ${c.name} tem linhas demais para uma execução`)
      else pushUnico(ctx.falhas, 'erro de banco ao ler yt_own_video_meta_daily')
      return
    }
    const linhas = lidas.linhas
    const porDia = new Map<string, LinhaDia[]>()
    for (const l of linhas) { const a = porDia.get(l.day_pt); if (a) a.push(l); else porDia.set(l.day_pt, [l]) }
    if (linhas.length === 0 && avaliaVideos && nVideos === 0) { resumo.sem_videos.push(c.id); return }
    if (avaliaVideos && nVideos > 0 && (linhas.length > 0 || temEstado)) comCaptura.add(c.id)

    // 4b. cobertura de metadados (A5 E18 P2, Tarefa 5): uma leitura por canal e execução. Falha dela nunca para a derivação pelas linhas.
    let cobertura: IntervaloMeta[] = []
    {
      const r = await paginada<IntervaloMeta>((de, ate) =>
        ctx.supabase.from('yt_own_video_coverage').select('youtube_video_id, metric_set, covered_from, covered_to')
          .eq('site_id', c.site_id).eq('channel_id', c.id).in('metric_set', ['meta_texto', 'meta_thumb'])
          .gte('covered_to', ini).lte('covered_from', fim)
          .order('youtube_video_id', { ascending: true }).order('metric_set', { ascending: true }).order('covered_from', { ascending: true }).range(de, ate))
      if (r.ok) {
        cobertura = r.linhas
        if (resumo.cobertura_meta === 'nao_lida') resumo.cobertura_meta = 'lida'
      } else if (r.motivo === 'sem_tempo') {
        resumo.sem_tempo = true; semDia(c, derivadoAte, menorDia, temEstado); return
      } else if (r.schemaAusente) {
        if (resumo.cobertura_meta === 'nao_lida') resumo.cobertura_meta = 'schema_ausente'
      } else {
        resumo.cobertura_meta = 'erro'
        pushUnico(ctx.falhas, 'erro de banco ao ler yt_own_video_coverage')
      }
    }
    // A última linha guardada de cada vídeo coberto e sem linha em algum dia do intervalo (só se algum existe): uma leitura em lotes.
    const ultimas = new Map<string, LinhaDia>()
    if (cobertura.length > 0) {
      const precisados = new Set<string>()
      for (let i = 0; i < aDerivar; i++) {
        const d = addDays(ini, i)
        for (const id of videosCobertosSemLinha(d, porDia.get(d) ?? [], cobertura)) precisados.add(id)
      }
      const ids = [...precisados]
      for (let k = 0; k < ids.length; k += LOTE_ULTIMAS) {
        const lote = ids.slice(k, k + LOTE_ULTIMAS)
        const r = await paginada<LinhaDia>((de, ate) =>
          ctx.supabase.from('yt_own_video_meta_daily').select(COLUNAS_DIA)
            .eq('site_id', c.site_id).eq('channel_id', c.id).in('youtube_video_id', lote).lt('day_pt', ini)
            .order('youtube_video_id', { ascending: true }).order('day_pt', { ascending: false }).range(de, ate))
        if (r.ok) {
          for (const l of r.linhas) if (!ultimas.has(l.youtube_video_id)) ultimas.set(l.youtube_video_id, l)
        } else if (r.motivo === 'sem_tempo') {
          resumo.sem_tempo = true; semDia(c, derivadoAte, menorDia, temEstado); return
        } else if (r.motivo === 'passou_do_teto') {
          pushUnico(ctx.falhas, `versões: ${c.name} tem linhas demais para uma execução`) // os vídeos deste lote ficam sem fato
        } else {
          pushUnico(ctx.falhas, 'erro de banco ao ler yt_own_video_meta_daily')
        }
      }
    }
    const coberto = (d: string): boolean => videosCobertosSemLinha(d, [], cobertura).length > 0

    // 5. correntes
    const lerCorrentes = async (): Promise<CorrenteDoCampo[] | 'sem_tempo' | null> => {
      const r = await paginada<LinhaCorrente>((de, ate) =>
        ctx.supabase.from('yt_own_video_versions').select(COLUNAS_CORRENTE)
          .eq('site_id', c.site_id).eq('channel_id', c.id).eq('is_current', true).order('id', { ascending: true }).range(de, ate))
      if (!r.ok) {
        if (r.motivo === 'sem_tempo') return 'sem_tempo'
        if (r.schemaAusente) pushUnico(ctx.falhas, 'schema_ausente: yt_own_video_versions')
        else if (r.motivo === 'passou_do_teto') pushUnico(ctx.falhas, `versões: ${c.name} tem versões demais para uma execução`)
        else pushUnico(ctx.falhas, 'erro de banco ao ler yt_own_video_versions')
        return null
      }
      return r.linhas.map(l => ({
        id: l.id, ytId: l.youtube_video_id, campo: l.field, hash: l.value_hash, ancoraDhash: l.thumb_anchor_dhash,
        sha256: l.thumb_sha256, ultimoDia: l.last_day_pt, vistaAte: l.last_seen_at,
      }))
    }
    let correntes: CorrenteDoCampo[]
    {
      const r = await lerCorrentes()
      if (r === 'sem_tempo') { resumo.sem_tempo = true; semDia(c, derivadoAte, menorDia, temEstado); return }
      if (r === null) return
      correntes = r
    }

    // 6. dia a dia
    let derivadosAqui = 0
    let paradoPorTempo = false
    let paradoPorErro = false
    let lab: LeituraAb | null = null
    let privAnterior: Map<string, FatoDoDia['privacidadeConhecida']> | null | 'falhou' = null
    const privVista = new Map<string, FatoDoDia['privacidadeConhecida']>() // última privacidade não nula de dia ANTERIOR
    const todosDias: string[] = []
    for (let i = 0; i < aDerivar; i++) todosDias.push(addDays(ini, i))
    const haDiaDepois = (dia: string): boolean => todosDias.some(d => d > dia && ((porDia.get(d)?.length ?? 0) > 0 || coberto(d)))

    for (const dia of todosDias) {
      if (restante(ctx.deadline) < FOLGA_MIN_MS) { resumo.sem_tempo = true; paradoPorTempo = true; break }
      const doDia = porDia.get(dia) ?? []
      // Dia coberto e sem linha: a cópia da última linha guardada do vídeo é o fato do dia (item 202).
      const f = fatosDoDia(dia, doDia, ultimas, cobertura)
      const linhasFato = f.linhas
      if (linhasFato.length === 0) {
        // Dia sem nenhuma linha (item 189).
        const n = dia === ontem ? nVideos : await contar(fimDoDia(dia))
        if (n === 'sem_tempo') { resumo.sem_tempo = true; paradoPorTempo = true; break }
        if (typeof n === 'number' && n > 0) pushUnico(ctx.falhas, `versões: ${c.name} sem nenhuma linha diária em ${dia}`)
        if (haDiaDepois(dia)) { resumo.dias_sem_linha++; continue }
        break // fim do intervalo lido: o canal para aqui
      }

      // Privacidade conhecida de dia anterior: das linhas já vistas; senão, uma leitura por canal e execução.
      const precisaAnterior = temEstado && privAnterior === null
        && linhasFato.some(l => l.privacy_status === null && l.thumbnail_dhash !== null && !privVista.has(l.youtube_video_id))
      if (precisaAnterior) {
        const r = await paginada<{ youtube_video_id: string; day_pt: string; privacy_status: FatoDoDia['privacidadeConhecida'] }>((de, ate) =>
          ctx.supabase.from('yt_own_video_meta_daily').select('youtube_video_id, day_pt, privacy_status')
            .eq('site_id', c.site_id).eq('channel_id', c.id).not('privacy_status', 'is', null)
            .lt('day_pt', ini).gte('day_pt', addDays(ini, -30))
            .order('youtube_video_id', { ascending: true }).order('day_pt', { ascending: false }).range(de, ate))
        if (!r.ok) {
          if (r.motivo === 'sem_tempo') { resumo.sem_tempo = true; paradoPorTempo = true; break }
          pushUnico(ctx.falhas, 'erro de banco ao ler yt_own_video_meta_daily')
          privAnterior = 'falhou'
        } else {
          const m = new Map<string, FatoDoDia['privacidadeConhecida']>()
          for (const l of r.linhas) if (!m.has(l.youtube_video_id)) m.set(l.youtube_video_id, l.privacy_status)
          privAnterior = m
        }
      }
      let thumbsSemPrivacidade = 0
      const fatos: FatoDoDia[] = linhasFato.map(l => {
        let conhecida = privVista.get(l.youtube_video_id) ?? null
        if (conhecida === null && privAnterior instanceof Map) conhecida = privAnterior.get(l.youtube_video_id) ?? null
        let dhash = l.thumbnail_dhash
        if (privAnterior === 'falhou' && l.privacy_status === null && dhash !== null && conhecida === null) {
          dhash = null // não se abre versão sobre privacidade desconhecida por falha
          thumbsSemPrivacidade++
        }
        return {
          ytId: l.youtube_video_id, dia, videoId: l.video_id, capturadoEm: l.captured_at, privacidade: l.privacy_status,
          privacidadeConhecida: conhecida, titulo: l.title_at_capture, descHash: l.description_sha256, dhash,
          sha256: l.thumbnail_sha256_at_capture, blobUrl: l.thumbnail_blob_url,
        }
      })
      const plano: PlanoDoDia = derivarDia(correntes, fatos)
      plano.pulados.sem_dhash -= thumbsSemPrivacidade
      plano.pulados.sem_captura += thumbsSemPrivacidade

      // Fato repetido nunca abre versão: abrir exige a linha real do dia (`sem_linha_do_dia` no banco). O canal para aqui, sem gravar.
      if (plano.abrir.some(a => f.repetidos.has(a.ytId))) {
        pushUnico(ctx.falhas, `versões: ${c.name} abriria versão em dia sem linha (${dia})`)
        paradoPorErro = true
        break
      }

      // Origem das trocas (só se há troca; o Lab é lido uma vez por canal).
      const trocas = plano.abrir.filter(a => a.precisao !== 'first')
      if (trocas.length > 0 && lab === null) {
        const r = await lerLab(linhas, correntes)
        if (r === 'sem_tempo') { resumo.sem_tempo = true; paradoPorTempo = true; break }
        lab = r
      }

      // Texto das descrições abertas: uma leitura por canal e dia.
      const abreDesc = plano.abrir.filter(a => a.campo === 'desc')
      const textos = new Map<string, string>() // ytId|hash → texto
      if (abreDesc.length > 0) {
        const r = await paginada<{ youtube_video_id: string; day_pt: string; description_sha256: string | null; description_text: string | null }>((de, ate) =>
          ctx.supabase.from('yt_own_video_meta_daily').select('youtube_video_id, day_pt, description_sha256, description_text')
            .eq('site_id', c.site_id).eq('channel_id', c.id).in('youtube_video_id', abreDesc.map(a => a.ytId))
            .not('description_text', 'is', null).lte('day_pt', dia)
            .order('youtube_video_id', { ascending: true }).order('day_pt', { ascending: false }).range(de, ate))
        if (!r.ok) {
          if (r.motivo === 'sem_tempo') { resumo.sem_tempo = true; paradoPorTempo = true; break }
          pushUnico(ctx.falhas, 'erro de banco ao ler yt_own_video_meta_daily')
        } else {
          for (const l of r.linhas) {
            const k = `${l.youtube_video_id}|${l.description_sha256}`
            if (l.description_text !== null && !textos.has(k)) textos.set(k, l.description_text)
          }
        }
      }

      // Monta as aberturas para a função do banco.
      let descSem = 0, semVideo = 0, incerta = 0, semRegistro = 0, labFalhou = 0
      const origens: OrigemGravavel[] = []
      let retoques = 0
      const abrir = plano.abrir.map(a => {
        const item = montarAbertura(a, lab, textos.get(`${a.ytId}|${a.hash}`) ?? null)
        origens.push(item.origem)
        if (a.campo === 'desc' && item.json.value_text === null) descSem++
        if (item.origemSemVideo) semVideo++
        if (item.incerta) incerta++
        if (item.semRegistro) semRegistro++
        if (item.labFalhou) labFalhou++
        if (a.thumb?.retoque) retoques++
        return item.json
      })
      const touch = plano.confirmar.map(x => ({ id: x.id, seen_at: x.vistaEm }))

      const resp = await comPrazo(
        Promise.resolve(ctx.supabase.rpc('yt_own_versions_apply_day', { p_channel_id: c.id, p_site_id: c.site_id, p_day: dia, p_touch: touch, p_open: abrir })),
        ctx.deadline,
      )
      if (resp === null) { resumo.sem_tempo = true; resumo.dia_sem_resposta.push(dia); paradoPorTempo = true; break }
      if (resp.error) {
        pushUnico(ctx.falhas, `versões: ${c.name} não gravou o dia ${dia} (${codigoDoErro(resp.error)})`)
        paradoPorErro = true
        break
      }
      const out = (resp.data ?? {}) as { resultado?: string; confirmadas?: number; abertas?: number }
      if (out.resultado === 'ja_derivado') {
        resumo.ja_derivado++
      } else {
        resumo.dias_derivados++
        resumo.cobertos_sem_linha += f.repetidos.size + f.cobertos_sem_linha
        derivadosAqui++
        resumo.confirmadas += plano.confirmar.length
        for (const o of origens) resumo.abertas[o]++
        resumo.retoques += retoques
        resumo.pulados.sem_captura += plano.pulados.sem_captura
        resumo.pulados.sem_dhash += plano.pulados.sem_dhash
        resumo.pulados.privado += plano.pulados.privado
        resumo.desc_sem_texto += descSem
        resumo.origem_sem_video += semVideo
        resumo.origem_ab_incerta += incerta
        resumo.origem_ab_sem_registro += semRegistro
        labIlegivelTrocas += labFalhou
      }
      derivadoAte = dia
      temEstado = true
      for (const l of doDia) if (l.privacy_status !== null) privVista.set(l.youtube_video_id, l.privacy_status)
      for (const l of doDia) ultimas.set(l.youtube_video_id, l) // a "última" anda em memória, dia a dia

      // Atualiza as correntes: em memória se não houve abertura; relendo do banco se houve (os ids nascem lá) ou se já estava derivado.
      if (out.resultado !== 'ja_derivado' && plano.abrir.length === 0) {
        correntes = aplicarPlanoNasCorrentes(correntes, plano, dia)
      } else {
        const r = await lerCorrentes()
        if (r === 'sem_tempo') { resumo.sem_tempo = true; paradoPorTempo = true; break }
        if (r === null) { paradoPorErro = true; break }
        correntes = r
      }
    }

    // 7. atraso
    const base = derivadoAte ?? addDays(menorDia ?? ini, -1)
    const atraso = diffDias(base, ontem)
    const recuperavel = (paradoPorTempo || noTeto) && !paradoPorErro && derivadosAqui >= 2
    registrarAtraso(c, base, recuperavel, atraso)
  }

  /** Sem tempo antes de derivar qualquer dia: com estado, o atraso é conhecido; sem estado, conta do menor `day_pt` se já o temos. */
  function semDia(c: ColetaChannel, derivadoAte: string | null, menorDia: string | null, temEstado: boolean): void {
    if (temEstado && derivadoAte !== null) registrarAtraso(c, derivadoAte, false)
    else if (menorDia !== null) registrarAtraso(c, addDays(menorDia, -1), false)
    else resumo.atraso_desconhecido.push(c.id)
  }

  function registrarAtraso(c: ColetaChannel, base: string, recuperavel: boolean, atrasoPronto?: number): void {
    const atraso = atrasoPronto ?? diffDias(base, ontem)
    resumo.atraso_dias[c.id] = atraso
    semAtraso.add(c.id)
    if (atraso <= 1) return
    if (recuperavel) { resumo.recuperando[c.id] = atraso; return }
    pushUnico(ctx.falhas, `versões: ${c.name} conferido até ${base}, ${atraso} dias de atraso`)
  }

  /** A/B Lab do canal, uma vez: testes de todos os vídeos com linha no intervalo e ciclos que começaram dentro dele. */
  async function lerLab(linhas: LinhaDia[], correntes: CorrenteDoCampo[]): Promise<LeituraAb | 'sem_tempo'> {
    const ilegivel = (): LeituraAb => ({ ok: false })
    const uuids = [...new Set(linhas.map(l => l.video_id).filter((v): v is string => v !== null))]
    if (uuids.length === 0) return { ok: true, testes: [], ciclos: [] }
    const t = await uma<TesteLinha[]>(
      ctx.supabase.from('ab_tests')
        .select('id, youtube_video_id, test_type, paused_at, completed_at, completed_reason, winner_variant_id, winner_applied_at, original_title, restore_status')
        .in('youtube_video_id', uuids).limit(TETO_AB),
    )
    if (t === null) return 'sem_tempo'
    if (t.error || t.data === null) return ilegivel()
    if (t.data.length >= TETO_AB) return ilegivel()
    const testes: TesteAb[] = []
    for (const x of t.data) {
      const rs = lerRestoreStatus(x.restore_status)
      if (!rs.ok) return ilegivel()
      testes.push({
        id: x.id, videoId: x.youtube_video_id, tipo: x.test_type, pausadoEm: x.paused_at, concluidoEm: x.completed_at,
        vencedorAplicadoEm: x.winner_applied_at, tituloOriginal: x.original_title, motivoConclusao: x.completed_reason,
        varianteVencedora: x.winner_variant_id, mundoNovo: rs.mundoNovo, emAndamento: rs.emAndamento,
      })
    }
    if (testes.length === 0) return { ok: true, testes, ciclos: [] }
    // Janela dos ciclos: do menor `last_seen_at` das correntes dos vídeos COM linha no intervalo até a maior captura do intervalo.
    const ytComLinha = new Set(linhas.map(l => l.youtube_video_id))
    const vistas = correntes.filter(x => ytComLinha.has(x.ytId)).map(x => x.vistaAte)
    const capturas = linhas.map(l => l.captured_at)
    const de = [...vistas, ...capturas].reduce((m, x) => (Date.parse(x) < Date.parse(m) ? x : m))
    const ate = capturas.reduce((m, x) => (Date.parse(x) > Date.parse(m) ? x : m))
    const ci = await uma<CicloLinha[]>(
      ctx.supabase.from('ab_test_cycles').select('id, test_id, variant_id, started_at, applied_metadata')
        .in('test_id', testes.map(x => x.id)).gte('started_at', de).lte('started_at', ate).limit(TETO_AB),
    )
    if (ci === null) return 'sem_tempo'
    if (ci.error || ci.data === null) return ilegivel()
    if (ci.data.length >= TETO_AB) return ilegivel()
    const ciclos: CicloAb[] = ci.data.map(x => ({
      testId: x.test_id, variantId: x.variant_id, iniciadoEm: x.started_at,
      tituloAplicado: typeof x.applied_metadata?.title_set === 'string' ? x.applied_metadata.title_set : null,
      thumbAplicada: x.applied_metadata?.thumbnail_set === true,
    }))
    // Histórico de restaurações (emenda 15/10): mesma janela, alargada em 120 s no início só para o "registro existe" da R6.
    const deRestauros = new Date(Date.parse(de) - FOLGA_REGISTRO_MS).toISOString()
    const re = await uma<RestauroLinha[]>(
      ctx.supabase.from('ab_test_restores').select(COLUNAS_RESTAUROS)
        .in('test_id', testes.map(x => x.id)).gte('em', deRestauros).lte('em', ate).order('em', { ascending: false }).limit(TETO_AB),
    )
    if (re === null) return 'sem_tempo'
    if (re.error || re.data === null) return ilegivel() // inclusive 42P01: erro nunca vira lista vazia (lista vazia = mundo antigo)
    if (re.data.length >= TETO_AB) return ilegivel()
    const restauros: RestauroAb[] = []
    for (const x of re.data) {
      const campo = x.campo === 'title' ? 'title' : x.campo === 'thumbnail' ? 'thumb' : null
      if (campo === null || !ESTADOS_RESTAURO.includes(x.estado) || !instanteLegivel(x.em)) return ilegivel()
      if (x.escreveu !== null && typeof x.escreveu !== 'boolean') return ilegivel()
      restauros.push({ testId: x.test_id, seq: x.seq, campo, destino: x.destino, estado: x.estado as RestauroAb['estado'], escreveu: x.escreveu, em: x.em, ...(x.iniciativa === 'dono' ? { iniciativa: 'dono' as const } : {}) })
    }
    return { ok: true, testes, ciclos, restauros }
  }

  /** Uma abertura em JSON para `apply_day`, com a origem já atribuída. */
  function montarAbertura(a: AberturaSemOrigem, lab: LeituraAb | null, textoDesc: string | null): {
    json: Record<string, unknown>; origem: OrigemGravavel; origemSemVideo: boolean; incerta: boolean; semRegistro: boolean; labFalhou: boolean
  } {
    let origem: OrigemGravavel = 'linha_de_base'
    let ev: string | null = null, testId: string | null = null, varId: string | null = null, instante: string | null = null
    let incerta = false, semRegistro = false, labFalhou = false, origemSemVideo = false
    if (a.precisao !== 'first') {
      const lei: LeituraAb = lab ?? { ok: false }
      const o = atribuirOrigem(a, lei)
      origem = o.origem; ev = o.eventoAb; testId = o.abTestId; varId = o.abVariantId; instante = o.instante
      incerta = o.incerta === true
      semRegistro = o.semRegistro === true
      labFalhou = !lei.ok
      origemSemVideo = lei.ok && a.videoId === null
    }
    const noLab = origem === 'ab_lab' && instante !== null
    const json: Record<string, unknown> = {
      youtube_video_id: a.ytId,
      video_id: a.videoId,
      field: a.campo,
      value_text: a.campo === 'title' ? a.tituloOuNulo : a.campo === 'desc' ? textoDesc : null,
      value_hash: a.hash,
      thumb_dhash: a.thumb?.dhash ?? null,
      thumb_anchor_dhash: a.thumb?.ancoraDhash ?? null,
      thumb_sha256: a.thumb?.sha256 ?? null,
      thumb_blob_url: a.thumb?.blobUrl ?? null,
      thumb_similar: a.thumb?.retoque ?? false,
      first_seen_at: noLab ? instante : a.capturadoEm,
      seen_at: a.capturadoEm,
      window_start: noLab ? instante : (a.janela?.de ?? null),
      window_end: noLab ? instante : (a.janela?.ate ?? null),
      window_precision: noLab ? 'min' : a.precisao,
      origin: origem,
      ab_event: ev,
      ab_test_id: testId,
      ab_variant_id: varId,
    }
    return { json, origem, origemSemVideo, incerta, semRegistro, labFalhou }
  }

  // ── notas finais do resumo ─────────────────────────────────────────────────────────────────────────
  if (labIlegivelTrocas > 0) {
    pushUnico(ctx.falhas, `versões: A/B Lab não pôde ser lido; origem de ${labIlegivelTrocas} troca(s) ficou sem resposta`)
  }
  if (resumo.origem_ab_sem_registro > 0) {
    pushUnico(ctx.falhas, `versões: ${resumo.origem_ab_sem_registro} troca(s) com parada do A/B Lab sem registro de restauração`)
  }
  if (resumo.desc_sem_texto > 0) {
    pushUnico(ctx.falhas, `versões: ${resumo.desc_sem_texto} versão(ões) de descrição sem o texto guardado`)
  }

  const algumRecuperando = Object.keys(resumo.recuperando).length > 0
  if (resumo.atraso_desconhecido.length > 0 && !algumRecuperando) {
    pushUnico(ctx.falhas, `versões: ${resumo.atraso_desconhecido.length} canal(is) sem tempo para saber o atraso`)
  }

  // ── prova diária, por site ─────────────────────────────────────────────────────────────────────────
  if (!parouPorSchema) {
    const sites = [...new Set(ctx.channels.map(c => c.site_id))]
    for (const site of sites) {
      const doSite = ctx.channels.filter(c => c.site_id === site)
      const recSite = doSite.some(c => resumo.recuperando[c.id] !== undefined)
      const r = await comPrazo(Promise.resolve(ctx.supabase.rpc('yt_own_versions_prova', { p_site_id: site, p_ontem: ontem })), ctx.deadline)
      if (r === null) {
        resumo.prova[site] = 'sem_tempo'
        resumo.sem_tempo = true
        if (!recSite) pushUnico(ctx.falhas, 'critérios: não foi possível avaliar a prova das versões')
        continue
      }
      if (r.error || r.data === null || typeof r.data !== 'object') {
        pushUnico(ctx.falhas, 'critérios: não foi possível avaliar a prova das versões')
        continue
      }
      const p = r.data as { publicos?: number; sem_explicacao?: number; canais_com_linha_sem_estado?: number; origem_cms?: number }
      resumo.prova[site] = p
      if ((p.sem_explicacao ?? 0) > 0 && !recSite) {
        pushUnico(ctx.falhas, `versões: ${p.sem_explicacao} vídeo(s) público(s) sem título ou thumbnail conferidos em 2 dias e sem tentativa que explique`)
      }
      if ((p.origem_cms ?? 0) > 0) pushUnico(ctx.falhas, 'versões: há versão com origem reservada (cms)')
      if ((p.canais_com_linha_sem_estado ?? 0) > 0 && !recSite) {
        pushUnico(ctx.falhas, `versões: ${p.canais_com_linha_sem_estado} canal(is) com linha diária e sem estado de derivação`)
      }
      // Ausência não é "zero vídeos públicos": havendo vídeos cadastrados e linha capturada, zero públicos é defeito.
      if (p.publicos === 0 && doSite.some(c => comCaptura.has(c.id))) {
        pushUnico(ctx.falhas, `versões: a prova não achou vídeo público em ${site}`)
      }
    }
  }

  return resumo
}

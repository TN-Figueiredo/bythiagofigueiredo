// Passo `normalizadores` (A5 · E11, Tarefa 8). Só banco: lê o bruto que o passo de relatórios já baixou, dos dois tipos
// novos (origem de tráfego com detalhe e alcance por origem/aparelho/sistema), e chama a função do banco que apaga o dia
// do canal, grava, estende a cobertura e marca `normalized_at` na MESMA transação. Este arquivo nunca marca sucesso.
//
// Privacidade: `traffic_source_detail` pode ser termo pesquisado. Ele só viaja dentro de `p_rows` (o que o plano autoriza).
// Nenhuma nota, tentativa, coluna `error` ou evento do Sentry leva texto de exceção do banco ou do leitor: grava-se um
// CÓDIGO de catálogo (`MOTIVOS_NORMALIZADOR`) e a frase sai de `motivoNormalizadorHumano`.
// Quem decide "o mais novo vence" é a função do banco: ela só devolve `superado` quando o mais novo JÁ foi normalizado.
import * as Sentry from '@sentry/nextjs'
import { gunzipSync } from 'node:zlib'
import { deBytea } from '@/lib/youtube/reporting/client'
import { motivoNormalizadorHumano, rotuloAparelho, rotuloOrigem, rotuloSistema, type MotivoNormalizador } from '@/lib/youtube/reporting/codigos'
import {
  agregarAlcanceCombinado, CsvAlcanceCombinadoError, lerAlcanceCombinado,
} from '@/lib/youtube/reporting/reach-combined-csv'
import { agregarTrafego, CsvTrafegoError, lerTrafego } from '@/lib/youtube/reporting/traffic-source-csv'
import { registrarTentativa, contarPorResultado } from './attempts'
import { comPrazo, restante } from './clock'
import { FOLGA_PARA_COMECAR_MS, TIPOS_E11 } from './e11-config'
import type { AttemptKind } from './kinds'
import { metricVersion } from './metric-version'
import { lerPaginado } from './paginar'
import { passoDesligado } from './passos-desligados'
import { conferirBanco, pushUnico, type ErroBanco } from './schema'
import type { ColetaChannel, Outcome, StepCtx, StepResumo } from './types'

/** Teto de relatórios por execução. Não reaproveita o do passo de alcance (`MAX_NORMALIZAR` de alcance-step.ts). */
export const MAX_NORMALIZAR_E11 = 200
const MAX_VIDEOS_LIDOS = 1000
const MAX_BRUTO_BYTES = 64 * 1024 * 1024
/**
 * Violação de chave, de regra da tabela e de texto inválido: erro de CONTEÚDO, não de infraestrutura.
 * `P0001` é todo `raise exception` das funções SQL (relatório com mais de 25 h, estado inesperado, dia diferente):
 * determinístico, repetir não muda nada. Desvio decidido da letra do plano ("qualquer outro erro fica na fila"):
 * sem isso o relatório ficaria na frente da fila e vermelho todo dia, sem motivo e sem fim.
 */
const CODIGOS_DE_CONTEUDO: readonly string[] = ['23505', '23514', '22P02', 'P0001']
/** O único motivo fixo de `motivo.ts` que a coluna `error` da tentativa aceita para "relatório em erro" (ver a Tarefa 8 do plano). */
const MOTIVO_DA_TENTATIVA = 'forma_inesperada'

export type TipoNormalizado = 'detalhe' | 'alcance_dim'

export interface ResumoDoTipo {
  /** Relatórios com linha gravada. */
  normalizados: number
  /** Relatórios lidos e conferidos sem nenhuma linha para gravar (só cabeçalho, ou tudo zerado): LIDOS e vazios, não "não li". */
  vazios: number
  /** Relatórios que a função devolveu como `superado` (já havia um mais novo normalizado). */
  superados: number
  /** Relatórios que viraram `erro` nesta execução. */
  erros: number
  /** Vídeos do CSV sem par em youtube_videos (gravados com video_id nulo). */
  sem_par: number
  /** Chaves que somaram zero e não foram enviadas. */
  descartadas_zeradas: number
  /** Códigos de origem, aparelho ou sistema fora do catálogo (um por código e relatório). Gravados como vieram. */
  codigos_fora_do_catalogo: number
}

export interface NormalizadoresResumo extends StepResumo {
  por_tipo: Record<TipoNormalizado, ResumoDoTipo>
  /** Só quando `YT_OWN_STEPS_OFF` lista `normalizadores`: o passo não leu a fila. */
  desligado?: true
}

/** Início da nota que o passo anota quando marca um relatório como `erro`. */
export const prefixoNotaErroNormalizador = (reportId: string): string => `normalizadores: relatório ${reportId} de `

interface Fila {
  report_id: string
  site_id: string
  channel_id: string
  report_type_id: string
  status: string
  create_time: string
  start_time: string | null
}

/** `feito`: o relatório saiu da fila (normalizado, superado ou em erro). `pendente`: volta na próxima execução. `parar`: o passo não tem como seguir. */
type Desfecho = 'feito' | 'pendente' | 'parar'

interface Contagem {
  canal: ColetaChannel
  tipo: TipoNormalizado
  erros: number
  pendentes: number
  paradoPorSchema: boolean
}

const TIPOS: Record<TipoNormalizado, { reportType: string; funcao: string; kind: AttemptKind }> = {
  detalhe: { reportType: TIPOS_E11.detalhe, funcao: 'yt_own_traffic_detail_apply', kind: 'normalizador_trafego' },
  alcance_dim: { reportType: TIPOS_E11.alcance_dim, funcao: 'yt_own_reach_dim_apply', kind: 'normalizador_alcance_dim' },
}

const tipoDoRelatorio = (reportTypeId: string): TipoNormalizado | null =>
  reportTypeId === TIPOS.detalhe.reportType ? 'detalhe' : reportTypeId === TIPOS.alcance_dim.reportType ? 'alcance_dim' : null

const zerado = (): ResumoDoTipo => ({
  normalizados: 0, vazios: 0, superados: 0, erros: 0, sem_par: 0, descartadas_zeradas: 0, codigos_fora_do_catalogo: 0,
})

/** Código do Postgres como vai ao Sentry: só se tiver a forma de um código (nunca o texto). */
const codigoSeguro = (code: unknown): string | null =>
  typeof code === 'string' && /^[A-Za-z0-9]{1,10}$/.test(code) ? code : null

function avisar(codigo: string, reportId: string, pgCode: unknown): void {
  Sentry.captureMessage(`normalizadores: ${codigo}`, {
    tags: { cron: 'sync-analytics-metrics', passo: 'normalizadores' },
    extra: { report: reportId, pg_code: codigoSeguro(pgCode) },
  })
}

/** O dia que o RELATÓRIO cobre: a data UTC do `start_time`. Nulo se ausente ou ilegível. */
function diaDoRelatorio(startTime: string | null): string | null {
  if (typeof startTime !== 'string') return null
  const t = new Date(startTime)
  return Number.isNaN(t.getTime()) ? null : t.toISOString().slice(0, 10)
}

type MapaVideos = Map<string, string>

interface Preparado {
  rows: Array<Record<string, unknown>>
  semPar: string[]
  descartadas: number
  foraDoCatalogo: number
}

/** Cada código fora do catálogo conta uma vez por relatório. */
function contarForaDoCatalogo(pares: Array<[string, boolean]>): number {
  return new Set(pares.filter(([, catalogado]) => !catalogado).map(([chave]) => chave)).size
}

export async function passoNormalizadores(ctx: StepCtx): Promise<NormalizadoresResumo> {
  const resumo: NormalizadoresResumo = {
    gravados: 0, tentativas: {}, pendentes: 0, por_tipo: { detalhe: zerado(), alcance_dim: zerado() },
  }
  if (passoDesligado('normalizadores')) return { ...resumo, desligado: true }
  const canais = new Map<string, ColetaChannel>(ctx.channels.map(c => [c.id, c]))
  if (canais.size === 0) return resumo

  const lida = await ctx.supabase
    .from('yt_reporting_reports')
    .select('report_id, site_id, channel_id, report_type_id, status, create_time, start_time')
    .in('report_type_id', [TIPOS.detalhe.reportType, TIPOS.alcance_dim.reportType])
    .in('status', ['baixado', 'vazio'])
    .is('normalized_at', null)
    .in('channel_id', [...canais.keys()])
    .order('create_time', { ascending: true })
    .order('report_id', { ascending: true })
    .limit(MAX_NORMALIZAR_E11 + 1)
  if (conferirBanco(lida, 'yt_reporting_reports', ctx.falhas, 'ler') !== 'ok') return resumo

  const lidos = ((lida.data ?? []) as Fila[]).filter(r => tipoDoRelatorio(r.report_type_id) !== null && canais.has(r.channel_id))
  const fila = lidos.slice(0, MAX_NORMALIZAR_E11)

  // Uma contagem por canal e tipo que tem relatório na fila: é ela que vira a tentativa no fim.
  const contagens = new Map<string, Contagem>()
  const contagemDe = (rel: Fila): Contagem => {
    const tipo = tipoDoRelatorio(rel.report_type_id)!
    const chave = `${rel.channel_id}|${tipo}`
    let c = contagens.get(chave)
    if (!c) {
      c = { canal: canais.get(rel.channel_id)!, tipo, erros: 0, pendentes: 0, paradoPorSchema: false }
      contagens.set(chave, c)
    }
    return c
  }
  for (const r of fila) contagemDe(r)
  // O excedente exato não é conhecido (a leitura parou em 201): soma 1 e o critério de pendentes conta o resto no banco.
  if (lidos.length > MAX_NORMALIZAR_E11) {
    resumo.pendentes += 1
    contagemDe(lidos[MAX_NORMALIZAR_E11]!).pendentes++
  }

  // Uma leitura de vídeos por canal e execução. `null` = não deu para ler (ou passou do teto): os relatórios do canal esperam.
  const videosPorCanal = new Map<string, MapaVideos | null>()
  const videosDe = async (c: ColetaChannel): Promise<MapaVideos | null> => {
    if (videosPorCanal.has(c.id)) return videosPorCanal.get(c.id)!
    let mapa: MapaVideos | null = null
    const leitura = await lerPaginado<{ youtube_video_id: string; id: string }>(
      (de, ate) => ctx.supabase.from('youtube_videos').select('youtube_video_id, id').eq('channel_id', c.id).order('id', { ascending: true }).range(de, ate),
      MAX_VIDEOS_LIDOS,
    )
    if (leitura.ok) mapa = new Map(leitura.linhas.map(v => [v.youtube_video_id, v.id]))
    else if (leitura.motivo === 'passou_do_teto') {
      pushUnico(ctx.falhas, `normalizadores: vídeos do canal ${c.name} passam do limite de ${MAX_VIDEOS_LIDOS} lidos; a normalização espera`)
    } else pushUnico(ctx.falhas, 'erro de banco ao ler youtube_videos')
    videosPorCanal.set(c.id, mapa)
    return mapa
  }

  /**
   * Marca o relatório como `erro` com o CÓDIGO (nunca texto de exceção). Falha ao marcar: ele continua na fila.
   * A nota deixa o cron vermelho no dia; depois quem avisa é o critério de relatório em erro.
   */
  const marcarErro = async (rel: Fila, codigo: MotivoNormalizador, pgCode: unknown = null): Promise<Desfecho> => {
    const upd = await ctx.supabase.from('yt_reporting_reports').update({ status: 'erro', error: codigo }).eq('report_id', rel.report_id)
    if (conferirBanco(upd, 'yt_reporting_reports', ctx.falhas) !== 'ok') return 'pendente'
    const tipo = tipoDoRelatorio(rel.report_type_id)!
    resumo.por_tipo[tipo].erros++
    contagemDe(rel).erros++
    pushUnico(ctx.falhas, `${prefixoNotaErroNormalizador(rel.report_id)}${canais.get(rel.channel_id)?.name ?? rel.channel_id} não pôde ser normalizado (${motivoNormalizadorHumano(codigo)})`)
    avisar(codigo, rel.report_id, pgCode)
    return 'feito'
  }

  /** Lê, confere e agrega. Devolve o motivo (de conteúdo) ou as linhas prontas para a função. */
  const preparar = (tipo: TipoNormalizado, texto: string, rel: Fila, canal: ColetaChannel, dia: string | null, mapa: MapaVideos):
    { erro: MotivoNormalizador } | { preparado: Preparado } => {
    const noMapa = (id: string) => mapa.get(id)
    const comPar = (id: string) => { const v = noMapa(id); return v ? { video_id: v } : {} }
    try {
      if (tipo === 'detalhe') {
        const lidas = lerTrafego(texto)
        if (lidas.some(l => l.channelId !== canal.channel_id)) return { erro: 'canal_inesperado' }
        if (dia === null || lidas.some(l => l.day !== dia)) return { erro: 'dia_inesperado' }
        const agg = agregarTrafego(lidas)
        return {
          preparado: {
            rows: agg.linhas.map(a => ({
              youtube_video_id: a.videoId, ...comPar(a.videoId), day_pt: a.day, source_type: a.sourceType,
              detail: a.detail, detail_hash: a.detailHash, views: a.views, watch_time_minutes: a.watchTimeMinutes,
              metric_version: metricVersion(a.day),
            })),
            semPar: [...new Set(agg.linhas.filter(a => !mapa.has(a.videoId)).map(a => a.videoId))].sort(),
            descartadas: agg.descartadasZeradas,
            foraDoCatalogo: contarForaDoCatalogo(agg.linhas.map(a => [`origem:${a.sourceType}`, rotuloOrigem(a.sourceType).catalogado])),
          },
        }
      }
      const lidas = lerAlcanceCombinado(texto)
      if (lidas.some(l => l.channelId !== canal.channel_id)) return { erro: 'canal_inesperado' }
      if (dia === null || lidas.some(l => l.day !== dia)) return { erro: 'dia_inesperado' }
      const agg = agregarAlcanceCombinado(lidas)
      return {
        preparado: {
          rows: agg.linhas.map(a => ({
            youtube_video_id: a.videoId, ...comPar(a.videoId), day_pt: a.day, traffic_source_type: a.trafficSourceType,
            device_type: a.deviceType, operating_system: a.operatingSystem, thumbnail_impressions: a.impressions,
            // Nulo, nunca zero: cliques que não puderam ser estimados ficam fora do envio.
            ...(a.clicksEst !== null ? { thumbnail_clicks_est: a.clicksEst } : {}),
            metric_version: metricVersion(a.day),
          })),
          semPar: [...new Set(agg.linhas.filter(a => !mapa.has(a.videoId)).map(a => a.videoId))].sort(),
          descartadas: agg.descartadasZeradas,
          foraDoCatalogo: contarForaDoCatalogo(agg.linhas.flatMap((a): Array<[string, boolean]> => [
            [`origem:${a.trafficSourceType}`, rotuloOrigem(a.trafficSourceType).catalogado],
            [`aparelho:${a.deviceType}`, rotuloAparelho(a.deviceType).catalogado],
            [`sistema:${a.operatingSystem}`, rotuloSistema(a.operatingSystem).catalogado],
          ])),
        },
      }
    } catch (e) {
      if (e instanceof CsvTrafegoError || e instanceof CsvAlcanceCombinadoError) return { erro: e.motivo }
      throw e
    }
  }

  const normalizarUm = async (rel: Fila, canal: ColetaChannel): Promise<Desfecho> => {
    const tipo = tipoDoRelatorio(rel.report_type_id)!
    const { funcao } = TIPOS[tipo]
    const mapa = await videosDe(canal)
    if (!mapa) return 'pendente'

    const bruto = await ctx.supabase.from('yt_reporting_report_blobs').select('csv_gz').eq('report_id', rel.report_id).maybeSingle()
    if (conferirBanco(bruto, 'yt_reporting_report_blobs', ctx.falhas, 'ler') !== 'ok') return 'pendente'
    const csvGz = (bruto.data as { csv_gz: string } | null)?.csv_gz
    if (!csvGz) return marcarErro(rel, 'bruto_ausente')

    let texto: string
    try {
      texto = gunzipSync(deBytea(csvGz), { maxOutputLength: MAX_BRUTO_BYTES }).toString('utf8')
    } catch {
      return marcarErro(rel, 'gzip_invalido')
    }

    const prep = preparar(tipo, texto, rel, canal, diaDoRelatorio(rel.start_time), mapa)
    if ('erro' in prep) return marcarErro(rel, prep.erro)
    const { rows, semPar, descartadas, foraDoCatalogo } = prep.preparado

    let res: { data: unknown; error: ErroBanco | null } | null
    try {
      res = await comPrazo(
        Promise.resolve(ctx.supabase.rpc(funcao, {
          p_report_id: rel.report_id, p_rows: rows, p_unmatched: semPar.length ? { count: semPar.length, ids: semPar } : null,
        })),
        ctx.deadline,
      )
    } catch {
      res = { data: null, error: { code: null, message: 'rpc lançou' } }
    }
    if (res === null) return 'pendente' // sem resposta até o prazo: nada foi marcado, volta primeiro amanhã
    if (res.error) {
      if (res.error.code && CODIGOS_DE_CONTEUDO.includes(res.error.code)) return marcarErro(rel, 'recusado_pelo_banco', res.error.code)
      const escrita = conferirBanco(res, funcao, ctx.falhas)
      if (escrita === 'schema_ausente') {
        contagemDe(rel).paradoPorSchema = true
        return 'parar'
      }
      avisar('erro_de_banco', rel.report_id, res.error.code)
      return 'pendente'
    }

    const dados = res.data as { status?: unknown; gravadas?: unknown } | null
    const status = typeof dados === 'object' && dados !== null ? dados.status : undefined
    if (status !== 'gravado' && status !== 'superado') {
      pushUnico(ctx.falhas, `normalizadores: a função ${funcao} devolveu uma resposta inesperada`)
      return 'pendente'
    }
    const t = resumo.por_tipo[tipo]
    if (status === 'superado') {
      t.superados++
      return 'feito'
    }
    if (rows.length > 0) t.normalizados++
    else t.vazios++
    t.sem_par += semPar.length
    t.descartadas_zeradas += descartadas
    t.codigos_fora_do_catalogo += foraDoCatalogo
    resumo.gravados += typeof dados!.gravadas === 'number' ? dados!.gravadas : 0
    return 'feito'
  }

  const pendente = (rel: Fila): void => {
    resumo.pendentes++
    contagemDe(rel).pendentes++
  }

  for (let i = 0; i < fila.length; i++) {
    const rel = fila[i]!
    if (restante(ctx.deadline) < FOLGA_PARA_COMECAR_MS) {
      for (const resto of fila.slice(i)) pendente(resto)
      break
    }
    const canal = canais.get(rel.channel_id)!
    let desfecho: Desfecho = 'pendente'
    try {
      desfecho = await normalizarUm(rel, canal)
    } catch {
      // Nunca o texto da exceção: pode carregar o conteúdo de uma linha.
      avisar('excecao', rel.report_id, null)
      pushUnico(ctx.falhas, `normalizadores: erro interno ao normalizar o relatório ${rel.report_id}`)
    }
    if (desfecho === 'parar') {
      for (const resto of fila.slice(i)) pendente(resto)
      break
    }
    if (desfecho === 'pendente') pendente(rel)
  }

  // Uma tentativa por canal e tipo, no fim: erro_http (algum relatório em erro) > schema ausente > sobrou fila > ok.
  for (const c of contagens.values()) {
    const { kind } = TIPOS[c.tipo]
    let outcome: Outcome = 'ok'
    let error: string | null = null
    if (c.erros > 0) { outcome = 'erro_http'; error = MOTIVO_DA_TENTATIVA }
    else if (c.paradoPorSchema) outcome = 'schema_ausente'
    else if (c.pendentes > 0) outcome = 'nao_alcancado_orcamento'
    await registrarTentativa(ctx, { site_id: c.canal.site_id, scope_type: 'canal', scope_id: c.canal.id, kind, outcome, error, channel_id: c.canal.id })
  }
  resumo.tentativas = contarPorResultado(ctx.tentativas, [TIPOS.detalhe.kind, TIPOS.alcance_dim.kind])
  return resumo
}

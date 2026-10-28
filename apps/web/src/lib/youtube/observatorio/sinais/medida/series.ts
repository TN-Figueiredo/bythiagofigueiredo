// F2b T3, borda da medida D2: lê as séries JÁ COLETADAS (R1 diário, R2 alcance, R3 alcance por origem, R4 origem, R5 detalhe) dos vídeos nossos
// e devolve, por métrica e vídeo, o estado de cada dia (`EstadoValor`, de `dimensoes-estado.ts`). Nenhum leitor, régua ou extrator paralelo
// (§3.7): as consultas são as de `proprio/consultas.ts`, extraídas dos leitores das telas, e o estado do dia é o `estadoDoDia` deles.
// Cobertura vem de `yt_own_video_coverage` (por vídeo e conjunto) e, para R2, dos relatórios `baixado|vazio` JÁ NORMALIZADOS
// (`normalized_at`, como `ler-dimensoes.ts:343`). `yt_own_collection_attempts` NÃO é fonte de cobertura (podada aos 90 dias).
// Sem linha NUNCA é zero por si só: R1 e R2 sem limiar de privacidade (dia coberto sem linha = 0 medido), R3/R4 pelo limiar (`soma` vs `base`),
// R5 é top-N (ausência = "não apareceu", nunca views 0). Privacidade: R5 lê só `source_type = '7'` e só os `detail` pedidos, e o texto
// nunca sai daqui (a comparação é por id e a saída é contagem de dias).
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays } from '../../../coleta/day-pt'
import { DIMENSOES_DESDE, LOTE_DESDE } from '../../../coleta/e11-config'
import {
  TETO_VIDEOS_CONSULTA, lerBaseDiaria, lerCobertura, lerDetalheDiario, lerDimDiaria, lerReachBase, lerReachDimDiaria, lerRelatorios,
  type AlvoConsulta, type Leitura,
} from '../../proprio/consultas'
import { TIPO_ALCANCE } from '../../proprio/tipos'
import { estadoDoDia, type EstadoValor, type LinhaBasica, type ParamsDoDia } from '../../proprio/dimensoes-estado'
import { somarJanela, type CoberturaDeFecho, type MotivoSoma, type SomaJanela } from './janela'
import { CODIGO_DA_METRICA, FONTE_DA_METRICA, type FonteD2, type MetricaD2 } from './regra-d2'

/** Linhas por chamada à tabela (um bloco de 50 vídeos numa faixa de até ~6 meses, com aparelho e sistema); acima lança. */
const TETO_LINHAS_SERIES = 400_000
const SEPARADOR = '\u0001'
/** Origem do detalhe que a prova direta lê (`RELATED_VIDEO`): nunca o texto de busca (`source_type = '5'`). */
const ORIGEM_DETALHE_RELATED = CODIGO_DA_METRICA.prova_related

/** Fração mínima dos vídeos do braço que precisa somar (pré e pós) para a métrica ser `medido`; abaixo vira `nao_medido`. */
export const PISO_BRACO = 0.8
export type SomaBraco =
  | { pre: number; pos: number; videosMedidos: number; videosTotal: number }
  | { nao_medido: MotivoSoma; diasSemCobertura: number }

export interface FaixaDeDias { de: string; ate: string }

export interface PedidoSeries {
  siteId: string
  /** ids do YouTube dos vídeos nossos (união dos braços) */
  ytIds: readonly string[]
  /** as janelas de todos os pares do dia (pré, pós e placebos): uma ida por fonte e por faixa contígua */
  faixas: readonly FaixaDeDias[]
  /** ids do YouTube dos outliers a procurar no detalhe (R5); vazio = R5 não é lido */
  outliersYt?: readonly string[]
}

const chave = (...p: string[]): string => p.join(SEPARADOR)

/** Contagem nunca é negativa: nulo, vazio, não finito e negativo viram nulo (a linha existe, o número não veio). */
function num(x: unknown): number | null {
  let n: number | null = null
  if (typeof x === 'number') n = Number.isFinite(x) ? x : null
  else if (typeof x === 'string' && x.trim() !== '') { const v = Number(x); n = Number.isFinite(v) ? v : null }
  return n !== null && n < 0 ? null : n
}

function diaUtc(ts: unknown): string | null {
  if (typeof ts !== 'string') return null
  const t = new Date(ts).getTime()
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null
}

/** Junta faixas que se tocam ou se sobrepõem (dia seguinte conta como tocar). */
export function juntarFaixas(faixas: readonly FaixaDeDias[]): FaixaDeDias[] {
  const ord = [...faixas].sort((a, b) => (a.de < b.de ? -1 : a.de > b.de ? 1 : 0))
  const out: FaixaDeDias[] = []
  for (const f of ord) {
    const ult = out[out.length - 1]
    if (ult && f.de <= addDays(ult.ate, 1)) { if (f.ate > ult.ate) ult.ate = f.ate }
    else out.push({ ...f })
  }
  return out
}

const blocos = <T>(l: readonly T[], n: number): T[][] => Array.from({ length: Math.ceil(l.length / n) }, (_, i) => l.slice(i * n, (i + 1) * n))

/** Tabela ausente (migration não aplicada) não vira "zero": a medida para (a tarefa traduz em `schema_ausente`). */
class SchemaAusente extends Error {
  constructor(readonly tabela: string) { super(`schema ausente: ${tabela}`); this.name = 'SchemaAusenteDaMedida' }
}
function exigir<T>(tabela: string, l: Leitura<T>): T[] {
  if (l.ausente) throw new SchemaAusente(tabela)
  return l.linhas
}
export const ehSchemaAusenteDaMedida = (e: unknown): boolean => e instanceof SchemaAusente

type Intervalo = { de: string; ate: string }

export class SeriesDoSite {
  /** @internal montado por `lerSeriesDoSite` */
  constructor(private readonly d: {
    cobertura: Map<string, Intervalo[]>
    canalDe: Map<string, string>
    base: Map<string, number | null>
    impressoes: Map<string, number | null>
    impressoesNulas: Set<string>
    diasComRelatorio: Map<string, Set<string>>
    fimDeRelatorio: Map<string, string>
    alcanceDim: Map<string, LinhaBasica[]>
    origem: Map<string, LinhaBasica[]>
    detalhe: Set<string>
  }) {}

  private cobre(yt: string, conjunto: string, dia: string): boolean {
    return (this.d.cobertura.get(chave(yt, conjunto)) ?? []).some(i => i.de <= dia && dia <= i.ate)
  }
  private relatorioCobre(yt: string, dia: string): boolean {
    const canal = this.d.canalDe.get(yt)
    return canal !== undefined && (this.d.diasComRelatorio.get(canal)?.has(dia) ?? false)
  }

  /**
   * R1 e R2: sem limiar de privacidade. Dia coberto sem linha = 0 medido; linha com número nulo ou negativo = `valor` sem número
   * (a linha existe e o número não veio: `sem_valor` na soma, nunca zero).
   */
  private estadoSemLimiar(coberto: boolean, k: string, linha: Map<string, number | null>): EstadoValor {
    if (!coberto) return { tipo: 'nao_medido', motivo: 'fora_da_cobertura', desde: null }
    if (!linha.has(k)) return { tipo: 'zero_medido' }
    return { tipo: 'valor', views: linha.get(k) ?? null, minutos: null }
  }

  /** O estado de um dia para (métrica, vídeo). `prova_related` não passa por aqui (presença: `presenca`). */
  estado(metrica: Exclude<MetricaD2, 'prova_related'>, yt: string, dia: string): EstadoValor {
    const k = chave(yt, dia)
    const fonte = FONTE_DA_METRICA[metrica]
    if (fonte === 'R1') return this.estadoSemLimiar(this.cobre(yt, 'base', dia), k, this.d.base)
    if (fonte === 'R2') {
      return this.estadoSemLimiar(this.relatorioCobre(yt, dia), k, this.d.impressoes)
    }
    if (fonte === 'R3') {
      const codigo = CODIGO_DA_METRICA[metrica as 'impressoes_busca']
      const p: ParamsDoDia = {
        coberto: this.cobre(yt, 'alcance_dim', dia),
        baseMedida: this.relatorioCobre(yt, dia) && !this.d.impressoesNulas.has(k),
        base: this.d.impressoesNulas.has(k) ? null : this.d.impressoes.get(k) ?? null,
        antesDoInicio: dia < LOTE_DESDE,
        desde: LOTE_DESDE,
        linhas: this.d.alcanceDim.get(k) ?? [],
      }
      return this.estadoDoCodigo(p, `${codigo}|`)
    }
    // R4: referência = views de R1 do mesmo vídeo e dia
    const p: ParamsDoDia = {
      coberto: this.cobre(yt, 'trafego', dia),
      baseMedida: this.cobre(yt, 'base', dia) && this.d.base.get(k) !== null,
      base: this.d.base.get(k) ?? null,
      antesDoInicio: dia < DIMENSOES_DESDE,
      desde: DIMENSOES_DESDE,
      linhas: this.d.origem.get(k) ?? [],
    }
    return this.estadoDoCodigo(p, `${CODIGO_DA_METRICA[metrica as 'views_busca']}`, true)
  }

  /**
   * Um código dentro do conjunto (R3-4): o valor de R3 é composto `tipo|aparelho|sistema`, então somam-se as linhas do dia cujo valor
   * começa por `codigo|` e usa-se o estado do dia (`soma` vs `base`, TODAS as linhas): sem linha do código e `soma < base` é `limiar`.
   */
  private estadoDoCodigo(p: ParamsDoDia, prefixo: string, exato = false): EstadoValor {
    const dia = estadoDoDia(p)
    const dele = p.linhas.filter(l => (exato ? l.valor === prefixo : l.valor.startsWith(prefixo)))
    if (dele.length === 0) return dia.de(SEPARADOR + 'sem-linha')
    const e = dia.de(dele[0]!.valor)
    if (e.tipo !== 'valor') return e
    const nulo = dele.some(l => l.views === null)
    return { tipo: 'valor', views: nulo ? null : dele.reduce((s, l) => s + (l.views ?? 0), 0), minutos: null }
  }

  estadoDe(metrica: Exclude<MetricaD2, 'prova_related'>, yt: string): (dia: string) => EstadoValor {
    return dia => this.estado(metrica, yt, dia)
  }

  /** A soma da métrica de UM vídeo na janela. */
  somar(metrica: Exclude<MetricaD2, 'prova_related'>, yt: string, dias: string[]): SomaJanela {
    return somarJanela(new Map(), dias, this.estadoDe(metrica, yt))
  }

  /**
   * A soma da métrica de um braço (vários vídeos), pré e pós JUNTOS: só entra o vídeo que soma nas DUAS janelas (senão pré e pós
   * seriam populações diferentes). Os que não somam ficam de fora e viram `videosMedidos < videosTotal`; abaixo do piso
   * (`PISO_BRACO`) o braço é `nao_medido` com o motivo mais forte entre os que falharam (cobertura > em_revisao > sem_valor > limiar)
   * e `diasSemCobertura` em VÍDEO-DIAS (soma dos dias que não somaram, em todos os vídeos que falharam).
   */
  somarBraco(metrica: Exclude<MetricaD2, 'prova_related'>, ytIds: readonly string[], pre: string[], pos: string[]): SomaBraco {
    const ordem = ['cobertura', 'em_revisao', 'sem_valor', 'limiar'] as const
    let somaPre = 0
    let somaPos = 0
    let entraram = 0
    let forte: number = ordem.length // índice do motivo mais forte visto (0 = cobertura); `ordem.length` = nenhum
    let dias = 0
    for (const yt of ytIds) {
      const a = this.somar(metrica, yt, pre)
      const b = this.somar(metrica, yt, pos)
      if ('soma' in a && 'soma' in b) { somaPre += a.soma; somaPos += b.soma; entraram++; continue }
      for (const r of [a, b]) {
        if ('soma' in r) continue
        forte = Math.min(forte, ordem.indexOf(r.nao_medido))
        dias += r.diasSemCobertura
      }
    }
    if (ytIds.length === 0) return { nao_medido: 'cobertura', diasSemCobertura: 0 }
    if (entraram / ytIds.length < PISO_BRACO) {
      return { nao_medido: forte === ordem.length ? 'cobertura' : ordem[forte]!, diasSemCobertura: dias }
    }
    return { pre: somaPre, pos: somaPos, videosMedidos: entraram, videosTotal: ytIds.length }
  }

  /**
   * R5 (top-N): em quantos dias o outlier apareceu no detalhe `RELATED_VIDEO` do nosso vídeo, e em quantos o dia não estava coberto.
   * Dia coberto sem a linha do outlier é "não apareceu", NUNCA views 0. `pos` de `prova_related` = soma de `apareceu` sobre os vídeos do braço.
   */
  presenca(yt: string, outlierYt: string, dias: string[]): { apareceu: number; semCobertura: number } {
    let apareceu = 0
    let semCobertura = 0
    for (const dia of dias) {
      if (!this.cobre(yt, 'detalhe', dia) || dia < LOTE_DESDE) semCobertura++
      else if (this.d.detalhe.has(chave(yt, dia, outlierYt))) apareceu++
    }
    return { apareceu, semCobertura }
  }

  /**
   * Até onde a fonte está coberta NO BRAÇO (Yannis I3): o MÍNIMO entre os vídeos do braço, para esperar o mais atrasado (até `pub + 60`,
   * depois a tarefa desiste). Analytics = `covered_to` do vídeo no conjunto; reporting (R2) = fim do relatório normalizado do canal do vídeo;
   * R3/R5 = `covered_to` do vídeo + 1. Vídeo sem nenhuma cobertura da fonte não segura o fecho (ele já conta como falha no piso do braço);
   * braço sem nenhuma cobertura = nulo.
   */
  coberturaDeFechoDoBraco(fonte: FonteD2, ytIds: readonly string[]): CoberturaDeFecho {
    const mais1 = (d: string | null): string | null => (d === null ? null : addDays(d, 1))
    const ateVideo = (yt: string, conjunto: string): string | null => {
      let m: string | null = null
      for (const i of this.d.cobertura.get(chave(yt, conjunto)) ?? []) if (m === null || i.ate > m) m = i.ate
      return m
    }
    const minimo = (l: Array<string | null>): string | null => {
      const v = l.filter((x): x is string => x !== null)
      return v.length === 0 ? null : v.reduce((a, b) => (a < b ? a : b))
    }
    const analytics = (conjunto: string): string | null => minimo(ytIds.map(yt => ateVideo(yt, conjunto)))
    if (fonte === 'R1') return { ateReporting: null, ateAnalytics: analytics('base') }
    if (fonte === 'R4') return { ateReporting: null, ateAnalytics: analytics('trafego') }
    if (fonte === 'R2') {
      return { ateReporting: minimo(ytIds.map(yt => { const c = this.d.canalDe.get(yt); return c === undefined ? null : this.d.fimDeRelatorio.get(c) ?? null })), ateAnalytics: null }
    }
    if (fonte === 'R3') return { ateReporting: mais1(analytics('alcance_dim')), ateAnalytics: null }
    return { ateReporting: mais1(analytics('detalhe')), ateAnalytics: null }
  }
}

/**
 * Lê TUDO o que a medida do dia precisa: uma ida por fonte e por faixa contígua (nunca uma por par), em blocos de 50 vídeos.
 * Tabela ausente lança (`ehSchemaAusenteDaMedida`); erro de banco e teto lançam `ErroLeituraDimensoes` (sem texto do banco).
 */
export async function lerSeriesDoSite(sb: SupabaseClient, p: PedidoSeries): Promise<SeriesDoSite> {
  const ids = [...new Set(p.ytIds)]
  const faixas = juntarFaixas(p.faixas)
  const outliers = [...new Set(p.outliersYt ?? [])]
  const cobertura = new Map<string, Intervalo[]>()
  const canalDe = new Map<string, string>()
  const base = new Map<string, number | null>()
  /** soma por (vídeo, dia); chave presente com nulo = a linha existe e o número não veio */
  const impressoes = new Map<string, number | null>()
  const impressoesNulas = new Set<string>()
  const diasComRelatorio = new Map<string, Set<string>>()
  const fimDeRelatorio = new Map<string, string>()
  const alcanceDim = new Map<string, LinhaBasica[]>()
  const origem = new Map<string, LinhaBasica[]>()
  const detalhe = new Set<string>()
  const alvo = (ytIds: readonly string[], f: FaixaDeDias): AlvoConsulta =>
    ({ siteId: p.siteId, canalId: null, ytIds, de: f.de, ate: f.ate, teto: TETO_LINHAS_SERIES })

  for (const bloco of blocos(ids, TETO_VIDEOS_CONSULTA)) {
    // a cobertura não tem janela: uma ida por bloco
    const cob = exigir('yt_own_video_coverage', await lerCobertura(sb, alvo(bloco, { de: '', ate: '' }), ['base', 'trafego', 'alcance_dim', 'detalhe'], 'channel_id'))
    for (const r of cob as Array<typeof cob[number] & { channel_id?: string }>) {
      const k = chave(r.youtube_video_id, r.metric_set)
      const l = cobertura.get(k) ?? []
      l.push({ de: r.covered_from, ate: r.covered_to })
      cobertura.set(k, l)
      if (typeof r.channel_id === 'string') {
        canalDe.set(r.youtube_video_id, r.channel_id)
      }
    }
    for (const f of faixas) {
      const a = alvo(bloco, f)
      const [diario, reach, reachDim, dims] = await Promise.all([
        lerBaseDiaria(sb, a), lerReachBase(sb, a), lerReachDimDiaria(sb, a), lerDimDiaria(sb, a, ['traffic_source']),
      ])
      for (const r of exigir('yt_own_video_daily', diario)) base.set(chave(r.youtube_video_id, r.day_pt), num(r.views))
      for (const r of exigir('yt_own_video_reach_daily', reach)) {
        const v = num(r.thumbnail_impressions)
        const k = chave(r.youtube_video_id, r.day_pt)
        if (v === null) { impressoesNulas.add(k); impressoes.set(k, null) }
        else if (!impressoesNulas.has(k)) impressoes.set(k, (impressoes.get(k) ?? 0) + v)
      }
      for (const r of exigir('yt_own_video_reach_dim_daily', reachDim)) {
        const k = chave(r.youtube_video_id, r.day_pt)
        const l = alcanceDim.get(k) ?? []
        l.push({ valor: `${r.traffic_source_type}|${r.device_type}|${r.operating_system}`, views: num(r.thumbnail_impressions), minutos: null })
        alcanceDim.set(k, l)
      }
      for (const r of exigir('yt_own_video_dim_daily', dims)) {
        if (r.dim_kind !== 'traffic_source') continue
        const k = chave(r.youtube_video_id, r.day_pt)
        const l = origem.get(k) ?? []
        l.push({ valor: r.dim_value, views: num(r.views), minutos: null })
        origem.set(k, l)
      }
      if (outliers.length > 0) {
        const det = await lerDetalheDiario(sb, a, { sourceType: ORIGEM_DETALHE_RELATED, details: outliers })
        for (const r of exigir('yt_own_video_traffic_detail_daily', det)) {
          if (r.source_type === ORIGEM_DETALHE_RELATED) detalhe.add(chave(r.youtube_video_id, r.day_pt, r.detail))
        }
      }
    }
  }

  // R2: os dias com relatório baixado ou vazio JÁ NORMALIZADO, por canal (um relatório baixado e não normalizado não tem linha em reach_daily)
  for (const f of faixas) {
    const rels = exigir('yt_reporting_reports', await lerRelatorios(sb, alvo([], f), TIPO_ALCANCE, 'status, end_time, channel_id'))
    for (const r of rels as Array<typeof rels[number] & { status?: string; end_time?: string; channel_id?: string }>) {
      if (typeof r.channel_id !== 'string' || (r.status !== 'baixado' && r.status !== 'vazio') || r.normalized_at == null) continue
      const dia = diaUtc(r.start_time)
      if (dia === null) continue
      const s = diasComRelatorio.get(r.channel_id) ?? new Set<string>()
      s.add(dia)
      diasComRelatorio.set(r.channel_id, s)
      const fim = diaUtc(r.end_time)
      if (fim !== null && fim > (fimDeRelatorio.get(r.channel_id) ?? '')) fimDeRelatorio.set(r.channel_id, fim)
    }
  }
  return new SeriesDoSite({ cobertura, canalDe, base, impressoes, impressoesNulas, diasComRelatorio, fimDeRelatorio, alcanceDim, origem, detalhe })
}

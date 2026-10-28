// F2b T4: o passo diário da medida D2 ("destino esquentou"). Por site: lê a fila de pares abertos (banco), monta braços e janelas (núcleo puro),
// lê as séries JÁ COLETADAS (`series.ts`, uma vez por site) e grava as linhas fechadas pela função atômica. Nunca emite `volume` nem `base_zero`
// (são do estimador), não importa `estimador.ts` nem `gatilhoD2` (A6/A11) e não toca a F2 (`sinais/gravador.ts`).
// Falha em verde: sem entrada é `d2_sem_entrada`, não "0 pares"; retorno de RPC fora da forma ou `de_outro_site > 0` é `medida_falhou`.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { dayPt, diffDias } from '../../../coleta/day-pt'
import { readAll } from '../../load'
import { BLOCO_DO_IN } from '../leitura'
import { lerProprios } from '../lugares-do-site'
import { REGRA_SINAIS } from '../regra'
import { janelasDoPar, prontoParaFechar } from './janela'
import {
  FONTE_DA_METRICA, REGRA_D2, VERSAO_REGRA_D2, montarPares, contarProprios,
  type MetricaD2, type MetricaLinha, type ParDaFila, type Par, type ProprioD2,
} from './regra-d2'
import { ehSchemaAusenteDaMedida, lerSeriesDoSite, type FaixaDeDias, type SeriesDoSite } from './series'

export type MotivoDoPasso = 'schema_ausente' | 'medida_falhou' | 'sem_prazo'

/** O que o passo precisa da tarefa: cliente, relógio e o fim do prazo (ms contados de `t0`). */
export interface ContextoDoPasso { sb: SupabaseClient; t0: number; agora: () => number; fimMs: number }

/** As chaves do `detalhe`: lista fechada, só números finitos. */
export const CHAVES_DO_DETALHE = [
  'd2_pares_abertos', 'd2_fechados_hoje', 'd2_nao_medidos_hoje', 'd2_eventos_fechados', 'd2_sem_entrada', 'd2_sem_ancora',
  'd2_fora_de_evidence', 'd2_proprios_sem_lugar', 'd2_proprios_fora_do_universo', 'd2_coletando',
] as const
export type ChaveDoDetalhe = (typeof CHAVES_DO_DETALHE)[number]

export interface ResumoD2 {
  detalhe: Record<ChaveDoDetalhe, number>
  /** linhas medidas + não medidas geradas hoje (alvo, ano 0) */
  feitas: number
  /** sites que ficaram sem passar por falta de prazo ou por falha */
  deixadas: number
  motivo?: MotivoDoPasso
}

const METRICAS = Object.keys(FONTE_DA_METRICA) as MetricaD2[]
const JANELA_PARES = REGRA_SINAIS.janelaDias
const ANOS_PLACEBO = [1, 2] as const
const BLOCO_LINHAS = 400

/** Falha da medida com código fechado; o texto nunca sai da tarefa. */
export class ErroDaMedida extends Error {
  constructor(readonly motivo: MotivoDoPasso) { super(motivo); this.name = 'ErroDaMedida' }
}

const SCHEMA_AUSENTE = new Set(['42P01', '42883', 'PGRST202', 'PGRST205'])
export function codigoDoErro(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string' ? err.code.slice(0, 5) : undefined
}
export const ehSchemaAusente = (err: unknown): boolean => ehSchemaAusenteDaMedida(err) || SCHEMA_AUSENTE.has(codigoDoErro(err) ?? '')

const contagemZ = z.object({
  pares_abertos: z.number(), eventos_fechados: z.number(), sem_ancora: z.number(), fora_de_evidence: z.number(), sem_entrada: z.number(),
  v0: z.string().nullable(),
})
const filaZ = z.array(z.object({
  signal_id: z.string(), outlier_video_id: z.string(), canal_id: z.string(), outlier_published_at: z.string(), chave: z.string(),
  metricas_faltantes: z.array(z.string()),
  // braço já fixado na 1ª gravação (T2 revisada): quando vierem, mandam sobre o recálculo do dia
  videos_alvo: z.array(z.string()).nullish(),
  videos_controle: z.array(z.string()).nullish(),
}))
const gravarZ = z.object({
  inseridas: z.number(), ignoradas: z.number(), bracos_inseridos: z.number(), bracos_ignorados: z.number(), de_outro_site: z.number(),
})

async function rpc<T>(sb: SupabaseClient, nome: string, args: Record<string, unknown>, forma: z.ZodType<T>): Promise<T> {
  const { data, error } = await sb.rpc(nome, args)
  if (error) {
    if (SCHEMA_AUSENTE.has((error.code ?? '').slice(0, 5))) throw Object.assign(new Error('schema ausente'), { code: error.code })
    throw new ErroDaMedida('medida_falhou')
  }
  const r = forma.safeParse(data)
  if (!r.success) throw new ErroDaMedida('medida_falhou')
  return r.data
}

interface LinhaEfeito {
  signal_id: string; outlier_video_id: string; canal_id: string; outlier_published_at: string
  papel: 'alvo' | 'controle'; metrica: MetricaLinha; anos_atras: number
  pre: number | null; pos: number | null; estado: 'medido' | 'nao_medido'; motivo: string | null
  dias_sem_cobertura: number | null; versao_regra: string
}
interface Braco {
  signal_id: string; outlier_video_id: string; papel: 'alvo' | 'controle'; anos_atras: number
  chave: string; videos: string[]; chaves_em_evento: string[]
}

type Medida = { estado: 'medido'; pre: number; pos: number } | { estado: 'nao_medido'; motivo: string; dias: number }

const deslocar = (dias: string[], anos: number): string[] => dias.map(d => dayPt(new Date(Date.parse(d + 'T12:00:00Z') - anos * 365 * 86_400_000)))

function medirBraco(series: SeriesDoSite, metrica: MetricaD2, ids: readonly string[], outlierYt: string | null, pre: string[], pos: string[]): Medida {
  if (metrica === 'prova_related') {
    if (outlierYt === null) return { estado: 'nao_medido', motivo: 'outlier_apagado', dias: 0 }
    let apareceu = 0
    let sem = 0
    for (const yt of ids) { const p = series.presenca(yt, outlierYt, pos); apareceu += p.apareceu; sem += p.semCobertura }
    return sem > 0 ? { estado: 'nao_medido', motivo: 'cobertura', dias: sem } : { estado: 'medido', pre: 0, pos: apareceu }
  }
  const a = series.somarBraco(metrica, ids, pre)
  const b = series.somarBraco(metrica, ids, pos)
  if ('soma' in a && 'soma' in b) return { estado: 'medido', pre: a.soma, pos: b.soma }
  const falha = 'soma' in a ? b : a
  if ('soma' in falha) return { estado: 'nao_medido', motivo: 'sem_valor', dias: 0 }
  return { estado: 'nao_medido', motivo: falha.nao_medido, dias: (('soma' in a ? 0 : a.diasSemCobertura)) + (('soma' in b ? 0 : b.diasSemCobertura)) }
}

function linhaDe(par: ParDaFila & { signalId: string; videoId: string; canalId: string }, papel: 'alvo' | 'controle', metrica: MetricaLinha, anos: number, m: Medida): LinhaEfeito {
  const base = {
    signal_id: par.signalId, outlier_video_id: par.videoId, canal_id: par.canalId, outlier_published_at: par.publicadoEm,
    papel, metrica, anos_atras: anos, versao_regra: VERSAO_REGRA_D2,
  }
  return m.estado === 'medido'
    ? { ...base, pre: m.pre, pos: m.pos, estado: 'medido', motivo: null, dias_sem_cobertura: null }
    : { ...base, pre: null, pos: null, estado: 'nao_medido', motivo: m.motivo, dias_sem_cobertura: m.dias }
}

const emBlocos = <T>(l: readonly T[], n: number): T[][] => Array.from({ length: Math.ceil(l.length / n) }, (_, i) => l.slice(i * n, (i + 1) * n))

const evidenciaZ = z.object({ proprios: z.array(z.string()).optional() }).passthrough()
const idDoPar = (signalId: string, videoId: string): string => `${signalId}:${videoId}`

interface SinalRow { id: string; subject_key: string; first_seen_at: string; dispensado_em: string | null; expires_at: string; evidence: unknown }

/**
 * Premissa do arrendamento: a agenda dá UM arrendamento por tarefa e período (`ARRENDAMENTO_TTL_S`, 290 s), então só uma execução de `medida_d2`
 * roda por vez. Se ela falhar, duas execuções concorrentes só repetem trabalho: a gravação é atômica por lote e `on conflict do nothing`, e o
 * braço fica fixo na 1ª gravação. O passo NUNCA grava alvo e controle da mesma métrica em lotes separados (o lote leva o par junto).
 */
export async function medirD2(c: ContextoDoPasso): Promise<ResumoD2> {
  const d: Record<ChaveDoDetalhe, number> = Object.fromEntries(CHAVES_DO_DETALHE.map(k => [k, 0])) as Record<ChaveDoDetalhe, number>
  const r: ResumoD2 = { detalhe: d, feitas: 0, deixadas: 0 }
  // lida na hora da chamada, nunca no import
  if (process.env.OBS_SINAIS_NICHO !== 'on') { d.d2_sem_entrada = 1; return r }

  const restanteMs = (): number => c.fimMs - (c.agora() - c.t0)
  const canais = await readAll<{ site_id: string }>('competitor_channels', () => c.sb.from('competitor_channels').select('id, site_id').order('id'))
  const sites = [...new Set(canais.map(x => x.site_id))]
  const agora = new Date(c.agora())
  const motivos = new Set<MotivoDoPasso>()

  for (let i = 0; i < sites.length; i++) {
    if (restanteMs() <= 0) { r.deixadas += sites.length - i; motivos.add('sem_prazo'); break }
    try {
      await medirSite(c, sites[i]!, agora, restanteMs, r)
    } catch (err) {
      if (ehSchemaAusente(err)) throw err
      r.deixadas++
      motivos.add(err instanceof ErroDaMedida ? err.motivo : 'medida_falhou')
    }
  }
  const ordem: MotivoDoPasso[] = ['medida_falhou', 'sem_prazo']
  const motivo = ordem.find(m => motivos.has(m))
  if (motivo !== undefined) r.motivo = motivo
  return r
}

async function medirSite(c: ContextoDoPasso, siteId: string, agora: Date, restanteMs: () => number, r: ResumoD2): Promise<void> {
  const d = r.detalhe
  const sb = c.sb
  const cont = await rpc(sb, 'niche_signal_medida_contagem', { p_site: siteId, p_janela_dias: JANELA_PARES }, contagemZ)
  d.d2_pares_abertos += cont.pares_abertos
  d.d2_eventos_fechados += cont.eventos_fechados
  d.d2_sem_ancora += cont.sem_ancora
  d.d2_fora_de_evidence += cont.fora_de_evidence
  if (cont.sem_entrada > 0) { d.d2_sem_entrada += 1; return }
  if (cont.pares_abertos > 0) d.d2_coletando = 1

  const fila = await rpc(sb, 'niche_signal_pares_abertos', { p_site: siteId, p_metricas: METRICAS, p_janela_dias: JANELA_PARES }, filaZ)
  if (fila.length === 0) return

  // entradas do núcleo puro
  const proprios = await lerProprios(sb, siteId, agora)
  const lugares = new Map((await readAll<{ video_id: string; chaves: string[] | null }>('video_lugares', () =>
    sb.from('video_lugares').select('video_id, chaves').eq('site_id', siteId).eq('origem', 'proprio').order('video_id'))).map(l => [l.video_id, l.chaves ?? []]))
  const propriosD2: ProprioD2[] = proprios.map(p => ({
    id: p.id, youtubeId: p.youtube_video_id, publicadoEm: p.published_at ?? '', chaves: lugares.get(p.id) ?? [], semLugar: !lugares.has(p.id),
  })).filter(p => p.publicadoEm !== '')
  d.d2_proprios_sem_lugar += contarProprios(propriosD2).semLugar
  const { count: visiveis, error: eVis } = await sb.from('youtube_videos').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('is_hidden', false)
  if (eVis) throw new ErroDaMedida('medida_falhou')
  d.d2_proprios_fora_do_universo += Math.max(0, (visiveis ?? 0) - proprios.length)

  const sinais = await readAll<SinalRow>('niche_signals', () =>
    sb.from('niche_signals').select('id, subject_key, first_seen_at, dispensado_em, expires_at, evidence').eq('site_id', siteId).eq('kind', 'destino').order('id'))
  const sinalPorId = new Map(sinais.map(s => [s.id, s]))
  const idYtDe = new Map(propriosD2.map(p => [p.id, p.youtubeId]))
  const corte = new Date(agora.getTime() - (REGRA_D2.limiteVistosDias + REGRA_D2.preDias + 30) * 86_400_000).toISOString()
  const vistos = await readAll<{ video_id: string; published_at: string; chaves: string[] | null }>('niche_outliers_vistos', () =>
    sb.from('niche_outliers_vistos').select('video_id, published_at, chaves').eq('site_id', siteId).gte('published_at', corte).order('video_id'))
  const vistosPorChave = new Map<string, string[]>()
  for (const v of vistos) for (const k of v.chaves ?? []) { const l = vistosPorChave.get(k) ?? []; l.push(v.published_at); vistosPorChave.set(k, l) }

  const pares: Array<ParDaFila & { signalId: string; videoId: string; canalId: string; faltantes: MetricaD2[] }> = []
  const alvoDeEvidence = new Map<string, string[]>()
  for (const f of fila) {
    const sinal = sinalPorId.get(f.signal_id)
    const id = idDoPar(f.signal_id, f.outlier_video_id)
    const pubMs = Date.parse(f.outlier_published_at)
    const chavesEmEvento = [...new Set(sinais.filter(o => {
      if (o.id === f.signal_id || o.subject_key === f.chave) return false
      const ini = Date.parse(o.first_seen_at)
      const fim = Date.parse(o.dispensado_em ?? o.expires_at)
      return ini <= pubMs + REGRA_D2.posDias * 86_400_000 && fim >= pubMs - REGRA_D2.preDias * 86_400_000
    }).map(o => o.subject_key))].sort()
    pares.push({
      id, chave: f.chave, publicadoEm: f.outlier_published_at, chavesEmEvento,
      signalId: f.signal_id, videoId: f.outlier_video_id, canalId: f.canal_id,
      faltantes: f.metricas_faltantes.filter((m): m is MetricaD2 => (METRICAS as string[]).includes(m)),
    })
    const ev = evidenciaZ.safeParse(sinal?.evidence)
    alvoDeEvidence.set(id, (ev.success ? ev.data.proprios ?? [] : []).map(x => idYtDe.get(x)).filter((x): x is string => x !== undefined))
  }
  const montados = montarPares({
    pares, vistosPorChave, proprios: propriosD2, alvoDeEvidence, v0: cont.v0, hoje: dayPt(agora),
  })
  // braço fixado pela fila (quando a função de banco o devolve) vale mais que o recálculo do dia
  const fixos = new Map(fila.map(f => [idDoPar(f.signal_id, f.outlier_video_id), f] as const))
  for (const par of montados) {
    const f = fixos.get(par.id)
    if (par.descarte === null && f?.videos_alvo && f.videos_alvo.length > 0 && f.videos_controle && f.videos_controle.length > 0) {
      par.alvo = [...f.videos_alvo]
      par.controle = [...f.videos_controle]
    }
  }
  const porId = new Map(pares.map(p => [p.id, p]))

  const linhas: LinhaEfeito[] = []
  /** grupos indivisíveis (alvo + controle da mesma métrica e ano): o lote nunca os separa */
  const grupos: LinhaEfeito[][] = []
  const bracos: Braco[] = []
  const hoje = dayPt(agora)
  const candidatos: Array<{ par: Par; meta: (typeof pares)[number] }> = []
  for (const par of montados) {
    const meta = porId.get(par.id)!
    if (par.descarte !== null) {
      const l = linhaDe(meta, 'alvo', 'par', 0, { estado: 'nao_medido', motivo: par.descarte, dias: 0 })
      linhas.push(l); grupos.push([l])
      continue
    }
    if (diffDias(par.pubDia, hoje) >= REGRA_D2.fechaReportingEmDias) candidatos.push({ par, meta })
  }

  if (candidatos.length > 0) {
    if (restanteMs() <= 0) throw new ErroDaMedida('sem_prazo')
    const faixas: FaixaDeDias[] = []
    const ytIds = new Set<string>()
    for (const { par, meta } of candidatos) {
      const j = janelasDoPar(par.pubDia)
      faixas.push({ de: j.pre[0]!, ate: j.pre[j.pre.length - 1]! }, { de: j.pos[0]!, ate: j.pos[j.pos.length - 1]! })
      if (meta.faltantes.includes('views_total')) {
        for (const n of ANOS_PLACEBO) {
          const pre = deslocar(j.pre, n)
          const pos = deslocar(j.pos, n)
          faixas.push({ de: pre[0]!, ate: pre[pre.length - 1]! }, { de: pos[0]!, ate: pos[pos.length - 1]! })
        }
      }
      for (const yt of [...par.alvo, ...par.controle]) ytIds.add(yt)
    }
    // R5: id do YouTube do outlier (lido em competitor_videos no fecho; ausente = outlier_apagado)
    const outlierYt = new Map<string, string>()
    const precisaR5 = candidatos.filter(x => x.meta.faltantes.includes('prova_related'))
    for (const bloco of emBlocos([...new Set(precisaR5.map(x => x.meta.videoId))], BLOCO_DO_IN)) {
      const rows = await readAll<{ id: string; video_id: string | null }>('competitor_videos', () =>
        sb.from('competitor_videos').select('id, video_id').in('id', bloco).order('id'))
      for (const v of rows) if (v.video_id) outlierYt.set(v.id, v.video_id)
    }
    const series = await lerSeriesDoSite(sb, { siteId, ytIds: [...ytIds], faixas, outliersYt: [...outlierYt.values()] })

    for (const { par, meta } of candidatos) {
      const j = janelasDoPar(par.pubDia)
      const cobertura = (m: MetricaD2) => series.coberturaDeFecho(FONTE_DA_METRICA[m], par.alvo[0]!)
      let gravouAlgo = false
      for (const m of meta.faltantes) {
        const prontidao = prontoParaFechar(par, m, hoje, cobertura(m))
        if (prontidao === 'aguarda') continue
        gravouAlgo = true
        const yt = outlierYt.get(meta.videoId) ?? null
        const anosDe = prontidao === 'desiste' || m !== 'views_total' ? [0] : [0, ...ANOS_PLACEBO]
        for (const n of anosDe) {
          const g: LinhaEfeito[] = []
          for (const papel of ['alvo', 'controle'] as const) {
            const ids = papel === 'alvo' ? par.alvo : par.controle
            g.push(prontidao === 'desiste'
              ? linhaDe(meta, papel, m, 0, { estado: 'nao_medido', motivo: m === 'prova_related' ? 'detalhe_ausente' : 'cobertura', dias: 0 })
              : linhaDe(meta, papel, m, n, medirBraco(series, m, ids, n === 0 ? yt : null, n === 0 ? j.pre : deslocar(j.pre, n), n === 0 ? j.pos : deslocar(j.pos, n))))
          }
          linhas.push(...g); grupos.push(g)
        }
      }
      if (gravouAlgo) {
        for (const papel of ['alvo', 'controle'] as const) {
          for (const anos of [0, ...ANOS_PLACEBO]) {
            if (anos > 0 && !meta.faltantes.includes('views_total')) continue
            bracos.push({
              signal_id: meta.signalId, outlier_video_id: meta.videoId, papel, anos_atras: anos, chave: par.chave,
              videos: papel === 'alvo' ? par.alvo : par.controle, chaves_em_evento: par.chavesEmEvento,
            })
          }
        }
      }
    }
  }

  // contagem do dia: uma por (par, métrica) no papel alvo, ano 0
  for (const l of linhas) {
    if (l.papel !== 'alvo' || l.anos_atras !== 0) continue
    r.feitas++
    if (l.estado === 'medido') d.d2_fechados_hoje++
    else d.d2_nao_medidos_hoje++
  }
  if (linhas.length === 0) return

  if (restanteMs() <= 0) throw new ErroDaMedida('sem_prazo')
  const lotes: LinhaEfeito[][] = []
  for (const g of grupos) {
    const ult = lotes[lotes.length - 1]
    if (ult && ult.length + g.length <= BLOCO_LINHAS) ult.push(...g)
    else lotes.push([...g])
  }
  for (let i = 0; i < lotes.length; i++) {
    const res = await rpc(sb, 'niche_signal_efeitos_gravar', { p_site: siteId, p_bracos: i === 0 ? bracos : [], p_linhas: lotes[i] }, gravarZ)
    if (res.de_outro_site > 0) throw new ErroDaMedida('medida_falhou')
  }
}

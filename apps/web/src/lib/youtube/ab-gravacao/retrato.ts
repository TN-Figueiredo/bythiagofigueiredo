import { addDays, boundsAnalytics, ontemPt, type DiaPt } from '../coleta/day-pt'
import type { AbCycle, AbTest } from '../coleta/ab-seconds'
import type { LinhaAlcance, MetaDoDia, MotivoSemVariante, EstadoAlcance, EstadoViews, RelatorioDoDia } from './tipos'
import { atribuirDia, diasDoTeste } from './atribuicao'
import { ehFinal, estadoDasViews, estadoDoAlcance } from './estado'

export const JANELA_RETRATO_DIAS = 40

/** Primeiro dia lido por rodada: nunca se grava dia fora da janela de leitura (senão viraria meta_ausente com a meta no banco). */
export function janelaDesde(ontem: DiaPt): DiaPt {
  return addDays(ontem, -JANELA_RETRATO_DIAS)
}

export interface TesteParaRetrato extends AbTest {
  site_id: string
  test_type: 'thumbnail' | 'title' | 'combo'
  regra_duracao: 'v1' | 'v2'
  /** `youtube_videos.youtube_video_id` (11 caracteres); nunca `ab_tests.youtube_video_id`, que é o uuid. */
  youtube_id: string
  channel_id: string
}

export interface LinhaViews {
  views: number | null
  engaged_views: number | null
  watch_time_minutes: number | null
  avg_view_percentage: number | null
  source: string
  metric_version: string
}

export interface LinhaSonda { hora: string; lida_em: string; leitura_estado: string; variante_vista: string | null }

export interface EntradasDoRetrato {
  testes: TesteParaRetrato[]
  ciclosPorTeste: Map<string, AbCycle[]>
  metaPorVideoDia: Map<string, MetaDoDia>
  alcancePorVideoDia: Map<string, LinhaAlcance>
  relatoriosPorCanalDia: Map<string, RelatorioDoDia[]>
  viewsPorVideoDia: Map<string, LinhaViews>
  coberturaPorVideo: Map<string, Array<{ de: DiaPt; ate: DiaPt }>>
  sondasPorTesteDia: Map<string, LinhaSonda[]>
  desde: DiaPt
}

export interface LinhaRetrato {
  test_id: string
  day_pt: DiaPt
  site_id: string
  youtube_video_id: string
  regra_duracao: 'v1' | 'v2'
  variant_id: string | null
  motivo_sem_variante: MotivoSemVariante | null
  motivo_nulo_meta: string | null
  segundos_no_ar: number | null
  segundos_do_dia: number
  dia_de_troca: boolean | null
  ciclos: Array<{ id: string; started_at: string; ended_at: string | null }>
  impressoes: number | null
  ctr: number | null
  alcance_estado: EstadoAlcance
  source_report_id: string | null
  report_create_time: string | null
  views: number | null
  views_estado: EstadoViews
  views_fonte: string | null
  metric_version: string | null
  engaged_views: number | null
  watch_time_minutes: number | null
  avg_view_percentage: number | null
  troca_vista_em: string | null
  retratado_em: string
  final: boolean
}

/** Uma linha por (teste, dia). Tudo vem em Map já carregado em lote; nada de busca linear dentro do laço dos dias. */
export function montarRetrato(e: EntradasDoRetrato, agora: Date): LinhaRetrato[] {
  const ontem = ontemPt(agora)
  const retratadoEm = agora.toISOString()
  const linhas: LinhaRetrato[] = []
  for (const teste of e.testes) {
    const ciclos = e.ciclosPorTeste.get(teste.id) ?? []
    const dias = diasDoTeste(ciclos, teste, ontem, e.desde)
    const cobertura = e.coberturaPorVideo.get(teste.youtube_id) ?? []
    let varianteAnterior: string | null | undefined
    for (const day of dias) {
      const chaveVideo = `${teste.youtube_id}|${day}`
      const b = boundsAnalytics(day)
      const at = atribuirDia({ testId: teste.id, day, meta: e.metaPorVideoDia.get(chaveVideo) ?? null, teste, ciclos })
      const alcance = e.alcancePorVideoDia.get(chaveVideo) ?? null
      const views = e.viewsPorVideoDia.get(chaveVideo) ?? null
      const diaDeTroca = varianteAnterior === undefined || varianteAnterior === null || at.variant_id === null
        ? null
        : at.variant_id !== varianteAnterior
      varianteAnterior = at.variant_id

      let trocaVista: string | null = null
      if (diaDeTroca === true && (teste.test_type === 'thumbnail' || teste.test_type === 'combo')) {
        let melhor = Number.POSITIVE_INFINITY
        for (const s of e.sondasPorTesteDia.get(`${teste.id}|${day}`) ?? []) {
          const t = Date.parse(s.lida_em)
          if (s.leitura_estado === 'bate' && s.variante_vista === at.variant_id && t >= b.start && t < b.end && t < melhor) melhor = t
        }
        if (Number.isFinite(melhor)) trocaVista = new Date(melhor).toISOString()
      }

      linhas.push({
        test_id: teste.id,
        day_pt: day,
        site_id: teste.site_id,
        youtube_video_id: teste.youtube_id,
        regra_duracao: teste.regra_duracao,
        variant_id: at.variant_id,
        motivo_sem_variante: at.motivo_sem_variante,
        motivo_nulo_meta: at.motivo_nulo_meta,
        segundos_no_ar: at.segundos_no_ar,
        segundos_do_dia: at.segundos_do_dia,
        dia_de_troca: diaDeTroca,
        ciclos: ciclos
          .filter(c => Date.parse(c.started_at) < b.end && (c.ended_at ? Date.parse(c.ended_at) : Number.POSITIVE_INFINITY) > b.start)
          .map(c => ({ id: c.id, started_at: c.started_at, ended_at: c.ended_at })),
        impressoes: alcance?.thumbnail_impressions ?? null,
        ctr: alcance?.thumbnail_ctr ?? null,
        alcance_estado: estadoDoAlcance({ day, ontem, relatorios: e.relatoriosPorCanalDia.get(`${teste.channel_id}|${day}`) ?? [], linha: alcance }),
        source_report_id: alcance?.source_report_id ?? null,
        report_create_time: alcance?.report_create_time ?? null,
        views: views?.views ?? null,
        views_estado: estadoDasViews({ day, linha: views, coberto: cobertura.some(c => c.de <= day && day <= c.ate) }),
        views_fonte: views?.source ?? null,
        metric_version: views?.metric_version ?? null,
        engaged_views: views?.engaged_views ?? null,
        watch_time_minutes: views?.watch_time_minutes ?? null,
        avg_view_percentage: views?.avg_view_percentage ?? null,
        troca_vista_em: trocaVista,
        retratado_em: retratadoEm,
        final: ehFinal(day, ontem),
      })
    }
  }
  return linhas
}

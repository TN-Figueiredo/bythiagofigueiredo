// A4 R3: o catálogo de métricas da consulta. Cada uma aponta para a função do motor que a tela já usa; nenhuma conta nova.
import type { MetricaDaConsulta } from './tipos'

export const METRICAS_DA_CONSULTA: Record<MetricaDaConsulta, { rotulo: string; doMotor: string; soAcompanhados: boolean }> = {
  views: { rotulo: 'views', doMotor: 'ObsVideo.views', soAcompanhados: false },
  likes: { rotulo: 'curtidas', doMotor: 'reacaoComEstado(ObsVideo.likes, InfoDoVideo.likesHidden)', soAcompanhados: false },
  comentarios: { rotulo: 'comentários', doMotor: 'reacaoComEstado(ObsVideo.comments, InfoDoVideo.commentsDisabled)', soAcompanhados: false },
  vpd7: { rotulo: 'views por dia (7 d)', doMotor: 'Derived.vpd7', soAcompanhados: true },
  multiplicador: { rotulo: 'multiplicador', doMotor: 'Derived.mult', soAcompanhados: true },
  engajamento: { rotulo: 'engajamento por mil views', doMotor: 'MedidasDoVideo.m7', soAcompanhados: false },
  inscritos: { rotulo: 'inscritos do canal', doMotor: 'ObsChannel.subs', soAcompanhados: false },
}

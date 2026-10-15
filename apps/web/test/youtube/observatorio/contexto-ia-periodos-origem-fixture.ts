/**
 * E17 degrau 1, Tarefa 8b: as vistas dos cartões de "% assistido por período" e da aba Origem do canal próprio, em estados sintéticos (repositório público:
 * nenhum nome real). Os dois modelos são os de produção (`buildAssistidoPeriodos`, `buildOrigem`); só as entradas são inventadas.
 */
import { buildAssistidoPeriodos, type AssistidoPeriodosView, type EntradaAssistido } from '@/app/cms/(authed)/youtube/competitors/_proprio/assistido-periodo-model'
import { buildOrigem, type OrigemView } from '@/app/cms/(authed)/youtube/competitors/_proprio/origem-model'
import { FAIXAS } from '@/lib/youtube/observatorio/proprio/assistido'
import type { NormalDoPeriodo, PeriodoAssistido } from '@/lib/youtube/observatorio/proprio/assistido-periodo'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { ATE, TIP7, detalhe, dmF, dmyF, entrada, nF, ok, per } from './proprio-origem-fixture'

const normal = (periodo: PeriodoAssistido, pct: number, views: number): NormalDoPeriodo => ({ periodo, de: '2026-01-01', ate: '2026-10-10', pct, pctArredondado: Math.round(pct), views, videos: 20, motivo: null })
const semNormal = (periodo: PeriodoAssistido, motivo: NonNullable<NormalDoPeriodo['motivo']>, views = 0): NormalDoPeriodo => ({ periodo, de: null, ate: null, pct: null, pctArredondado: null, views, videos: 0, motivo })

export type EstadoDosPeriodos = 'medido' | 'poucas-views' | 'negado' | 'erro'
export function periodosDe(estado: EstadoDosPeriodos): AssistidoPeriodosView {
  const base: EntradaAssistido = {
    tela: 'canal', acesso: estado === 'negado' || estado === 'erro' ? estado : 'ok',
    normais: { inteiro: normal('inteiro', 47.2, 412000), '90': normal('90', 51.1, 188000), '28': normal('28', 44.3, 60000) },
    faixas: Object.fromEntries((['inteiro', '90', '28'] as const).map((p) => [p, FAIXAS.map((f, i) => ({ faixa: f.id, normal: i === 2 ? semNormal(p, 'poucas-views', 120) : normal(p, 40 + i * 6 + (p === '90' ? 3 : p === '28' ? -2 : 0), 90000 - i * 20000) }))])) as EntradaAssistido['faixas'],
    videoPct: null, buracos: { inteiro: { comBuraco: 0, naConta: 35 }, '90': { comBuraco: 0, naConta: 35 }, '28': { comBuraco: 0, naConta: 35 } },
    diarioDesde: null, ultimoDia: '2026-10-10', dm: dmF, dmy: dmyF,
  }
  if (estado === 'poucas-views') base.normais['28'] = semNormal('28', 'poucas-views', 340)
  return buildAssistidoPeriodos(base)
}

export type EstadoDaOrigem = 'completa' | 'so-aviso' | 'sem-termos'
export function origemDe(estado: EstadoDaOrigem): OrigemView {
  const periodos = [
    per('7', '7 dias', TIP7[0]!, ATE), per('28', '28 dias', addDays(ATE, -27), ATE, 12400), per('90', '90 dias', addDays(ATE, -89), ATE, 41000), per('tudo', 'Desde 2026', '2026-01-01', ATE, 88000),
  ]
  return buildOrigem(entrada({ periodos, nivel: estado === 'completa' ? 'tudo' : estado === 'sem-termos' ? 'sem-termos' : 'so-aviso', termos: ok(detalhe()), dmy: dmyF, n: nF }))
}

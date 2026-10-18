import { diffDias, type DiaPt } from '../coleta/day-pt'
import type { EstadoAlcance, EstadoViews, LinhaAlcance, RelatorioDoDia } from './tipos'

export type { EstadoAlcance, EstadoViews, LinhaAlcance, RelatorioDoDia } from './tipos'

/** A linha do dia só para de mudar no D+10 (a A5 relê os últimos 10 dias do diário). */
export function ehFinal(day: DiaPt, ontem: DiaPt): boolean {
  return diffDias(day, ontem) >= 10
}

export function estadoDoAlcance(i: { day: DiaPt; ontem: DiaPt; relatorios: RelatorioDoDia[]; linha: LinhaAlcance | null }): EstadoAlcance {
  if (i.linha) return i.linha.thumbnail_impressions !== null ? 'medido' : 'nao_medido'
  let vale: RelatorioDoDia | null = null
  for (const r of i.relatorios) {
    if (!vale || Date.parse(r.create_time) > Date.parse(vale.create_time)) vale = r
  }
  if (vale) {
    if (vale.status === 'expirado_sem_baixar') return 'nao_medido'
    if (vale.status === 'vazio' && vale.normalized_at) return 'zero_medido'
    if (vale.status === 'baixado' && vale.normalized_at) return 'ausente_no_relatorio'
  }
  return ehFinal(i.day, i.ontem) ? 'nao_medido' : 'aguardando'
}

export function estadoDasViews(i: { day: DiaPt; linha: { views: number | null } | null; coberto: boolean }): EstadoViews {
  if (i.linha) {
    if (i.linha.views === null) return 'nao_medido'
    return i.linha.views > 0 ? 'medido' : 'zero_medido'
  }
  return i.coberto ? 'zero_medido' : 'nao_medido'
}

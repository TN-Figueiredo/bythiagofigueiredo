export type NotificationType =
  | 'grade_drop' | 'ctr_drop' | 'monitoring_alert' | 'ab_test_completed'
  | 'retest_suggested' | 'optimization_available' | 'trending_viral' | 'optimization_resolved'

export const NOTIFICATION_PRIORITIES: Record<NotificationType, number> = {
  grade_drop: 5,
  ctr_drop: 4,
  monitoring_alert: 4,
  ab_test_completed: 3,
  retest_suggested: 3,
  optimization_available: 2,
  trending_viral: 2,
  optimization_resolved: 2,
}

export interface NotificationPayload {
  type: NotificationType
  priority: number
  title: string
  message: string
  dedup_key: string
  video_id?: string
  ab_test_id?: string
  cycle_id?: string
  suggested_action?: string
  action_href?: string
}

export function buildDedupKey(type: NotificationType, videoId: string | null, weekIso: string): string {
  if (!videoId) return `${type}:group:${weekIso}`
  return `${type}:${videoId}:${weekIso}`
}

export function shouldAggregate(count: number): boolean {
  return count >= 3
}

interface GradeDropInput {
  type: 'grade_drop'
  videoId: string
  videoTitle: string
  oldGrade: string
  newGrade: string
  weekIso: string
}

interface CtrDropInput {
  type: 'ctr_drop'
  videoId: string
  videoTitle: string
  currentCtr: number
  avgCtr: number
  weekIso: string
}

interface MonitoringAlertInput {
  type: 'monitoring_alert'
  videoId: string
  videoTitle: string
  checkDay: number
  ctrDelta: number
  weekIso: string
}

interface AbTestCompletedInput {
  type: 'ab_test_completed'
  videoId: string
  videoTitle: string
  testName: string
  winnerLabel: string
  ctrLift: number
  weekIso: string
}

interface RetestSuggestedInput {
  type: 'retest_suggested'
  videoId: string
  videoTitle: string
  weekIso: string
}

interface OptimizationAvailableInput {
  type: 'optimization_available'
  videoId: string
  videoTitle: string
  weekIso: string
}

interface TrendingViralInput {
  type: 'trending_viral'
  videoId: string
  videoTitle: string
  views48h: number
  channelAvg48h: number
  weekIso: string
}

interface OptimizationResolvedInput {
  type: 'optimization_resolved'
  videoId: string
  videoTitle: string
  weekIso: string
}

type NotificationInput =
  | GradeDropInput | CtrDropInput | MonitoringAlertInput | AbTestCompletedInput
  | RetestSuggestedInput | OptimizationAvailableInput | TrendingViralInput | OptimizationResolvedInput

export function buildNotification(input: NotificationInput): NotificationPayload {
  const priority = NOTIFICATION_PRIORITIES[input.type]!
  const dedupKey = buildDedupKey(input.type, input.videoId, input.weekIso)
  const baseHref = `/cms/youtube/analytics`

  switch (input.type) {
    case 'grade_drop':
      return {
        type: input.type,
        priority,
        title: `Queda de grade: ${input.videoTitle.slice(0, 40)}`,
        message: `Grade caiu de ${input.oldGrade} para ${input.newGrade}. Ação recomendada.`,
        dedup_key: dedupKey,
        video_id: input.videoId,
        action_href: `${baseHref}?tab=grades&video=${input.videoId}`,
        suggested_action: 'Verificar diagnóstico e considerar A/B test',
      }
    case 'ctr_drop':
      return {
        type: input.type,
        priority,
        title: `CTR em queda: ${input.videoTitle.slice(0, 40)}`,
        message: `CTR atual ${input.currentCtr.toFixed(1)}% vs média ${input.avgCtr.toFixed(1)}% (queda >20%).`,
        dedup_key: dedupKey,
        video_id: input.videoId,
        action_href: `${baseHref}?tab=grades&video=${input.videoId}`,
      }
    case 'monitoring_alert':
      return {
        type: input.type,
        priority,
        title: `Alerta de monitoramento: ${input.videoTitle.slice(0, 40)}`,
        message: `Dia ${input.checkDay}: CTR ${input.ctrDelta > 0 ? '+' : ''}${input.ctrDelta.toFixed(1)}% desde A/B test.`,
        dedup_key: dedupKey,
        video_id: input.videoId,
        action_href: `${baseHref}?tab=grades&video=${input.videoId}`,
      }
    case 'ab_test_completed':
      return {
        type: input.type,
        priority,
        title: `Teste concluído: ${input.testName}`,
        message: `Vencedor: ${input.winnerLabel} com +${input.ctrLift.toFixed(1)}% CTR.`,
        dedup_key: dedupKey,
        video_id: input.videoId,
        action_href: `/cms/youtube/ab-lab`,
      }
    case 'retest_suggested':
      return {
        type: input.type,
        priority,
        title: `Re-teste sugerido: ${input.videoTitle.slice(0, 40)}`,
        message: `Vídeo ainda C/D após cooldown. Novo ciclo de otimização disponível.`,
        dedup_key: dedupKey,
        video_id: input.videoId,
        action_href: `${baseHref}?tab=grades&video=${input.videoId}`,
      }
    case 'optimization_available':
      return {
        type: input.type,
        priority,
        title: `Nova recomendação AI: ${input.videoTitle.slice(0, 40)}`,
        message: `Cowork gerou nova análise com sugestões de otimização.`,
        dedup_key: dedupKey,
        video_id: input.videoId,
        action_href: `${baseHref}?tab=grades&video=${input.videoId}`,
      }
    case 'trending_viral':
      return {
        type: input.type,
        priority,
        title: `Vídeo viral detectado!`,
        message: `"${input.videoTitle.slice(0, 30)}" — ${input.views48h.toLocaleString('pt-BR')} views em 48h (${Math.round(input.views48h / input.channelAvg48h)}x a média).`,
        dedup_key: dedupKey,
        video_id: input.videoId,
        action_href: `${baseHref}?tab=grades&video=${input.videoId}`,
      }
    case 'optimization_resolved':
      return {
        type: input.type,
        priority,
        title: `Otimização bem-sucedida!`,
        message: `"${input.videoTitle.slice(0, 30)}" atingiu grade B+ após otimização.`,
        dedup_key: dedupKey,
        video_id: input.videoId,
        action_href: `${baseHref}?tab=grades&video=${input.videoId}`,
      }
  }
}

export function buildGroupNotification(
  type: NotificationType,
  items: { videoTitle: string; oldGrade?: string; newGrade?: string }[],
  weekIso: string,
): NotificationPayload {
  const priority = NOTIFICATION_PRIORITIES[type]!
  const dedupKey = buildDedupKey(type, null, weekIso)
  const itemList = items.map(i => {
    if (i.oldGrade && i.newGrade) return `• ${i.videoTitle.slice(0, 30)} — ${i.oldGrade} → ${i.newGrade}`
    return `• ${i.videoTitle.slice(0, 30)}`
  }).join('\n')

  return {
    type,
    priority,
    title: `${items.length} vídeos tiveram ${type === 'grade_drop' ? 'queda de grade' : 'alteração'} esta semana`,
    message: itemList,
    dedup_key: dedupKey,
    action_href: `/cms/youtube/analytics?tab=grades`,
  }
}

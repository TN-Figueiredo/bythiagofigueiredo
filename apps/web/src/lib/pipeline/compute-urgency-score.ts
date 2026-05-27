import { parseISO, differenceInCalendarDays } from 'date-fns'
import { STAGE_ORDER } from './up-next-constants'
import type { Stage } from './up-next-constants'

const TOTAL_STAGES = STAGE_ORDER['scheduled'] // 8

interface UrgencyScoreInput {
  deadline: string | null
  today: string
  stage: Stage
  effortMinutes: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function computeUrgencyScore(input: UrgencyScoreInput): number {
  const { deadline, today, stage, effortMinutes } = input

  if (deadline === null) return 0

  const daysUntilDeadline = differenceInCalendarDays(parseISO(deadline), parseISO(today))

  const deadlinePressure = clamp(1 - (daysUntilDeadline / 7), 0, 1.5)

  const currentOrder = STAGE_ORDER[stage] ?? 0
  const stagesRemaining = clamp((TOTAL_STAGES - currentOrder) / TOTAL_STAGES, 0, 1)

  const effortWeight = clamp(effortMinutes / 240, 0, 1)

  const rawScore = (deadlinePressure * 60) + (stagesRemaining * 25) + (effortWeight * 15)

  return clamp(Math.round(rawScore * 10) / 10, 0, 100)
}

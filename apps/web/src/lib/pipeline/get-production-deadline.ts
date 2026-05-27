import { subDays, formatISO, parseISO } from 'date-fns'
import type { Stage } from './up-next-constants'
import type { VelocityMap } from './up-next-types'

const PRODUCTION_STAGES: Stage[] = [
  'idea', 'outline', 'draft', 'roteiro', 'gravacao', 'edicao', 'pos_producao', 'ready',
]

const WORKDAY_MINUTES = 480

interface VelocityOptions {
  velocityMap?: VelocityMap
  format?: string
}

export function getProductionDeadline(
  pubDate: string,
  stage: Stage,
  options?: VelocityOptions,
): string | undefined {
  const pub = parseISO(pubDate)

  if (stage === 'scheduled' || stage === 'published') return undefined

  if (options?.velocityMap && options.format) {
    const velocityDays = computeVelocityDays(stage, options.format, options.velocityMap)
    if (velocityDays !== null) {
      return formatISO(subDays(pub, velocityDays), { representation: 'date' })
    }
  }

  switch (stage) {
    case 'idea': case 'outline': case 'draft': case 'roteiro':
      return formatISO(subDays(pub, 4), { representation: 'date' })
    case 'gravacao':
      return formatISO(subDays(pub, 3), { representation: 'date' })
    case 'edicao':
      return formatISO(subDays(pub, 2), { representation: 'date' })
    case 'pos_producao': case 'ready':
      return formatISO(subDays(pub, 1), { representation: 'date' })
    default:
      return undefined
  }
}

function computeVelocityDays(
  currentStage: Stage,
  format: string,
  velocityMap: VelocityMap,
): number | null {
  const startIdx = PRODUCTION_STAGES.indexOf(currentStage)
  if (startIdx === -1) return null

  let totalMinutes = 0
  for (let i = startIdx; i < PRODUCTION_STAGES.length; i++) {
    const key = `${format}:${PRODUCTION_STAGES[i]!}`
    const entry = velocityMap[key]
    if (!entry) return null
    totalMinutes += entry.effectiveMinutes
  }

  return Math.ceil(totalMinutes / WORKDAY_MINUTES)
}


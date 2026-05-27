import { STAGE_ORDER } from './up-next-constants'
import type { Stage } from './up-next-constants'

export interface HistoryRow {
  pipeline_id: string
  event_type: string
  from_value: string | null
  to_value: string | null
}

export function countForwardTransitions(rows: HistoryRow[]): number {
  const forwardIds = new Set<string>()

  for (const row of rows) {
    if (row.event_type !== 'stage_change') continue
    if (!row.from_value || !row.to_value) continue

    const fromOrder = STAGE_ORDER[row.from_value as Stage]
    const toOrder = STAGE_ORDER[row.to_value as Stage]

    if (fromOrder === undefined || toOrder === undefined) continue
    if (toOrder > fromOrder) {
      forwardIds.add(row.pipeline_id)
    }
  }

  return forwardIds.size
}

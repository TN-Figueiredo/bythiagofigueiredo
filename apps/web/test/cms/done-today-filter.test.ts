import { describe, it, expect } from 'vitest'
import { STAGE_ORDER } from '../../src/lib/pipeline/up-next-constants'
import type { Stage } from '../../src/lib/pipeline/up-next-constants'

interface HistoryRow {
  pipeline_id: string
  event_type: string
  from_value: string | null
  to_value: string | null
}

function countForwardTransitions(rows: HistoryRow[]): number {
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

describe('countForwardTransitions', () => {
  it('counts a forward stage_change as done', () => {
    const rows: HistoryRow[] = [
      { pipeline_id: 'p1', event_type: 'stage_change', from_value: 'draft', to_value: 'roteiro' },
    ]
    expect(countForwardTransitions(rows)).toBe(1)
  })

  it('ignores backward transitions (rejections)', () => {
    const rows: HistoryRow[] = [
      { pipeline_id: 'p1', event_type: 'stage_change', from_value: 'ready', to_value: 'draft' },
    ]
    expect(countForwardTransitions(rows)).toBe(0)
  })

  it('ignores non-stage_change events', () => {
    const rows: HistoryRow[] = [
      { pipeline_id: 'p1', event_type: 'field_change', from_value: 'old title', to_value: 'new title' },
    ]
    expect(countForwardTransitions(rows)).toBe(0)
  })

  it('counts each pipeline_id only once even with multiple forward transitions', () => {
    const rows: HistoryRow[] = [
      { pipeline_id: 'p1', event_type: 'stage_change', from_value: 'idea', to_value: 'outline' },
      { pipeline_id: 'p1', event_type: 'stage_change', from_value: 'outline', to_value: 'draft' },
    ]
    expect(countForwardTransitions(rows)).toBe(1)
  })

  it('counts multiple distinct pipeline_ids', () => {
    const rows: HistoryRow[] = [
      { pipeline_id: 'p1', event_type: 'stage_change', from_value: 'idea', to_value: 'outline' },
      { pipeline_id: 'p2', event_type: 'stage_change', from_value: 'edicao', to_value: 'pos_producao' },
    ]
    expect(countForwardTransitions(rows)).toBe(2)
  })

  it('handles mixed forward and backward for same item (forward wins)', () => {
    const rows: HistoryRow[] = [
      { pipeline_id: 'p1', event_type: 'stage_change', from_value: 'ready', to_value: 'draft' },
      { pipeline_id: 'p1', event_type: 'stage_change', from_value: 'draft', to_value: 'roteiro' },
    ]
    expect(countForwardTransitions(rows)).toBe(1)
  })

  it('returns 0 for empty rows', () => {
    expect(countForwardTransitions([])).toBe(0)
  })

  it('ignores rows with null from_value or to_value', () => {
    const rows: HistoryRow[] = [
      { pipeline_id: 'p1', event_type: 'stage_change', from_value: null, to_value: 'draft' },
      { pipeline_id: 'p2', event_type: 'stage_change', from_value: 'draft', to_value: null },
    ]
    expect(countForwardTransitions(rows)).toBe(0)
  })

  it('ignores unknown stage names', () => {
    const rows: HistoryRow[] = [
      { pipeline_id: 'p1', event_type: 'stage_change', from_value: 'unknown', to_value: 'draft' },
    ]
    expect(countForwardTransitions(rows)).toBe(0)
  })
})

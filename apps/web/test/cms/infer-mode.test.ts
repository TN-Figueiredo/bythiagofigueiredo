import { describe, it, expect } from 'vitest'
import { inferCurrentMode } from '../../src/lib/pipeline/infer-mode'
import type { PipelineItemWithSlot } from '../../src/lib/pipeline/up-next-types'

function makeItem(stage: string, format: string = 'video'): PipelineItemWithSlot {
  return {
    id: `item-${Math.random().toString(36).slice(2)}`,
    title: 'Test',
    stage: stage as PipelineItemWithSlot['stage'],
    priority: 1,
    format: format as PipelineItemWithSlot['format'],
    language: 'pt-br',
    duration_target: null,
    scheduled_at: null,
    youtube_channel_id: 'ch1',
    playlist_id: null,
    playlist_name: null,
    playlist_position: null,
    playlist_total: null,
    channel_label: null,
  }
}

describe('inferCurrentMode', () => {
  it('returns null mode with confidence 0 for empty items', () => {
    const result = inferCurrentMode([])
    expect(result.mode).toBeNull()
    expect(result.confidence).toBe(0)
    expect(result.label).toBe('Sem itens ativos')
  })

  it('returns counts object even for empty items', () => {
    const result = inferCurrentMode([])
    expect(result.counts).toBeDefined()
    expect(typeof result.counts).toBe('object')
  })

  it('returns escrever mode when 60% of items are in escrever stages', () => {
    const items = [
      makeItem('idea'),
      makeItem('outline'),
      makeItem('draft'),
      makeItem('roteiro'),
      makeItem('gravacao'),
      makeItem('edicao'),
      // 4 escrever, 1 gravar, 1 pos-prod — 4/6 = 66%
    ]
    const result = inferCurrentMode(items)
    expect(result.mode).toBe('escrever')
    expect(result.label).toBe('Modo escrita')
    expect(result.confidence).toBeCloseTo(4 / 6, 5)
  })

  it('returns gravar mode when 60% of items are in gravar stages', () => {
    const items = [
      makeItem('gravacao'),
      makeItem('gravacao'),
      makeItem('gravacao'),
      makeItem('idea'),
      makeItem('edicao'),
      // 3 gravar, 1 escrever, 1 pos-prod — 3/5 = 60%
    ]
    const result = inferCurrentMode(items)
    expect(result.mode).toBe('gravar')
    expect(result.label).toBe('Modo gravação')
    expect(result.confidence).toBeCloseTo(3 / 5, 5)
  })

  it('returns pos-prod mode when 60% of items are in pos-prod stages', () => {
    const items = [
      makeItem('edicao'),
      makeItem('pos_producao'),
      makeItem('ready'),
      makeItem('idea'),
      makeItem('gravacao'),
      // 3 pos-prod, 1 escrever, 1 gravar — 3/5 = 60%
    ]
    const result = inferCurrentMode(items)
    expect(result.mode).toBe('pos-prod')
    expect(result.label).toBe('Modo pós-produção')
    expect(result.confidence).toBeCloseTo(3 / 5, 5)
  })

  it('returns null mode with "Modo misto" label when no group reaches 40%', () => {
    // 10 items evenly spread: 3 escrever, 3 gravar, 4 pos-prod — none >= 40% except pos-prod
    // Let's make it truly even: 4 escrever, 3 gravar, 3 pos-prod — 4/10 = 40% triggers escrever
    // Need none at 40%: 3/10, 3/10, 4/10 → pos-prod hits 40%
    // Use 5 items: 2 escrever, 2 gravar, 1 pos-prod → 2/5=40% ties
    // Actually let's just use: 3 escrever, 3 gravar, 4 other... there's no "other" work mode
    // Use scheduled to dilute: but scheduled is excluded from activeItems
    // Best approach: 3 escrever, 3 gravar, 4 pos-prod → pos-prod wins at 4/10=40%
    // To get truly mixed: use 3/10, 3/10, 4/10 — BUT pos-prod is still 40%
    // Let's use 11 items: 4 escrever (36%), 4 gravar (36%), 3 pos-prod (27%) → none >= 40%
    const items = [
      makeItem('idea'), makeItem('outline'), makeItem('draft'), makeItem('roteiro'), // 4 escrever
      makeItem('gravacao'), makeItem('gravacao'), makeItem('gravacao'), makeItem('gravacao'), // 4 gravar
      makeItem('edicao'), makeItem('pos_producao'), makeItem('ready'), // 3 pos-prod
    ]
    // 4/11 = 36%, 4/11 = 36%, 3/11 = 27% — none >= 40%
    const result = inferCurrentMode(items)
    expect(result.mode).toBeNull()
    expect(result.label).toBe('Modo misto')
  })

  it('excludes scheduled items from active count', () => {
    const items = [
      makeItem('scheduled'),
      makeItem('scheduled'),
      makeItem('scheduled'),
      makeItem('idea'),
    ]
    // Only 1 active item (idea), scheduled are excluded
    const result = inferCurrentMode(items)
    expect(result.mode).toBe('escrever')
    expect(result.confidence).toBe(1)
  })

  it('excludes published items from active count', () => {
    const items = [
      makeItem('published'),
      makeItem('published'),
      makeItem('edicao'),
      makeItem('edicao'),
    ]
    // Only 2 active items (edicao), published are excluded
    const result = inferCurrentMode(items)
    expect(result.mode).toBe('pos-prod')
    expect(result.confidence).toBe(1)
  })

  it('returns counts for all groups', () => {
    const items = [makeItem('idea'), makeItem('gravacao'), makeItem('edicao')]
    const result = inferCurrentMode(items)
    expect(result.counts).toHaveProperty('escrever')
    expect(result.counts).toHaveProperty('gravar')
    expect(result.counts).toHaveProperty('pos-prod')
    expect(result.counts).toHaveProperty('prontos')
  })

  it('breaks ties by favoring highest stage order group (pos-prod > gravar > escrever)', () => {
    // 5 escrever, 5 pos-prod → both at 50%, tie broken by maxStageOrder: pos-prod wins
    const items = [
      makeItem('idea'), makeItem('outline'), makeItem('draft'), makeItem('roteiro'), makeItem('draft'),
      makeItem('edicao'), makeItem('pos_producao'), makeItem('ready'), makeItem('edicao'), makeItem('pos_producao'),
    ]
    const result = inferCurrentMode(items)
    expect(result.mode).toBe('pos-prod')
    expect(result.label).toBe('Modo pós-produção')
  })

  it('returns confidence of 1 when all items are in one group', () => {
    const items = [makeItem('idea'), makeItem('outline'), makeItem('draft')]
    const result = inferCurrentMode(items)
    expect(result.mode).toBe('escrever')
    expect(result.confidence).toBe(1)
  })

  it('handles single item correctly (100% >= 40% threshold)', () => {
    const result = inferCurrentMode([makeItem('gravacao')])
    expect(result.mode).toBe('gravar')
    expect(result.confidence).toBe(1)
    expect(result.label).toBe('Modo gravação')
  })

  it('prontos (scheduled/published) is not a work mode candidate', () => {
    // All items are scheduled — zero active items
    const items = [makeItem('scheduled'), makeItem('scheduled')]
    const result = inferCurrentMode(items)
    expect(result.mode).toBeNull()
    expect(result.label).toBe('Sem itens ativos')
    // prontos should not appear as a mode
    expect(['escrever', 'gravar', 'pos-prod', null]).toContain(result.mode)
  })

  it('returns correct counts matching the number of items per group', () => {
    const items = [
      makeItem('idea'),
      makeItem('outline'),
      makeItem('gravacao'),
      makeItem('edicao'),
      makeItem('edicao'),
      makeItem('scheduled'), // excluded from active
    ]
    const result = inferCurrentMode(items)
    expect(result.counts['escrever']).toBe(2)
    expect(result.counts['gravar']).toBe(1)
    expect(result.counts['pos-prod']).toBe(2)
    // scheduled is excluded from active count, prontos count is separate
  })

  it('ties in ratio favor pos-prod over gravar', () => {
    // 3 gravar and 3 pos-prod, 0 escrever → 50% each, tie → pos-prod wins
    const items = [
      makeItem('gravacao'), makeItem('gravacao'), makeItem('gravacao'),
      makeItem('edicao'), makeItem('pos_producao'), makeItem('ready'),
    ]
    const result = inferCurrentMode(items)
    expect(result.mode).toBe('pos-prod')
  })
})

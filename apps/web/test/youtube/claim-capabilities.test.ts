// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { claimFilter } from '@/lib/pipeline/services/forja-queue'

describe('claim filter (global queue, backward compatible)', () => {
  it('old worker (no task_types) only sees diagnostico for its channels', () => {
    expect(claimFilter(['c1'], undefined)).toBe('and(task_type.eq.diagnostico,channel_id.in.(c1))')
  })
  it('new worker sees its channels AND the observatory types it announced', () => {
    expect(claimFilter(['c1'], ['temas', 'resumo-trocas'])).toBe('and(task_type.eq.diagnostico,channel_id.in.(c1)),task_type.in.(temas,resumo-trocas)')
  })
  it('an unknown type in task_types is dropped, never injected into the filter', () => {
    expect(claimFilter(['c1'], ['temas', 'x);drop' as never])).toBe('and(task_type.eq.diagnostico,channel_id.in.(c1)),task_type.in.(temas)')
  })
  it('legacy GET (Cowork, no channel ids, no types) sees every diagnostico — and only diagnostico', () => {
    expect(claimFilter([], undefined)).toBe('task_type.eq.diagnostico')
  })
  it('no channel ids but announced types: every diagnostico plus those types', () => {
    expect(claimFilter([], ['temas'])).toBe('task_type.eq.diagnostico,task_type.in.(temas)')
  })
  it('an empty task_types list is the same as none', () => {
    expect(claimFilter(['c1'], [])).toBe('and(task_type.eq.diagnostico,channel_id.in.(c1))')
  })
  it('a channel id with PostgREST syntax is dropped; if none is left the diagnostico clause goes away (never widens)', () => {
    expect(claimFilter(['c1', 'a),or(b'], undefined)).toBe('and(task_type.eq.diagnostico,channel_id.in.(c1))')
    expect(claimFilter(['a),or(b'], undefined)).toBeNull()
    expect(claimFilter(['a),or(b'], ['temas'])).toBe('task_type.in.(temas)')
  })
  it('duplicate types are sent once', () => {
    expect(claimFilter(['c1'], ['temas', 'temas'])).toBe('and(task_type.eq.diagnostico,channel_id.in.(c1)),task_type.in.(temas)')
  })
})

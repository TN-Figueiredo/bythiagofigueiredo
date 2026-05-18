import { describe, it, expect } from 'vitest'
import {
  transitionState,
  canTransition,
  OPTIMIZATION_CONFIG,
  isInCooldown,
  getMaxCycles,
} from '@/lib/youtube/optimization-loop'
import type { OptimizationCycle } from '@/lib/youtube/optimization-loop'

function makeCycle(overrides: Partial<OptimizationCycle> = {}): OptimizationCycle {
  return {
    id: 'cycle-1',
    youtube_video_id: 'vid-1',
    site_id: 'site-1',
    state: 'flagged',
    cycle_number: 1,
    flagged_at: new Date().toISOString(),
    diagnosed_at: null,
    diagnosis_summary: null,
    test_suggested_at: null,
    test_suggestion: null,
    ab_test_id: null,
    testing_started_at: null,
    test_completed_at: null,
    test_winner_applied_at: null,
    monitoring_day7_at: null,
    monitoring_day7_result: null,
    monitoring_day14_at: null,
    monitoring_day14_result: null,
    monitoring_day30_at: null,
    monitoring_day30_result: null,
    resolved_at: null,
    resolved_reason: null,
    cooldown_until: null,
    ...overrides,
  }
}

describe('canTransition', () => {
  it('allows flagged → diagnosed', () => {
    expect(canTransition('flagged', 'diagnosed')).toBe(true)
  })
  it('allows flagged → unmonitored', () => {
    expect(canTransition('flagged', 'unmonitored')).toBe(true)
  })
  it('disallows flagged → testing', () => {
    expect(canTransition('flagged', 'testing')).toBe(false)
  })
  it('allows testing → post_test_monitoring', () => {
    expect(canTransition('testing', 'post_test_monitoring')).toBe(true)
  })
  it('allows post_test_monitoring → resolved', () => {
    expect(canTransition('post_test_monitoring', 'resolved')).toBe(true)
  })
  it('allows post_test_monitoring → retest_needed', () => {
    expect(canTransition('post_test_monitoring', 'retest_needed')).toBe(true)
  })
  it('disallows resolved → anything', () => {
    expect(canTransition('resolved', 'flagged')).toBe(false)
  })
  it('disallows exhausted → anything', () => {
    expect(canTransition('exhausted', 'flagged')).toBe(false)
  })
})

describe('transitionState', () => {
  it('transitions flagged → diagnosed with summary', () => {
    const cycle = makeCycle({ state: 'flagged' })
    const result = transitionState(cycle, 'diagnosed', { diagnosis_summary: 'CTR below average' })
    expect(result.state).toBe('diagnosed')
    expect(result.diagnosed_at).toBeTruthy()
    expect(result.diagnosis_summary).toBe('CTR below average')
  })
  it('transitions test_suggested → testing with ab_test_id', () => {
    const cycle = makeCycle({ state: 'test_suggested' })
    const result = transitionState(cycle, 'testing', { ab_test_id: 'test-123' })
    expect(result.state).toBe('testing')
    expect(result.ab_test_id).toBe('test-123')
    expect(result.testing_started_at).toBeTruthy()
  })
  it('transitions post_test_monitoring → resolved', () => {
    const cycle = makeCycle({ state: 'post_test_monitoring', test_winner_applied_at: new Date().toISOString() })
    const result = transitionState(cycle, 'resolved', { resolved_reason: 'grade_improved' })
    expect(result.state).toBe('resolved')
    expect(result.resolved_at).toBeTruthy()
    expect(result.resolved_reason).toBe('grade_improved')
  })
  it('transitions retest_needed → exhausted at max cycles', () => {
    const cycle = makeCycle({ state: 'retest_needed', cycle_number: 5 })
    const result = transitionState(cycle, 'exhausted', {})
    expect(result.state).toBe('exhausted')
  })
  it('throws for invalid transition', () => {
    const cycle = makeCycle({ state: 'resolved' })
    expect(() => transitionState(cycle, 'flagged', {})).toThrow()
  })
})

describe('isInCooldown', () => {
  it('returns true if within cooldown period', () => {
    const applied = new Date()
    applied.setDate(applied.getDate() - 30)
    expect(isInCooldown(applied.toISOString())).toBe(true)
  })
  it('returns false if past cooldown period', () => {
    const applied = new Date()
    applied.setDate(applied.getDate() - 61)
    expect(isInCooldown(applied.toISOString())).toBe(false)
  })
  it('returns false for null', () => {
    expect(isInCooldown(null)).toBe(false)
  })
})

describe('getMaxCycles', () => {
  it('returns configured max', () => {
    expect(getMaxCycles()).toBe(OPTIMIZATION_CONFIG.max_cycles_per_video)
  })
})

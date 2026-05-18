export const OPTIMIZATION_CONFIG = {
  min_consecutive_low_weeks: 2,
  cooldown_days: 60,
  max_cycles_per_video: 5,
  monitoring_check_days: [7, 14, 30] as const,
  ctr_drop_rollback_threshold_percent: -10,
  grade_improvement_target: 'B' as const,
}

export type OptimizationState =
  | 'unmonitored' | 'flagged' | 'diagnosed' | 'test_suggested'
  | 'testing' | 'post_test_monitoring' | 'resolved' | 'retest_needed' | 'exhausted'

export interface OptimizationCycle {
  id: string
  youtube_video_id: string
  site_id: string
  state: OptimizationState
  cycle_number: number
  flagged_at: string | null
  diagnosed_at: string | null
  diagnosis_summary: string | null
  test_suggested_at: string | null
  test_suggestion: unknown | null
  ab_test_id: string | null
  testing_started_at: string | null
  test_completed_at: string | null
  test_winner_applied_at: string | null
  monitoring_day7_at: string | null
  monitoring_day7_result: unknown | null
  monitoring_day14_at: string | null
  monitoring_day14_result: unknown | null
  monitoring_day30_at: string | null
  monitoring_day30_result: unknown | null
  resolved_at: string | null
  resolved_reason: string | null
  cooldown_until: string | null
}

export interface TransitionTrigger {
  diagnosis_summary?: string
  test_suggestion?: unknown
  ab_test_id?: string
  resolved_reason?: string
  monitoring_result?: unknown
}

const VALID_TRANSITIONS: Record<OptimizationState, OptimizationState[]> = {
  unmonitored: ['flagged'],
  flagged: ['diagnosed', 'unmonitored'],
  diagnosed: ['test_suggested', 'unmonitored'],
  test_suggested: ['testing', 'diagnosed'],
  testing: ['post_test_monitoring', 'retest_needed'],
  post_test_monitoring: ['resolved', 'retest_needed'],
  retest_needed: ['flagged', 'exhausted'],
  resolved: ['flagged', 'exhausted'],
  exhausted: [],
}

export function canTransition(from: OptimizationState, to: OptimizationState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function transitionState(
  cycle: OptimizationCycle,
  to: OptimizationState,
  trigger: TransitionTrigger,
): OptimizationCycle {
  if (!canTransition(cycle.state, to)) {
    throw new Error(`Invalid transition: ${cycle.state} → ${to}`)
  }

  const now = new Date().toISOString()
  const updated = { ...cycle, state: to }

  switch (to) {
    case 'flagged': {
      const nextCycle = (cycle.state === 'unmonitored' || cycle.state === 'retest_needed' || cycle.state === 'resolved')
        ? cycle.cycle_number + 1
        : cycle.cycle_number
      if (nextCycle > OPTIMIZATION_CONFIG.max_cycles_per_video) {
        updated.state = 'exhausted'
        updated.resolved_at = now
        updated.resolved_reason = 'max_cycles_reached'
        return updated
      }
      updated.cycle_number = nextCycle
      updated.flagged_at = now
      updated.cooldown_until = null
      break
    }
    case 'diagnosed':
      updated.diagnosed_at = now
      updated.diagnosis_summary = trigger.diagnosis_summary ?? null
      break
    case 'test_suggested':
      updated.test_suggested_at = now
      updated.test_suggestion = trigger.test_suggestion ?? null
      break
    case 'testing':
      updated.testing_started_at = now
      updated.ab_test_id = trigger.ab_test_id ?? null
      break
    case 'post_test_monitoring':
      updated.test_completed_at = now
      updated.test_winner_applied_at = now
      break
    case 'resolved':
      updated.resolved_at = now
      updated.resolved_reason = trigger.resolved_reason ?? null
      break
    case 'retest_needed':
      updated.cooldown_until = new Date(Date.now() + OPTIMIZATION_CONFIG.cooldown_days * 86400000).toISOString()
      break
    case 'exhausted':
      updated.resolved_at = now
      updated.resolved_reason = 'max_cycles_reached'
      break
    case 'unmonitored':
      break
  }

  return updated
}

export function isInCooldown(testWinnerAppliedAt: string | null, cooldownUntil?: string | null): boolean {
  if (cooldownUntil) {
    return new Date() < new Date(cooldownUntil)
  }
  if (!testWinnerAppliedAt) return false
  const appliedDate = new Date(testWinnerAppliedAt)
  const cooldownEnd = new Date(appliedDate.getTime() + OPTIMIZATION_CONFIG.cooldown_days * 86400000)
  return new Date() < cooldownEnd
}

export function getMaxCycles(): number {
  return OPTIMIZATION_CONFIG.max_cycles_per_video
}

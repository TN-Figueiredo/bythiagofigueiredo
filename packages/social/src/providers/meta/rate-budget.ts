export interface RateBudget {
  callCount: number
  totalCpuTime: number
  totalTime: number
}

export interface RateBudgetCheck {
  sufficient: boolean
  remaining: number
  required: number
}

export function checkRateBudget(remaining: number, slideCount: number): RateBudgetCheck {
  const required = slideCount * 2
  return { sufficient: remaining >= required, remaining, required }
}

export function parseAppUsageHeader(headerValue: string | null): RateBudget | null {
  if (!headerValue) return null
  try {
    const parsed = JSON.parse(headerValue)
    return {
      callCount: parsed.call_count ?? 0,
      totalCpuTime: parsed.total_cputime ?? 0,
      totalTime: parsed.total_time ?? 0,
    }
  } catch { return null }
}

const IG_DAILY_LIMIT = 100

export function remainingFromUsage(usage: RateBudget): number {
  return Math.max(0, IG_DAILY_LIMIT - usage.callCount)
}

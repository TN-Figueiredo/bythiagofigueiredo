export interface Goal {
  id: string
  name: string
  metric: 'clicks' | 'unique_visitors'
  threshold: number
  linkId: string
}

export interface GoalResult {
  matched: boolean
  current: number
  threshold: number
}

export interface ConversionResult {
  views: number
  conversions: number
  rate: number
  progress: number
  label: string
}

export function matchGoal(goal: Goal, currentValue: number): boolean {
  return currentValue >= goal.threshold
}

export function computeConversion(views: number, conversions: number): ConversionResult {
  if (views === 0) {
    return { views: 0, conversions: 0, rate: 0, progress: 0, label: '0.0%' }
  }

  const rawRate = (conversions / views) * 100
  const rate = Math.min(rawRate, 100)
  const progress = Math.min(conversions / views, 1)
  const label = `${rate.toFixed(1)}%`

  return { views, conversions, rate, progress, label }
}

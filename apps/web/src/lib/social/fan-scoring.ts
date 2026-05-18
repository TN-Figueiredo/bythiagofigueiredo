export interface FanScoreInput {
  totalInteractions: number
  platformCount: number
  activeDays: number
  lastSeenDaysAgo: number
}

export function computeFanScore(input: FanScoreInput): number {
  const { totalInteractions, platformCount, activeDays, lastSeenDaysAgo } = input

  // Frequency: max 25 points, capped at 50 interactions
  const frequency = (Math.min(totalInteractions, 50) / 50) * 25

  // Recency: max 25 points, full score if within 7 days, decays 1pt/day after
  const recency = lastSeenDaysAgo <= 7 ? 25 : Math.max(0, 25 - lastSeenDaysAgo)

  // Cross-platform: max 25 points, linear with platform count (max 4)
  const crossPlatform = (Math.min(platformCount, 4) / 4) * 25

  // Consistency: max 25 points, linear with active days in 90d window (max 30)
  const consistency = (Math.min(activeDays, 30) / 30) * 25

  return Math.round(frequency + recency + crossPlatform + consistency)
}

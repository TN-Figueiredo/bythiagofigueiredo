export interface EngagementInput {
  views: number
  readsComplete: number
  avgDepth: number // 0-100
  avgTime: number  // seconds
}

/**
 * Compute an engagement score from 0 to 100.
 *
 * Weights:
 * - Completion rate (readsComplete / views): 40%
 * - Average depth: 30%
 * - Average time (capped at 300s): 30%
 */
export function computeEngagementScore(input: EngagementInput): number {
  const { views, readsComplete, avgDepth, avgTime } = input

  if (views === 0) return 0

  // Completion: ratio of completes to views, capped at 1
  const completionRate = Math.min(readsComplete / views, 1)
  const completionScore = completionRate * 100

  // Depth: already 0-100
  const depthScore = Math.min(Math.max(avgDepth, 0), 100)

  // Time: capped at 300s → normalized to 0-100
  const cappedTime = Math.min(Math.max(avgTime, 0), 300)
  const timeScore = (cappedTime / 300) * 100

  const raw = completionScore * 0.4 + depthScore * 0.3 + timeScore * 0.3

  return Math.round(Math.min(Math.max(raw, 0), 100))
}

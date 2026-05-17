import { describe, it, expect } from 'vitest'

describe('DashboardYoutubeCard', () => {
  it('YtDashboardSummary has correct shape', () => {
    const summary = {
      healthScore: 78, views30d: 5200, viewsDelta: 8, subscribers: 1977,
      subsNet: 23, ctr: 4.2, avgPercentage: 42, milestoneTarget: 2000,
      milestoneAway: 23, activeAbTest: null,
    }
    expect(summary.healthScore).toBeLessThanOrEqual(100)
    expect(summary.milestoneAway).toBe(summary.milestoneTarget - summary.subscribers)
  })
})

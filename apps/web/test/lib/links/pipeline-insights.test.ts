import { describe, it, expect } from 'vitest'
import { buildInsightsPayload } from '@/lib/links/pipeline-insights'

describe('buildInsightsPayload', () => {
  it('builds payload with metrics summary', () => {
    const payload = buildInsightsPayload({
      totalClicks: 5000,
      totalLinks: 25,
      topLink: { title: 'Landing', clicks: 500 },
      unhealthyCount: 2,
      qrScans: 300,
    })
    expect(payload.context).toContain('5.000')
    expect(payload.context).toContain('Landing')
    expect(payload.question).toBeTruthy()
  })

  it('returns structured format for pipeline', () => {
    const payload = buildInsightsPayload({
      totalClicks: 1000,
      totalLinks: 10,
      topLink: null,
      unhealthyCount: 0,
      qrScans: 0,
    })
    expect(payload).toHaveProperty('context')
    expect(payload).toHaveProperty('question')
    expect(typeof payload.context).toBe('string')
    expect(typeof payload.question).toBe('string')
  })
})

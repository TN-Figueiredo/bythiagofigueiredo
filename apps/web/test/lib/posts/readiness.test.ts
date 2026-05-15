import { describe, it, expect } from 'vitest'
import { computeReadiness, type ReadinessInput } from '@/lib/posts/readiness'

describe('computeReadiness', () => {
  const empty: ReadinessInput = {
    content: { titleFilled: false, hookFilled: false, bodyFilled: false },
    images: { coverSet: false },
    seo: { metaTitleFilled: false, metaDescriptionFilled: false, score: 0 },
    social: { platformsConfigured: 0 },
    schedule: { dateSet: false, dateSaved: false },
    newsletter: { decisionMade: false },
  }

  it('returns 0 for completely empty post', () => {
    const result = computeReadiness(empty)
    expect(result.score).toBe(0)
    expect(result.sections.content.status).toBe('empty')
  })

  it('returns 100 for fully complete post', () => {
    const full: ReadinessInput = {
      content: { titleFilled: true, hookFilled: true, bodyFilled: true },
      images: { coverSet: true },
      seo: { metaTitleFilled: true, metaDescriptionFilled: true, score: 85 },
      social: { platformsConfigured: 2 },
      schedule: { dateSet: true, dateSaved: true },
      newsletter: { decisionMade: true },
    }
    const result = computeReadiness(full)
    expect(result.score).toBe(100)
    expect(result.sections.content.status).toBe('done')
  })

  it('assigns correct weights: content=20, images=15, seo=20, social=20, schedule=15, newsletter=10', () => {
    const onlyContent: ReadinessInput = {
      ...empty,
      content: { titleFilled: true, hookFilled: true, bodyFilled: true },
    }
    expect(computeReadiness(onlyContent).score).toBe(20)
  })

  it('treats seo score < 70 as warn, not done', () => {
    const lowSeo: ReadinessInput = {
      ...empty,
      seo: { metaTitleFilled: true, metaDescriptionFilled: true, score: 50 },
    }
    const result = computeReadiness(lowSeo)
    expect(result.sections.seo.status).toBe('warn')
  })

  it('partial content (2 of 3 fields) gives proportional score', () => {
    const partial: ReadinessInput = {
      ...empty,
      content: { titleFilled: true, hookFilled: true, bodyFilled: false },
    }
    const result = computeReadiness(partial)
    // 2/3 * 20 weight = ~13
    expect(result.score).toBeCloseTo(13, 0)
  })
})

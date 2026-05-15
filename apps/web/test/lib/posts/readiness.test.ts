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

  it('SEO section earns 15 (not 20) when fields filled but score < 70', () => {
    const input: ReadinessInput = {
      ...empty,
      seo: { metaTitleFilled: true, metaDescriptionFilled: true, score: 50 },
    }
    const result = computeReadiness(input)
    expect(result.sections.seo.earned).toBe(15)
    expect(result.sections.seo.status).toBe('warn')
  })

  it('schedule section returns warn when date set but not saved', () => {
    const input: ReadinessInput = {
      ...empty,
      schedule: { dateSet: true, dateSaved: false },
    }
    const result = computeReadiness(input)
    expect(result.sections.schedule.status).toBe('warn')
    expect(result.sections.schedule.earned).toBe(0)
  })

  it('newsletter section gives 10 points when decisionMade', () => {
    const input: ReadinessInput = {
      ...empty,
      newsletter: { decisionMade: true },
    }
    const result = computeReadiness(input)
    expect(result.sections.newsletter.earned).toBe(10)
    expect(result.sections.newsletter.status).toBe('done')
  })

  it('content section with 1/3 fields gives proportional score', () => {
    const input: ReadinessInput = {
      ...empty,
      content: { titleFilled: true, hookFilled: false, bodyFilled: false },
    }
    const result = computeReadiness(input)
    expect(result.sections.content.earned).toBe(7) // Math.round(1/3 * 20)
    expect(result.sections.content.status).toBe('warn')
  })

  it('social section gives full credit with 1 or more platforms', () => {
    const input1: ReadinessInput = { ...empty, social: { platformsConfigured: 1 } }
    const input4: ReadinessInput = { ...empty, social: { platformsConfigured: 4 } }
    expect(computeReadiness(input1).sections.social.earned).toBe(20)
    expect(computeReadiness(input4).sections.social.earned).toBe(20)
  })

  it('section weights match expected values', () => {
    const result = computeReadiness(empty)
    const weights = Object.fromEntries(Object.entries(result.sections).map(([k, s]) => [k, s.weight]))
    expect(weights).toEqual({
      content: 20,
      images: 15,
      seo: 20,
      social: 20,
      schedule: 15,
      newsletter: 10,
    })
  })
})

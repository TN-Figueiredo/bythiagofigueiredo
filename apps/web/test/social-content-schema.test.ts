import { describe, it, expect } from 'vitest'
import { SocialPostContentSchema } from '@tn-figueiredo/social'

describe('SocialPostContentSchema', () => {
  it('accepts content with captions map', () => {
    const result = SocialPostContentSchema.safeParse({
      description: 'Hello world',
      captions: { facebook: 'FB caption', instagram: 'IG caption' },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.captions).toEqual({ facebook: 'FB caption', instagram: 'IG caption' })
    }
  })

  it('accepts content without captions (backward compat)', () => {
    const result = SocialPostContentSchema.safeParse({
      description: 'Hello world',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.captions).toBeUndefined()
    }
  })

  it('accepts empty captions map', () => {
    const result = SocialPostContentSchema.safeParse({
      description: 'Test',
      captions: {},
    })
    expect(result.success).toBe(true)
  })
})

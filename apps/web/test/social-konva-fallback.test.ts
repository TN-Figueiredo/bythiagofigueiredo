import { describe, it, expect } from 'vitest'

describe('Konva renderer fallback', () => {
  it('uses warm gradient color instead of #333333 for missing images', async () => {
    const fs = await import('fs')
    const src = fs.readFileSync(
      'src/lib/social/konva-renderer.ts',
      'utf-8',
    )
    const darkFallbackCount = (src.match(/fill: '#333333'/g) || []).length
    expect(darkFallbackCount).toBe(0)
    expect(src).toContain('fillLinearGradientColorStops')
  })
})

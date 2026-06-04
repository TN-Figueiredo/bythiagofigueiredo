import { describe, it, expect } from 'vitest'

describe('stuck post recovery in cron', () => {
  it('file contains query for publishing status with updated_at check', async () => {
    const fs = await import('fs')
    const src = fs.readFileSync(
      'src/app/api/cron/social-publish/route.ts',
      'utf-8',
    )
    // Should query for posts stuck in 'publishing' status
    expect(src).toContain("eq('status', 'publishing')")
    // Should check updated_at for timeout
    expect(src).toContain('lt(')
    // Should have a 10-minute window
    expect(src).toContain('10 * 60')
  })
})

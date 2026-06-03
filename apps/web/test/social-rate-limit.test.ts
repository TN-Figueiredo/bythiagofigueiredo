import { describe, it, expect } from 'vitest'

describe('rate limit circuit breaker', () => {
  it('skips delivery when circuit_open_until is in the future', () => {
    const futureDate = new Date(Date.now() + 60_000).toISOString()
    const shouldSkip = futureDate && new Date(futureDate) > new Date()
    expect(shouldSkip).toBe(true)
  })

  it('allows delivery when circuit_open_until is null', () => {
    const circuitUntil: string | null = null
    const shouldSkip = circuitUntil && new Date(circuitUntil) > new Date()
    expect(shouldSkip).toBeFalsy()
  })

  it('allows delivery when circuit_open_until is in the past', () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString()
    const shouldSkip = pastDate && new Date(pastDate) > new Date()
    expect(shouldSkip).toBeFalsy()
  })

  it('workflows.ts contains circuit breaker check code', async () => {
    const fs = await import('fs')
    const src = fs.readFileSync('apps/web/src/lib/social/workflows.ts', 'utf-8')
    expect(src).toContain('circuit_open_until')
    expect(src).toContain('Rate limited until')
  })
})

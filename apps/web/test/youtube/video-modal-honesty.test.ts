import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const src = readFileSync(
  resolve(__dirname, '../../src/app/cms/(authed)/youtube/competitors/_components/video-modal.tsx'),
  'utf-8',
)

describe('video-modal honesty audit', () => {
  it('does not use Math.random()', () => {
    expect(src).not.toContain('Math.random')
  })

  it('does not contain fabricated CTR heuristic', () => {
    expect(src).not.toContain('ctr estimado')
    expect(src).not.toContain('3.4 +')
  })

  it('does not contain simulated TrendChart', () => {
    expect(src).not.toContain('TrendChart')
    expect(src).not.toContain('pct48h')
  })

  it('contains real "idade" metric', () => {
    expect(src).toContain('idade')
    expect(src).toContain('ageDays')
  })
})

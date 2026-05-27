import { describe, it, expect } from 'vitest'
import { scoreForPrompt } from '@/lib/youtube/prompt-scoring'

describe('scoreForPrompt', () => {
  it('computes weighted score from ctr and retention', () => {
    const { score, grade } = scoreForPrompt(5.0, 40)
    // 5 * 0.3 + 40 * 0.7 = 1.5 + 28 = 29.5 → 30
    expect(score).toBe(30)
    expect(grade).toBe('D')
  })

  it('assigns correct grades at thresholds', () => {
    // A ≥ 85: ctr=100, retention=100 → 100*0.3 + 100*0.7 = 100
    expect(scoreForPrompt(100, 100).grade).toBe('A')
    // B ≥ 65: ctr=10, retention=90 → 3 + 63 = 66
    expect(scoreForPrompt(10, 90).grade).toBe('B')
    // C ≥ 40: ctr=5, retention=60 → 1.5 + 42 = 43.5 → 44
    expect(scoreForPrompt(5, 60).grade).toBe('C')
    // D < 40: ctr=0, retention=0 → 0
    expect(scoreForPrompt(0, 0).grade).toBe('D')
  })

  it('handles zero inputs', () => {
    const { score, grade } = scoreForPrompt(0, 0)
    expect(score).toBe(0)
    expect(grade).toBe('D')
  })

  it('rounds to integer', () => {
    const { score } = scoreForPrompt(3.3, 33.3)
    expect(Number.isInteger(score)).toBe(true)
  })
})

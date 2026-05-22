import { describe, it, expect } from 'vitest'
import { isValidStage, getNextStage, getPreviousStage, WORKFLOWS, getPipelineStages } from '@/lib/pipeline/workflows'

describe('isValidStage', () => {
  it('returns true for valid video stages', () => {
    expect(isValidStage('video', 'idea')).toBe(true)
    expect(isValidStage('video', 'gravacao')).toBe(true)
    expect(isValidStage('video', 'published')).toBe(true)
  })

  it('returns false for cross-format stages', () => {
    expect(isValidStage('blog_post', 'gravacao')).toBe(false)
    expect(isValidStage('newsletter', 'edicao')).toBe(false)
    expect(isValidStage('video', 'approved')).toBe(false)
  })

  it('returns false for invented stages', () => {
    expect(isValidStage('video', 'banana')).toBe(false)
    expect(isValidStage('blog_post', 'final_review')).toBe(false)
  })
})

describe('getNextStage', () => {
  it('advances video idea to roteiro', () => {
    expect(getNextStage('video', 'idea')).toBe('roteiro')
  })

  it('returns null at final stage', () => {
    expect(getNextStage('video', 'published')).toBeNull()
  })
})

describe('getPreviousStage', () => {
  it('retreats video roteiro to idea', () => {
    expect(getPreviousStage('video', 'roteiro')).toBe('idea')
  })

  it('returns null at first stage', () => {
    expect(getPreviousStage('video', 'idea')).toBeNull()
  })
})

describe('blog_post full workflow', () => {
  it('includes all 5 stages for blog_post', () => {
    const stages = WORKFLOWS.blog_post
    expect(stages.map(s => s.stage)).toEqual(['idea', 'draft', 'ready', 'scheduled', 'published'])
  })

  it('getPipelineStages returns all 5 for blog_post', () => {
    const stages = getPipelineStages('blog_post')
    expect(stages).toHaveLength(5)
    expect(stages.map(s => s.stage)).toEqual(['idea', 'draft', 'ready', 'scheduled', 'published'])
  })

  it('ready stage has label Entrega/Delivery', () => {
    const ready = WORKFLOWS.blog_post.find(s => s.stage === 'ready')
    expect(ready?.label_pt).toBe('Entrega')
    expect(ready?.label_en).toBe('Delivery')
  })
})

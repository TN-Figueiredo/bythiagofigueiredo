import { describe, it, expect } from 'vitest'
import { getNextStage, getPreviousStage, isFinalStage, isFirstStage } from '@/lib/pipeline/workflows'

describe('Stage advancement logic', () => {
  it('video: idea -> roteiro', () => {
    expect(getNextStage('video', 'idea')).toBe('roteiro')
  })

  it('video: published -> null (final)', () => {
    expect(getNextStage('video', 'published')).toBeNull()
  })

  it('video: idea has no previous', () => {
    expect(getPreviousStage('video', 'idea')).toBeNull()
  })

  it('video: roteiro -> idea (retreat)', () => {
    expect(getPreviousStage('video', 'roteiro')).toBe('idea')
  })

  it('blog_post: draft -> ready', () => {
    expect(getNextStage('blog_post', 'draft')).toBe('ready')
  })

  it('isFinalStage works', () => {
    expect(isFinalStage('video', 'published')).toBe(true)
    expect(isFinalStage('video', 'edicao')).toBe(false)
    expect(isFinalStage('campaign', 'sent')).toBe(true)
  })

  it('isFirstStage works', () => {
    expect(isFirstStage('video', 'idea')).toBe(true)
    expect(isFirstStage('video', 'roteiro')).toBe(false)
  })
})

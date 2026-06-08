import { describe, it, expect } from 'vitest'
import { videoColumn, isRecorded, REACHED_BY, OPEN_AT } from '@/lib/pipeline/video-lifecycle'

describe('videoColumn', () => {
  it('maps all 7 video DB stages to 4 columns', () => {
    expect(videoColumn('idea')).toBe('idea')
    expect(videoColumn('roteiro')).toBe('roteiro')
    expect(videoColumn('gravacao')).toBe('gravacao')
    expect(videoColumn('edicao')).toBe('gravacao')
    expect(videoColumn('pos_producao')).toBe('gravacao')
    expect(videoColumn('scheduled')).toBe('published')
    expect(videoColumn('published')).toBe('published')
  })

  it('uses canonical idea/published tokens (never ideia/publicado)', () => {
    expect(videoColumn('idea')).toBe('idea')
    expect(videoColumn('published')).toBe('published')
  })

  it('falls back to idea for unknown stage', () => {
    expect(videoColumn('banana')).toBe('idea')
    expect(videoColumn('')).toBe('idea')
  })
})

describe('isRecorded', () => {
  it('is false before gravacao (position < 3)', () => {
    expect(isRecorded('idea')).toBe(false)
    expect(isRecorded('roteiro')).toBe(false)
  })

  it('is true at/after gravacao (position >= 3)', () => {
    expect(isRecorded('gravacao')).toBe(true)
    expect(isRecorded('edicao')).toBe(true)
    expect(isRecorded('pos_producao')).toBe(true)
    expect(isRecorded('scheduled')).toBe(true)
    expect(isRecorded('published')).toBe(true)
  })
})

describe('REACHED_BY', () => {
  it('returns the column ordinal 0..3', () => {
    expect(REACHED_BY('idea')).toBe(0)
    expect(REACHED_BY('roteiro')).toBe(1)
    expect(REACHED_BY('edicao')).toBe(2)
    expect(REACHED_BY('published')).toBe(3)
  })
})

describe('OPEN_AT', () => {
  it('maps stage to the editor tab to open on', () => {
    expect(OPEN_AT('idea')).toBe('ideia')
    expect(OPEN_AT('roteiro')).toBe('roteiro')
    expect(OPEN_AT('gravacao')).toBe('pos')
    expect(OPEN_AT('edicao')).toBe('pos')
    expect(OPEN_AT('pos_producao')).toBe('pos')
    expect(OPEN_AT('scheduled')).toBe('publicacao')
    expect(OPEN_AT('published')).toBe('publicacao')
  })
})

import { describe, it, expect } from 'vitest'
import { slugToName, parseTopicSlug, validateTopicSlugDepth, MAX_TOPIC_DEPTH } from '@/lib/pipeline/research-topics'

describe('slugToName', () => {
  it('converts single word slug', () => {
    expect(slugToName('gaming')).toBe('Gaming')
  })

  it('converts multi-word slug', () => {
    expect(slugToName('gaming-history')).toBe('Gaming History')
  })

  it('converts slug with numbers', () => {
    expect(slugToName('ai-dev-101')).toBe('Ai Dev 101')
  })

  it('handles single character segments', () => {
    expect(slugToName('a-b-c')).toBe('A B C')
  })
})

describe('parseTopicSlug', () => {
  it('parses single segment', () => {
    expect(parseTopicSlug('gaming')).toEqual(['gaming'])
  })

  it('parses multi-segment path', () => {
    expect(parseTopicSlug('gaming-history/wyd')).toEqual(['gaming-history', 'wyd'])
  })

  it('parses 3-level path', () => {
    expect(parseTopicSlug('cursos/ai-dev/prompt')).toEqual(['cursos', 'ai-dev', 'prompt'])
  })

  it('filters empty segments from double slashes', () => {
    expect(parseTopicSlug('a//b')).toEqual(['a', 'b'])
  })

  it('filters leading/trailing slashes', () => {
    expect(parseTopicSlug('/gaming/')).toEqual(['gaming'])
  })
})

describe('MAX_TOPIC_DEPTH', () => {
  it('is 2 (3 levels: depth 0, 1, 2)', () => {
    expect(MAX_TOPIC_DEPTH).toBe(2)
  })
})

describe('validateTopicSlugDepth', () => {
  it('accepts 1 level', () => {
    expect(validateTopicSlugDepth('gaming')).toBe(true)
  })

  it('accepts 2 levels', () => {
    expect(validateTopicSlugDepth('gaming/wyd')).toBe(true)
  })

  it('accepts 3 levels (max)', () => {
    expect(validateTopicSlugDepth('a/b/c')).toBe(true)
  })

  it('rejects 4 levels', () => {
    expect(validateTopicSlugDepth('a/b/c/d')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateTopicSlugDepth('')).toBe(false)
  })
})

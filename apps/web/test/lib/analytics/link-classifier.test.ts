import { describe, it, expect } from 'vitest'
import {
  classifyLink,
  linkTypeBadgeColor,
  linkTypeLabel,
} from '@/lib/analytics/link-classifier'

const SITE_ORIGIN = 'https://bythiagofigueiredo.com'

describe('classifyLink', () => {
  it('classifies relative /go/ links as shortlink', () => {
    expect(classifyLink('/go/abc123', SITE_ORIGIN)).toBe('shortlink')
    expect(classifyLink('/go/', SITE_ORIGIN)).toBe('shortlink')
  })

  it('classifies go. subdomain as shortlink', () => {
    expect(classifyLink('https://go.bythiagofigueiredo.com/xyz', SITE_ORIGIN)).toBe('shortlink')
  })

  it('classifies same-origin links as internal', () => {
    expect(classifyLink('https://bythiagofigueiredo.com/blog/post-1', SITE_ORIGIN)).toBe('internal')
    expect(classifyLink('/blog/post-1', SITE_ORIGIN)).toBe('internal')
  })

  it('classifies www variant as internal', () => {
    expect(classifyLink('https://www.bythiagofigueiredo.com/about', SITE_ORIGIN)).toBe('internal')
  })

  it('classifies different domains as external', () => {
    expect(classifyLink('https://google.com', SITE_ORIGIN)).toBe('external')
    expect(classifyLink('https://youtube.com/watch?v=abc', SITE_ORIGIN)).toBe('external')
  })

  it('handles invalid URLs gracefully', () => {
    expect(classifyLink('not-a-url-://invalid', SITE_ORIGIN)).toBe('external')
  })

  it('handles relative links without /go/ as internal', () => {
    expect(classifyLink('/about', SITE_ORIGIN)).toBe('internal')
    expect(classifyLink('/newsletter', SITE_ORIGIN)).toBe('internal')
  })

  it('recognizes go. subdomain with www origin', () => {
    expect(classifyLink('https://go.example.com/x', 'https://www.example.com')).toBe('shortlink')
  })
})

describe('linkTypeBadgeColor', () => {
  it('returns correct colors', () => {
    expect(linkTypeBadgeColor('internal')).toBe('var(--color-int)')
    expect(linkTypeBadgeColor('external')).toBe('var(--color-link)')
    expect(linkTypeBadgeColor('shortlink')).toBe('var(--acc)')
  })
})

describe('linkTypeLabel', () => {
  it('returns correct labels', () => {
    expect(linkTypeLabel('internal')).toBe('Internal')
    expect(linkTypeLabel('external')).toBe('External')
    expect(linkTypeLabel('shortlink')).toBe('Shortlink')
  })
})

import { describe, it, expect } from 'vitest'
import {
  resolveCaption,
  resolvedLength,
  findMissingLink,
  PLATFORM_CAPTION_DEFAULTS,
  type CaptionContext,
} from '@/lib/social/caption-variables'

describe('resolveCaption', () => {
  const ctx: CaptionContext = {
    link: 'go.btf.com/abc123',
    title: 'Como configurar OAuth 2.0',
    url: 'https://bythiagofigueiredo.com/blog/oauth-guide',
  }

  it('replaces {{link}} with short URL', () => {
    expect(resolveCaption('Visit {{link}}', ctx)).toBe('Visit go.btf.com/abc123')
  })

  it('replaces {{title}} with post title', () => {
    expect(resolveCaption('New: {{title}}', ctx)).toBe('New: Como configurar OAuth 2.0')
  })

  it('replaces {{url}} with raw destination URL', () => {
    expect(resolveCaption('Read: {{url}}', ctx)).toBe(
      'Read: https://bythiagofigueiredo.com/blog/oauth-guide',
    )
  })

  it('replaces multiple variables in one template', () => {
    expect(resolveCaption('{{title}}\n\n{{link}}', ctx)).toBe(
      'Como configurar OAuth 2.0\n\ngo.btf.com/abc123',
    )
  })

  it('leaves unknown variables like {{foo}} as literal text', () => {
    expect(resolveCaption('Hello {{foo}} world', ctx)).toBe('Hello {{foo}} world')
  })

  it('replaces missing context values with empty string', () => {
    const partial: CaptionContext = { link: '', title: '', url: '' }
    expect(resolveCaption('{{title}} - {{link}}', partial)).toBe(' - ')
  })

  it('handles template with no variables', () => {
    expect(resolveCaption('Plain text caption', ctx)).toBe('Plain text caption')
  })

  it('handles empty template', () => {
    expect(resolveCaption('', ctx)).toBe('')
  })
})

describe('resolvedLength', () => {
  it('calculates length using resolved values', () => {
    const ctx: CaptionContext = {
      link: 'go.btf.com/abc123',
      title: 'Test',
      url: 'https://example.com',
    }
    // "Test\n\ngo.btf.com/abc123" = 4 + 2 + 17 = 23
    expect(resolvedLength('{{title}}\n\n{{link}}', ctx)).toBe(23)
  })

  it('uses 24 chars as placeholder when link is empty', () => {
    const ctx: CaptionContext = { link: '', title: 'Test', url: '' }
    // "Test\n\n" + 24 placeholder chars = 4 + 2 + 24 = 30
    expect(resolvedLength('{{title}}\n\n{{link}}', ctx)).toBe(30)
  })

  it('uses actual link length when link is provided', () => {
    const ctx: CaptionContext = { link: 'go.btf.com/x', title: 'A', url: '' }
    // "A\n\ngo.btf.com/x" = 1 + 2 + 12 = 15
    expect(resolvedLength('{{title}}\n\n{{link}}', ctx)).toBe(15)
  })

  it('returns plain text length when no variables', () => {
    const ctx: CaptionContext = { link: '', title: '', url: '' }
    expect(resolvedLength('Hello world', ctx)).toBe(11)
  })
})

describe('findMissingLink', () => {
  it('returns true when template has no {{link}}', () => {
    expect(findMissingLink('Just {{title}}')).toBe(true)
  })

  it('returns false when template contains {{link}}', () => {
    expect(findMissingLink('{{title}}\n{{link}}')).toBe(false)
  })

  it('returns true for empty template', () => {
    expect(findMissingLink('')).toBe(true)
  })

  it('returns true for plain text', () => {
    expect(findMissingLink('No variables here')).toBe(true)
  })
})

describe('PLATFORM_CAPTION_DEFAULTS', () => {
  it('has defaults for all 4 platforms', () => {
    expect(PLATFORM_CAPTION_DEFAULTS).toHaveProperty('facebook')
    expect(PLATFORM_CAPTION_DEFAULTS).toHaveProperty('bluesky')
    expect(PLATFORM_CAPTION_DEFAULTS).toHaveProperty('instagram')
    expect(PLATFORM_CAPTION_DEFAULTS).toHaveProperty('youtube')
  })

  it('Facebook default includes {{title}} and {{link}}', () => {
    expect(PLATFORM_CAPTION_DEFAULTS.facebook).toContain('{{title}}')
    expect(PLATFORM_CAPTION_DEFAULTS.facebook).toContain('{{link}}')
  })

  it('Instagram default does NOT include {{link}}', () => {
    expect(PLATFORM_CAPTION_DEFAULTS.instagram).not.toContain('{{link}}')
    expect(PLATFORM_CAPTION_DEFAULTS.instagram).toContain('Link na bio')
  })
})

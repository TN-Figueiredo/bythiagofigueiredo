import { describe, it, expect } from 'vitest'
import {
  resolveCaption,
  resolvedLength,
  findMissingLink,
  PLATFORM_CAPTION_DEFAULTS,
  type CaptionContext,
} from '../src/lib/social/caption-variables'
import { DESTINATIONS, DEST_IDS, type DestId } from '../src/lib/social/destinations'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fullContext: CaptionContext = {
  title: 'Como construir um SaaS em 30 dias',
  link: 'https://bythiagofigueiredo.com/blog/saas-em-30-dias',
  url: 'https://bythiagofigueiredo.com/blog/saas-em-30-dias',
}

function truncate(text: string, limit: number): string {
  if (limit <= 0 || text.length <= limit) return text
  return text.slice(0, limit)
}

/**
 * Detects if a caption still contains an unresolved `{{link}}` placeholder.
 * Useful for catching save-before-resolve bugs.
 */
function hasUnresolvedLink(caption: string): boolean {
  return caption.includes('{{link}}')
}

/**
 * Simulates `handleCmsSelect` logic from compositor-new.tsx (lines 157-169).
 */
function simulateHandleCmsSelect(
  item: { title: string; description?: string | null },
  activeDestIds: DestId[],
): Record<string, string> {
  const title = item.description ?? item.title
  const captions: Record<string, string> = {}
  for (const id of activeDestIds) {
    const provider = DESTINATIONS[id].provider
    const template = PLATFORM_CAPTION_DEFAULTS[provider] ?? '{{title}}\n\n{{link}}'
    captions[id] = resolveCaption(template, { title, link: '{{link}}', url: '' })
  }
  return captions
}

// ---------------------------------------------------------------------------
// 1. resolveCaption replaces {{title}}
// ---------------------------------------------------------------------------
describe('resolveCaption — {{title}} substitution', () => {
  it('replaces {{title}} with provided value', () => {
    const result = resolveCaption('{{title}}', fullContext)
    expect(result).toBe(fullContext.title)
  })

  it('replaces {{title}} embedded in other text', () => {
    const result = resolveCaption('Novo post: {{title}} - confira!', fullContext)
    expect(result).toBe(`Novo post: ${fullContext.title} - confira!`)
  })

  it('replaces multiple occurrences of {{title}}', () => {
    const result = resolveCaption('{{title}} | {{title}}', fullContext)
    expect(result).toBe(`${fullContext.title} | ${fullContext.title}`)
  })
})

// ---------------------------------------------------------------------------
// 2. resolveCaption replaces {{link}}
// ---------------------------------------------------------------------------
describe('resolveCaption — {{link}} substitution', () => {
  it('replaces {{link}} with provided URL', () => {
    const result = resolveCaption('{{link}}', fullContext)
    expect(result).toBe(fullContext.link)
  })

  it('replaces {{link}} inside a template', () => {
    const result = resolveCaption('Leia mais: {{link}}', fullContext)
    expect(result).toBe(`Leia mais: ${fullContext.link}`)
  })
})

// ---------------------------------------------------------------------------
// 3. resolveCaption replaces {{url}}
// ---------------------------------------------------------------------------
describe('resolveCaption — {{url}} substitution', () => {
  it('replaces {{url}} with provided value', () => {
    const result = resolveCaption('Acesse: {{url}}', fullContext)
    expect(result).toBe(`Acesse: ${fullContext.url}`)
  })

  it('resolves {{url}} and {{link}} independently', () => {
    const ctx: CaptionContext = {
      title: 'Test',
      link: 'https://short.link/abc',
      url: 'https://full-site.com/article',
    }
    const result = resolveCaption('{{link}} — {{url}}', ctx)
    expect(result).toBe('https://short.link/abc — https://full-site.com/article')
  })
})

// ---------------------------------------------------------------------------
// 4. resolveCaption handles missing variables
// ---------------------------------------------------------------------------
describe('resolveCaption — missing variables', () => {
  it('replaces variable with empty string when context value is empty', () => {
    const ctx: CaptionContext = { title: '', link: '', url: '' }
    const result = resolveCaption('{{title}} {{link}} {{url}}', ctx)
    expect(result).toBe('  ')
  })

  it('only known variables are resolved — unknown placeholders survive', () => {
    const result = resolveCaption('{{title}} {{author}} {{link}}', fullContext)
    // {{author}} is not in KNOWN_VARS, so regex won't match it
    expect(result).toContain('{{author}}')
    expect(result).toContain(fullContext.title)
  })
})

// ---------------------------------------------------------------------------
// 5. resolveCaption handles double braces in content
// ---------------------------------------------------------------------------
describe('resolveCaption — literal braces in user content', () => {
  it('does not break when title itself contains double braces', () => {
    const ctx: CaptionContext = {
      title: 'Using {{templates}} in code',
      link: 'https://example.com',
      url: '',
    }
    // The title is substituted first, and the resulting text is not re-processed
    const result = resolveCaption('Post: {{title}}', ctx)
    expect(result).toBe('Post: Using {{templates}} in code')
  })

  it('preserves literal {{ }} that do not match known vars', () => {
    const result = resolveCaption('Code: {{ var }} and {{title}}', fullContext)
    expect(result).toContain('{{ var }}')
    expect(result).toContain(fullContext.title)
  })

  it('does not recurse into resolved values', () => {
    const ctx: CaptionContext = {
      title: '{{link}}',
      link: 'https://example.com',
      url: '',
    }
    // First resolve: {{title}} -> "{{link}}" and {{link}} -> url
    // Since replace is single-pass, the "{{link}}" inside title is already consumed
    const template = '{{title}} | {{link}}'
    const result = resolveCaption(template, ctx)
    // String.replace with /g is single-pass; the {{link}} that came from title is literal
    expect(result).toBe('{{link}} | https://example.com')
  })
})

// ---------------------------------------------------------------------------
// 6. PLATFORM_CAPTION_DEFAULTS for each provider
// ---------------------------------------------------------------------------
describe('PLATFORM_CAPTION_DEFAULTS', () => {
  const allProviders = ['facebook', 'instagram', 'youtube', 'bluesky'] as const

  it.each(allProviders)('has a default template for %s', (provider) => {
    expect(PLATFORM_CAPTION_DEFAULTS[provider]).toBeDefined()
    expect(typeof PLATFORM_CAPTION_DEFAULTS[provider]).toBe('string')
    expect(PLATFORM_CAPTION_DEFAULTS[provider].length).toBeGreaterThan(0)
  })

  it('facebook default includes {{title}} and {{link}}', () => {
    expect(PLATFORM_CAPTION_DEFAULTS.facebook).toContain('{{title}}')
    expect(PLATFORM_CAPTION_DEFAULTS.facebook).toContain('{{link}}')
  })

  it('bluesky default includes {{title}} and {{link}}', () => {
    expect(PLATFORM_CAPTION_DEFAULTS.bluesky).toContain('{{title}}')
    expect(PLATFORM_CAPTION_DEFAULTS.bluesky).toContain('{{link}}')
  })

  it('youtube default includes {{title}} and {{link}}', () => {
    expect(PLATFORM_CAPTION_DEFAULTS.youtube).toContain('{{title}}')
    expect(PLATFORM_CAPTION_DEFAULTS.youtube).toContain('{{link}}')
  })

  it('instagram default uses "Link na bio" instead of {{link}}', () => {
    expect(PLATFORM_CAPTION_DEFAULTS.instagram).toContain('{{title}}')
    expect(PLATFORM_CAPTION_DEFAULTS.instagram).toContain('Link na bio')
    expect(PLATFORM_CAPTION_DEFAULTS.instagram).not.toContain('{{link}}')
  })
})

// ---------------------------------------------------------------------------
// 7. Caption length limits per platform
// ---------------------------------------------------------------------------
describe('Caption length limits per destination', () => {
  it('ig_story has captionLimit 0 (text lives in the art, not the caption)', () => {
    expect(DESTINATIONS.ig_story.captionLimit).toBe(0)
  })

  it('yt_community has captionLimit 1500', () => {
    expect(DESTINATIONS.yt_community.captionLimit).toBe(1500)
  })

  it('fb_page has captionLimit 2200', () => {
    expect(DESTINATIONS.fb_page.captionLimit).toBe(2200)
  })

  it('ig_feed has captionLimit 2200', () => {
    expect(DESTINATIONS.ig_feed.captionLimit).toBe(2200)
  })

  it('resolved caption truncated to platform limit stays within bounds', () => {
    const longTitle = 'A'.repeat(2000)
    const ctx: CaptionContext = { title: longTitle, link: 'https://x.com', url: '' }
    const resolved = resolveCaption('{{title}}\n\n{{link}}', ctx)

    for (const id of DEST_IDS) {
      const limit = DESTINATIONS[id].captionLimit
      if (limit > 0) {
        const truncated = truncate(resolved, limit)
        expect(truncated.length).toBeLessThanOrEqual(limit)
      }
    }
  })

  it('short caption within limit is not altered by truncation', () => {
    const resolved = resolveCaption(PLATFORM_CAPTION_DEFAULTS.facebook, fullContext)
    const limit = DESTINATIONS.fb_page.captionLimit
    const truncated = truncate(resolved, limit)
    expect(truncated).toBe(resolved)
  })
})

// ---------------------------------------------------------------------------
// 8. handleCmsSelect builds captions correctly
// ---------------------------------------------------------------------------
describe('handleCmsSelect caption building', () => {
  const cmsItem = {
    title: 'Sprint 6 - MVP Launch',
    description: 'Finalmente o MVP vai ao ar com todas as features core.',
  }

  it('populates captions for all active destinations', () => {
    const activeIds: DestId[] = ['fb_page', 'yt_community', 'ig_feed']
    const captions = simulateHandleCmsSelect(cmsItem, activeIds)

    for (const id of activeIds) {
      expect(captions[id]).toBeDefined()
      expect(captions[id].length).toBeGreaterThan(0)
    }
  })

  it('uses item.description over item.title when available', () => {
    const captions = simulateHandleCmsSelect(cmsItem, ['fb_page'])
    expect(captions.fb_page).toContain(cmsItem.description!)
    expect(captions.fb_page).not.toContain(cmsItem.title)
  })

  it('falls back to item.title when description is null', () => {
    const itemNoDesc = { title: 'Fallback title', description: null }
    const captions = simulateHandleCmsSelect(itemNoDesc, ['fb_page'])
    expect(captions.fb_page).toContain('Fallback title')
  })

  it('does not create captions for inactive destinations', () => {
    const captions = simulateHandleCmsSelect(cmsItem, ['fb_page'])
    expect(captions.ig_story).toBeUndefined()
    expect(captions.yt_community).toBeUndefined()
  })

  it('instagram caption uses "Link na bio" not a URL', () => {
    const captions = simulateHandleCmsSelect(cmsItem, ['ig_feed'])
    expect(captions.ig_feed).toContain('Link na bio')
    expect(captions.ig_feed).not.toContain('https://')
  })

  it('leaves {{link}} unresolved for later replacement in non-instagram destinations', () => {
    const captions = simulateHandleCmsSelect(cmsItem, ['fb_page', 'yt_community'])
    // handleCmsSelect passes link as '{{link}}' intentionally — resolved later at publish
    expect(captions.fb_page).toContain('{{link}}')
    expect(captions.yt_community).toContain('{{link}}')
  })
})

// ---------------------------------------------------------------------------
// 9. Unresolved {{link}} detection
// ---------------------------------------------------------------------------
describe('Unresolved {{link}} detection', () => {
  it('detects unresolved {{link}} in a caption', () => {
    const caption = 'Check this out\n\n{{link}}'
    expect(hasUnresolvedLink(caption)).toBe(true)
  })

  it('returns false when {{link}} is fully resolved', () => {
    const resolved = resolveCaption('Check this out\n\n{{link}}', fullContext)
    expect(hasUnresolvedLink(resolved)).toBe(false)
  })

  it('findMissingLink returns true when template has no {{link}} at all', () => {
    expect(findMissingLink('Just text, no link variable')).toBe(true)
  })

  it('findMissingLink returns false when template contains {{link}}', () => {
    expect(findMissingLink('Post: {{link}}')).toBe(false)
  })

  it('instagram default template has no {{link}} — findMissingLink returns true', () => {
    expect(findMissingLink(PLATFORM_CAPTION_DEFAULTS.instagram)).toBe(true)
  })

  it('facebook default template has {{link}} — findMissingLink returns false', () => {
    expect(findMissingLink(PLATFORM_CAPTION_DEFAULTS.facebook)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 10. Caption with only {{link}} and no CMS content (freeform posts)
// ---------------------------------------------------------------------------
describe('Freeform posts — no template variables', () => {
  it('plain text caption has no template variables', () => {
    const freeform = 'Confira o novo episodio do podcast! Link nos comentarios.'
    const resolved = resolveCaption(freeform, fullContext)
    // Freeform text without {{...}} passes through untouched
    expect(resolved).toBe(freeform)
  })

  it('freeform caption does not contain unresolved placeholders', () => {
    const freeform = 'Novo video no canal!'
    expect(hasUnresolvedLink(freeform)).toBe(false)
    expect(freeform).not.toMatch(/\{\{(title|link|url)\}\}/)
  })

  it('resolvedLength matches actual string length for freeform text', () => {
    const freeform = 'Texto simples sem variaveis'
    const ctx: CaptionContext = { title: '', link: '', url: '' }
    expect(resolvedLength(freeform, ctx)).toBe(freeform.length)
  })
})

// ---------------------------------------------------------------------------
// 11. Multi-language caption variants (PT/EN)
// ---------------------------------------------------------------------------
describe('Multi-language captions', () => {
  it('resolves PT caption correctly', () => {
    const ptCtx: CaptionContext = {
      title: 'Como escalar sua startup',
      link: 'https://bythiagofigueiredo.com/blog/escalar-startup',
      url: '',
    }
    const result = resolveCaption('{{title}}\n\nLeia mais: {{link}}', ptCtx)
    expect(result).toBe('Como escalar sua startup\n\nLeia mais: https://bythiagofigueiredo.com/blog/escalar-startup')
  })

  it('resolves EN caption correctly', () => {
    const enCtx: CaptionContext = {
      title: 'How to scale your startup',
      link: 'https://bythiagofigueiredo.com/en/blog/scale-startup',
      url: '',
    }
    const result = resolveCaption('{{title}}\n\nRead more: {{link}}', enCtx)
    expect(result).toBe('How to scale your startup\n\nRead more: https://bythiagofigueiredo.com/en/blog/scale-startup')
  })

  it('handles unicode characters in title', () => {
    const ctx: CaptionContext = {
      title: 'Estrategias de SEO para 2026 — acentuacao e cedilha',
      link: 'https://example.com',
      url: '',
    }
    const result = resolveCaption('{{title}}', ctx)
    expect(result).toContain('acentuacao')
    expect(result).toContain('cedilha')
  })

  it('emoji in title does not break resolution', () => {
    const ctx: CaptionContext = {
      title: 'Novo video no ar! 🚀🔥',
      link: 'https://example.com',
      url: '',
    }
    const result = resolveCaption('{{title}}\n\n{{link}}', ctx)
    expect(result).toContain('🚀🔥')
    expect(result).toContain('https://example.com')
  })
})

// ---------------------------------------------------------------------------
// 12. Empty caption validation
// ---------------------------------------------------------------------------
describe('Empty caption validation', () => {
  function isCaptionValid(caption: string | undefined | null): boolean {
    return typeof caption === 'string' && caption.trim().length > 0
  }

  it('empty string is invalid', () => {
    expect(isCaptionValid('')).toBe(false)
  })

  it('whitespace-only string is invalid', () => {
    expect(isCaptionValid('   ')).toBe(false)
    expect(isCaptionValid('\n\n')).toBe(false)
    expect(isCaptionValid('\t')).toBe(false)
  })

  it('undefined is invalid', () => {
    expect(isCaptionValid(undefined)).toBe(false)
  })

  it('null is invalid', () => {
    expect(isCaptionValid(null)).toBe(false)
  })

  it('non-empty resolved caption is valid', () => {
    const resolved = resolveCaption(PLATFORM_CAPTION_DEFAULTS.facebook, fullContext)
    expect(isCaptionValid(resolved)).toBe(true)
  })

  it('caption resolved from empty context produces only whitespace (newlines)', () => {
    const ctx: CaptionContext = { title: '', link: '', url: '' }
    const resolved = resolveCaption(PLATFORM_CAPTION_DEFAULTS.facebook, ctx)
    // '{{title}}\n\n{{link}}' with empty context -> '\n\n'
    expect(resolved).toBe('\n\n')
    expect(isCaptionValid(resolved)).toBe(false)
  })

  it('ig_story captionLimit is 0 — caption is irrelevant for stories', () => {
    // Stories carry text in the artwork, not a caption field
    expect(DESTINATIONS.ig_story.captionLimit).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// resolvedLength helper
// ---------------------------------------------------------------------------
describe('resolvedLength', () => {
  it('returns actual length after resolution', () => {
    const len = resolvedLength('{{title}}\n\n{{link}}', fullContext)
    const actual = resolveCaption('{{title}}\n\n{{link}}', fullContext).length
    expect(len).toBe(actual)
  })

  it('uses 24-char placeholder when link is empty', () => {
    const ctx: CaptionContext = { title: 'Test', link: '', url: '' }
    const len = resolvedLength('{{title}} {{link}}', ctx)
    // 'Test' (4) + ' ' (1) + 24 placeholder = 29
    expect(len).toBe(29)
  })

  it('uses actual link length when link is provided', () => {
    const ctx: CaptionContext = { title: 'Test', link: 'https://example.com', url: '' }
    const len = resolvedLength('{{title}} {{link}}', ctx)
    expect(len).toBe('Test https://example.com'.length)
  })
})

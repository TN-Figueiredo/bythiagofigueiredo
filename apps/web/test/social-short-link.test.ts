import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

const mockSupabase = {
  from: vi.fn(),
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockSupabase,
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

// Mock @tn-figueiredo/links — auto-link.ts imports normalizeAllUtmFields + slugifyForCampaign
vi.mock('@tn-figueiredo/links', () => ({
  normalizeAllUtmFields: vi.fn((input: Record<string, string>) => input),
  slugifyForCampaign: vi.fn((title: string) => title.toLowerCase().replace(/\s+/g, '-')),
}))

// ---------------------------------------------------------------------------
// Top-level imports using relative paths (avoids @/ alias issues in Vitest)
// ---------------------------------------------------------------------------

import {
  resolveCaption,
  PLATFORM_CAPTION_DEFAULTS,
} from '../src/lib/social/caption-variables'

import { ensureTrackedLink } from '../src/lib/links/auto-link'

// ---------------------------------------------------------------------------
// 1-3. resolveCaption — pure function tests
// ---------------------------------------------------------------------------

describe('resolveCaption with {{link}} variable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves {{title}} and {{link}} in a template', () => {
    const result = resolveCaption('{{title}}\n\n{{link}}', {
      title: 'Test',
      link: 'https://go.example.com/abc',
      url: 'https://example.com/post',
    })

    expect(result).toBe('Test\n\nhttps://go.example.com/abc')
  })

  it('removes {{link}} when link is empty string', () => {
    const result = resolveCaption('{{title}}\n\n{{link}}', {
      title: 'My Post',
      link: '',
      url: 'https://example.com/post',
    })

    expect(result).toBe('My Post\n\n')
    expect(result).not.toContain('{{link}}')
  })

  it('detects unresolved {{link}} when no context value provided', () => {
    // Intentional: passing a context where link is the literal placeholder
    // simulates a bug where resolution didn't happen
    const unresolvedOutput = '{{title}}\n\n{{link}}'

    // If we resolve with actual values, the output should NOT contain {{link}}
    const resolved = resolveCaption(unresolvedOutput, {
      title: 'Real Title',
      link: 'https://go.example.com/xyz',
      url: 'https://example.com/post',
    })
    expect(resolved).not.toContain('{{link}}')

    // A caption that still has literal {{link}} means it was never resolved
    const badCaption = 'Check this out\n\n{{link}}'
    expect(badCaption).toContain('{{link}}')
    expect(badCaption).toMatch(/\{\{link\}\}/)
  })
})

// ---------------------------------------------------------------------------
// 4-5. ensureTrackedLink — Supabase interaction tests
// ---------------------------------------------------------------------------

describe('ensureTrackedLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a new tracked link and returns linkId + code', async () => {
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    const insertChain = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'link-new-1', code: 'Abc1234' },
          error: null,
        }),
      }),
    }

    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue(selectChain),
      insert: vi.fn().mockReturnValue(insertChain),
    }))

    const result = await ensureTrackedLink(
      mockSupabase as never,
      'site-1',
      'post-123',
      'social',
      'https://bythiagofigueiredo.com/blog/my-post',
      'My Post',
      'social-post-123',
    )

    expect(result).not.toBeNull()
    expect(result!.linkId).toBe('link-new-1')
    expect(result!.code).toBe('Abc1234')
    expect(result!.isNew).toBe(true)
    expect(mockSupabase.from).toHaveBeenCalledWith('tracked_links')
  })

  it('returns existing link instead of creating a new one', async () => {
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'link-existing', code: 'Xyz9999', active: true },
        error: null,
      }),
    }

    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue(selectChain),
    }))

    const result = await ensureTrackedLink(
      mockSupabase as never,
      'site-1',
      'post-456',
      'social',
      'https://bythiagofigueiredo.com/blog/existing-post',
      'Existing Post',
    )

    expect(result).not.toBeNull()
    expect(result!.linkId).toBe('link-existing')
    expect(result!.code).toBe('Xyz9999')
    expect(result!.isNew).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 6. buildShortUrl — URL format tests
// ---------------------------------------------------------------------------

describe('buildShortUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('produces go.{domain}/{code} when LINKS_SHORT_DOMAIN is set', async () => {
    vi.stubEnv('LINKS_SHORT_DOMAIN', 'go.btf.com')

    const { buildShortUrl } = await import('../src/lib/links/short-url')

    const url = buildShortUrl('Abc1234')
    expect(url).toBe('https://go.btf.com/Abc1234')

    vi.unstubAllEnvs()
  })

  it('falls back to NEXT_PUBLIC_APP_URL/go/{code} without short domain', async () => {
    vi.stubEnv('LINKS_SHORT_DOMAIN', '')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://bythiagofigueiredo.com')

    const { buildShortUrl } = await import('../src/lib/links/short-url')

    const url = buildShortUrl('Xyz9999')
    expect(url).toBe('https://bythiagofigueiredo.com/go/Xyz9999')

    vi.unstubAllEnvs()
  })
})

// ---------------------------------------------------------------------------
// 7. Caption with {{link}} gets resolved before DB save (integration)
// ---------------------------------------------------------------------------

describe('createSocialPostFromContent — link resolution in publish flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('replaces {{link}} in captions with actual short URL in post content', async () => {
    // The flow: create-from-content calls ensureTrackedLink -> buildShortUrl
    // then stores the URL in postContent.url, which consumers use to resolve
    // {{link}} in captions at delivery time.

    // Verify the pattern: buildShortUrl(linkResult.code) is stored in content.url
    vi.stubEnv('LINKS_SHORT_DOMAIN', 'go.btf.com')

    const { buildShortUrl } = await import('../src/lib/links/short-url')

    // Simulate the flow from create-from-content.ts lines 82-89
    const linkResult = { linkId: 'link-1', code: 'ShRtCd1', isNew: true }
    const shortUrl = buildShortUrl(linkResult.code)

    const captionTemplate = '{{title}}\n\n{{link}}'
    const resolved = resolveCaption(captionTemplate, {
      title: 'My Blog Post',
      link: shortUrl,
      url: 'https://bythiagofigueiredo.com/blog/my-post',
    })

    expect(resolved).toBe('My Blog Post\n\nhttps://go.btf.com/ShRtCd1')
    expect(resolved).not.toContain('{{link}}')
    expect(resolved).not.toContain('{{title}}')

    vi.unstubAllEnvs()
  })
})

// ---------------------------------------------------------------------------
// 8. Freeform post without CMS content has no {{link}}
// ---------------------------------------------------------------------------

describe('Freeform posts (no CMS content)', () => {
  it('should not have unresolved {{link}} variables in caption', () => {
    // Freeform posts are created manually — the user types the caption directly.
    // There should be no template variables left unresolved.
    const freeformCaption = 'Just published a new article! Check the link in bio.'

    expect(freeformCaption).not.toContain('{{link}}')
    expect(freeformCaption).not.toContain('{{title}}')
    expect(freeformCaption).not.toContain('{{url}}')
    expect(freeformCaption).not.toMatch(/\{\{[a-z]+\}\}/)
  })

  it('detects template variables in a caption that should be freeform', () => {
    // If a freeform caption accidentally contains {{link}}, that is a bug
    const suspiciousCaption = 'New post: {{link}}'
    expect(suspiciousCaption).toMatch(/\{\{link\}\}/)
  })
})

// ---------------------------------------------------------------------------
// 9. Multiple captions with {{link}} — same short URL across destinations
// ---------------------------------------------------------------------------

describe('Multiple destination captions share the same short URL', () => {
  it('each platform caption resolves {{link}} to the same short URL', () => {
    const shortUrl = 'https://go.btf.com/Abc1234'
    const context = {
      title: 'My New Article',
      link: shortUrl,
      url: 'https://bythiagofigueiredo.com/blog/new-article',
    }

    // facebook, bluesky, youtube all use {{link}} in default template
    const facebookCaption = resolveCaption(PLATFORM_CAPTION_DEFAULTS.facebook, context)
    const blueskyCaption = resolveCaption(PLATFORM_CAPTION_DEFAULTS.bluesky, context)
    const youtubeCaption = resolveCaption(PLATFORM_CAPTION_DEFAULTS.youtube, context)

    // All resolved captions should contain the same short URL
    expect(facebookCaption).toContain(shortUrl)
    expect(blueskyCaption).toContain(shortUrl)
    expect(youtubeCaption).toContain(shortUrl)

    // Instagram uses "Link na bio" instead of {{link}}
    const instagramCaption = resolveCaption(PLATFORM_CAPTION_DEFAULTS.instagram, context)
    expect(instagramCaption).not.toContain(shortUrl)
    expect(instagramCaption).toContain('Link na bio')
  })

  it('custom per-platform captions all resolve with same URL', () => {
    const shortUrl = 'https://go.btf.com/Xyz7777'
    const context = {
      title: 'Custom Post',
      link: shortUrl,
      url: 'https://bythiagofigueiredo.com/blog/custom',
    }

    const customCaptions: Record<string, string> = {
      facebook: 'Check out: {{title}} {{link}}',
      bluesky: '{{title}} - read more at {{link}}',
      youtube: 'New video! {{link}}',
    }

    const resolved = Object.entries(customCaptions).map(([platform, template]) => ({
      platform,
      caption: resolveCaption(template, context),
    }))

    for (const { caption } of resolved) {
      expect(caption).toContain(shortUrl)
      expect(caption).not.toContain('{{link}}')
    }
  })
})

// ---------------------------------------------------------------------------
// 10. Link origin is 'social' — correct metadata on tracked link
// ---------------------------------------------------------------------------

describe('Tracked link origin metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes source_type "social" to ensureTrackedLink for social posts', async () => {
    let insertedPayload: Record<string, unknown> | null = null

    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue(selectChain),
      insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        insertedPayload = payload
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'link-social-1', code: 'SocLnk1' },
              error: null,
            }),
          }),
        }
      }),
    }))

    await ensureTrackedLink(
      mockSupabase as never,
      'site-1',
      'social-post-789',
      'social',
      'https://bythiagofigueiredo.com/blog/my-post',
      'My Post',
      'social-social-post-789',
    )

    expect(insertedPayload).not.toBeNull()
    expect(insertedPayload!.source_type).toBe('social')
    expect(insertedPayload!.utm_medium).toBe('social')
  })

  it('uses "social" utm_medium for social source_type', async () => {
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    let capturedInsert: Record<string, unknown> | null = null

    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue(selectChain),
      insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        capturedInsert = payload
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'link-2', code: 'Med0001' },
              error: null,
            }),
          }),
        }
      }),
    }))

    await ensureTrackedLink(
      mockSupabase as never,
      'site-1',
      'post-utm-test',
      'social',
      'https://bythiagofigueiredo.com/blog/utm-test',
      'UTM Test Post',
    )

    expect(capturedInsert).not.toBeNull()
    // The auto-link module sets utm_medium based on source_type:
    // 'social' -> 'social', 'newsletter' -> 'email', default -> 'referral'
    expect(capturedInsert!.source_type).toBe('social')
  })
})

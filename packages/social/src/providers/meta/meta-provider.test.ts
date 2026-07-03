import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatFacebookContent,
  FacebookProvider,
  InstagramProvider,
} from './index.js'
import * as meta from './index.js'
import type {
  SocialConnection,
  SocialDelivery,
  SocialPost,
  SocialPostContent,
} from '../../core/types.js'

function okJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// A decrypt that strips the "enc-" prefix, matching the sibling suites.
const decrypt = (enc: string) => enc.replace('enc-', '')

function makeConnection(over?: Partial<SocialConnection>): SocialConnection {
  return {
    id: 'conn-1',
    site_id: 'site-1',
    provider: 'facebook',
    account_id: 'PAGE123',
    account_name: 'Page',
    access_token_enc: 'enc-user-token',
    refresh_token_enc: null,
    page_token_enc: 'enc-page-token',
    token_expires_at: null,
    scopes: [],
    metadata: { ig_user_id: 'IG123' },
    connected_at: '2026-01-01T00:00:00Z',
    revoked_at: null,
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

function makePost(content: SocialPostContent): SocialPost {
  return {
    id: 'post-1',
    site_id: 'site-1',
    created_by: 'u',
    type: 'link',
    status: 'publishing',
    scheduled_at: null,
    user_timezone: 'America/Sao_Paulo',
    published_at: null,
    content,
    template_id: null,
    idempotency_key: 'k',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function makeDelivery(over?: Partial<SocialDelivery>): SocialDelivery {
  return {
    id: 'del-1',
    post_id: 'post-1',
    connection_id: 'conn-1',
    provider: 'facebook',
    status: 'pending',
    platform_post_id: null,
    platform_url: null,
    content_override: null,
    attempt: 0,
    max_attempts: 3,
    last_error: null,
    error_type: null,
    published_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

describe('formatFacebookContent', () => {
  it('composes title, description and hashtags separated by blank lines', () => {
    const out = formatFacebookContent(
      { title: 'The Title', description: 'The body', hashtags: ['dev', 'ts'], url: 'https://x.com/a' },
      63_206,
    )
    expect(out.message).toBe('The Title\n\nThe body\n\n#dev #ts')
    expect(out.link).toBe('https://x.com/a')
  })

  it('drops the title when it duplicates the description', () => {
    const out = formatFacebookContent({ title: 'same', description: 'same' }, 100)
    expect(out.message).toBe('same')
  })

  it('truncates to the limit with an ellipsis', () => {
    const out = formatFacebookContent({ description: 'a'.repeat(50) }, 10)
    expect(out.message.length).toBe(10)
    expect(out.message.endsWith('…')).toBe(true)
  })

  it('returns undefined link when content has no url', () => {
    expect(formatFacebookContent({ description: 'x' }, 100).link).toBeUndefined()
  })
})

describe('FacebookProvider.publish', () => {
  it('routes to a photo post when media is present, appending the link to the caption', async () => {
    fetchMock.mockResolvedValue(okJson({ id: 'PH1', post_id: 'POST1' }))

    const provider = new FacebookProvider(decrypt, 'app', 'secret')
    const post = makePost({
      title: 'Hi',
      url: 'https://x.com/a',
      media_urls: ['https://cdn/i.png'],
    })

    const result = await provider.publish(post, makeConnection(), makeDelivery())

    expect(fetchMock.mock.calls[0]![0]).toContain('/PAGE123/photos')
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(body.url).toBe('https://cdn/i.png')
    expect(body.message).toContain('https://x.com/a')
    // page token was decrypted before use
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe('Bearer page-token')
    expect(result.id).toBe('PH1')
  })

  it('warms the OG cache then posts a link when there is no media', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('scrape=true')) {
        return Promise.resolve(okJson({ og_object: { image: [{ url: 'https://cdn/og.png' }] } }))
      }
      return Promise.resolve(okJson({ id: 'PAGE123_POST9' }))
    })

    const provider = new FacebookProvider(decrypt, 'app', 'secret')
    const post = makePost({ title: 'Hi', url: 'https://x.com/a' })

    const result = await provider.publish(post, makeConnection(), makeDelivery())

    const urls = fetchMock.mock.calls.map((c) => c[0] as string)
    expect(urls.some((u) => u.includes('scrape=true'))).toBe(true)
    expect(urls.some((u) => u.includes('/feed'))).toBe(true)
    expect(result.url).toBe('https://facebook.com/PAGE123/posts/POST9')
  })
})

describe('FacebookProvider.refreshToken', () => {
  it('exchanges the stored token for a long-lived one with a future expiry', async () => {
    fetchMock.mockResolvedValue(okJson({ access_token: 'LL', expires_in: 3600, token_type: 'bearer' }))

    const provider = new FacebookProvider(decrypt, 'app-1', 'secret-1')
    const before = Date.now()
    const result = await provider.refreshToken(makeConnection())

    expect(result?.access_token).toBe('LL')
    expect(result?.expires_at?.getTime()).toBeGreaterThan(before)
    // the exchange must use the decrypted user token
    expect(fetchMock.mock.calls[0]![0]).toContain('fb_exchange_token=user-token')
  })
})

describe('InstagramProvider', () => {
  it('rejects feed posts with no image before any network call', async () => {
    const provider = new InstagramProvider(decrypt, 'app', 'secret')
    const post = makePost({ title: 'Caption only' })
    await expect(
      provider.publish(post, makeConnection({ provider: 'instagram' }), makeDelivery({ format: 'image_post' })),
    ).rejects.toThrow(/require at least one image/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null from refreshToken when app credentials are missing', async () => {
    const provider = new InstagramProvider(decrypt)
    await expect(provider.refreshToken(makeConnection({ provider: 'instagram' }))).resolves.toBeNull()
  })
})

describe('meta barrel exports', () => {
  it('re-exports the oauth, facebook, instagram and rate-budget surfaces', () => {
    for (const name of [
      'exchangeForLongLivedToken',
      'getPageAccessToken',
      'getUserPages',
      'getInstagramBusinessAccount',
      'buildOAuthUrl',
      'postToPage',
      'postPhotoToPage',
      'warmOGCache',
      'deletePagePost',
      'createMediaContainer',
      'pollContainerStatus',
      'publishContainer',
      'publishInstagramMedia',
      'publishMultiSlideStory',
      'deleteInstagramMedia',
      'checkRateBudget',
      'remainingFromUsage',
      'parseAppUsageHeader',
    ] as const) {
      expect(typeof (meta as Record<string, unknown>)[name]).toBe('function')
    }
    expect(typeof meta.InsufficientRateBudgetError).toBe('function')
  })
})

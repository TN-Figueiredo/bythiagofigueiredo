import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  exchangeForLongLivedToken,
  getPageAccessToken,
  getUserPages,
  getInstagramBusinessAccount,
  buildOAuthUrl,
} from './oauth.js'

function okJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response
}

function errRes(status: number, body: string) {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => body,
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

describe('buildOAuthUrl', () => {
  it('builds the FB dialog URL with client_id, redirect, scopes and response_type', () => {
    const url = new URL(
      buildOAuthUrl('app-123', 'https://x.com/cb', ['pages_manage_posts', 'instagram_basic']),
    )
    expect(url.origin + url.pathname).toBe('https://www.facebook.com/v25.0/dialog/oauth')
    expect(url.searchParams.get('client_id')).toBe('app-123')
    expect(url.searchParams.get('redirect_uri')).toBe('https://x.com/cb')
    expect(url.searchParams.get('scope')).toBe('pages_manage_posts,instagram_basic')
    expect(url.searchParams.get('response_type')).toBe('code')
  })
})

describe('exchangeForLongLivedToken', () => {
  it('hits the token endpoint with the fb_exchange_token grant and returns token+expiry', async () => {
    fetchMock.mockResolvedValue(okJson({ access_token: 'LL-token', expires_in: 5184000, token_type: 'bearer' }))

    const result = await exchangeForLongLivedToken('short-token', 'app-1', 'secret-1')

    expect(result).toEqual({ access_token: 'LL-token', expires_in: 5184000 })

    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string)
    expect(calledUrl.searchParams.get('grant_type')).toBe('fb_exchange_token')
    expect(calledUrl.searchParams.get('client_id')).toBe('app-1')
    expect(calledUrl.searchParams.get('client_secret')).toBe('secret-1')
    expect(calledUrl.searchParams.get('fb_exchange_token')).toBe('short-token')
  })

  it('throws with status + body when the exchange fails', async () => {
    fetchMock.mockResolvedValue(errRes(400, 'bad token'))
    await expect(
      exchangeForLongLivedToken('short', 'app', 'secret'),
    ).rejects.toThrow(/Meta token exchange failed \(400\): bad token/)
  })
})

describe('getPageAccessToken', () => {
  it('returns the page access_token', async () => {
    fetchMock.mockResolvedValue(okJson({ access_token: 'page-token' }))
    await expect(getPageAccessToken('user-token', 'page-9')).resolves.toBe('page-token')
    expect(fetchMock.mock.calls[0]![0]).toContain('/page-9?fields=access_token')
  })

  it('throws on non-ok response', async () => {
    fetchMock.mockResolvedValue(errRes(403, 'no perms'))
    await expect(getPageAccessToken('t', 'p')).rejects.toThrow(/Failed to get page token \(403\)/)
  })
})

describe('getUserPages', () => {
  it('maps the pages list to id/name/access_token', async () => {
    fetchMock.mockResolvedValue(
      okJson({
        data: [
          { id: '1', name: 'Page One', access_token: 'tok1', extra: 'ignored' },
          { id: '2', name: 'Page Two', access_token: 'tok2' },
        ],
      }),
    )
    await expect(getUserPages('user-token')).resolves.toEqual([
      { id: '1', name: 'Page One', access_token: 'tok1' },
      { id: '2', name: 'Page Two', access_token: 'tok2' },
    ])
  })

  it('throws on non-ok response', async () => {
    fetchMock.mockResolvedValue(errRes(500, 'oops'))
    await expect(getUserPages('t')).rejects.toThrow(/Failed to list pages \(500\)/)
  })
})

describe('getInstagramBusinessAccount', () => {
  it('returns the linked IG account when present', async () => {
    fetchMock.mockResolvedValue(
      okJson({ instagram_business_account: { id: 'ig-1', username: 'thefigueiredo' } }),
    )
    await expect(getInstagramBusinessAccount('page-1', 'page-token')).resolves.toEqual({
      ig_user_id: 'ig-1',
      ig_username: 'thefigueiredo',
    })
  })

  it('returns null when the page has no linked IG account', async () => {
    fetchMock.mockResolvedValue(okJson({}))
    await expect(getInstagramBusinessAccount('page-1', 'page-token')).resolves.toBeNull()
  })

  it('throws on non-ok response', async () => {
    fetchMock.mockResolvedValue(errRes(400, 'bad'))
    await expect(getInstagramBusinessAccount('p', 't')).rejects.toThrow(
      /Failed to get IG business account \(400\)/,
    )
  })
})

// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { oauthResultHtml } from '@/lib/oauth/popup-result'

const BASE = {
  messageType: 'social-oauth-result',
  provider: 'youtube',
  success: true,
  backHref: '/cms/social/accounts',
  targetOrigin: 'https://bythiagofigueiredo.com',
  nonce: 'bm9uY2UtMTIz',
} as const

/** Pull the inline script body out — contract test, never a golden string. */
function scriptSourceOf(html: string): string {
  const match = /<script nonce="([^"]*)">([\s\S]*?)<\/script>/.exec(html)
  expect(match).not.toBeNull()
  return match![2]!
}

/** Extract the JSON literal handed to postMessage and parse it. */
function payloadOf(html: string): Record<string, unknown> {
  const src = scriptSourceOf(html)
  const match = /postMessage\((\{[\s\S]*?\}), /.exec(src)
  expect(match).not.toBeNull()
  return JSON.parse(match![1]!.replace(/<\\\//g, '</')) as Record<string, unknown>
}

/** Run the inline script against a stub window — this is the opener contract. */
function runScript(html: string, opener: { postMessage: (d: unknown, o: string) => void } | null) {
  const close = vi.fn()
  const timeouts: Array<() => void> = []
  const win = { opener, close }
  const fakeSetTimeout = (fn: () => void) => {
    timeouts.push(fn)
  }
  new Function('window', 'setTimeout', scriptSourceOf(html))(win, fakeSetTimeout)
  return { close, timeouts }
}

describe('oauthResultHtml — response shape', () => {
  it('defaults to 200 with the html content type', async () => {
    const res = oauthResultHtml({ ...BASE })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    expect(await res.text()).toContain('Connected! This window will close.')
  })

  it('honours an explicit status', () => {
    const res = oauthResultHtml({
      ...BASE,
      success: false,
      error: 'Session changed during authorization — sign in and try again',
      extra: { code: 'session_changed' },
      status: 401,
    })
    expect(res.status).toBe(401)
  })

  it('passes through Cache-Control and Referrer-Policy only', () => {
    const res = oauthResultHtml({
      ...BASE,
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
  })
})

describe('oauthResultHtml — script contract, success branch', () => {
  it('carries the nonce attribute', async () => {
    const html = await oauthResultHtml({ ...BASE }).text()
    expect(html).toContain('<script nonce="bm9uY2UtMTIz">')
  })

  it('posts a parseable payload', async () => {
    const html = await oauthResultHtml({ ...BASE }).text()
    expect(payloadOf(html)).toEqual({
      type: 'social-oauth-result',
      success: true,
      provider: 'youtube',
    })
  })

  it('renders the allow-listed backHref label', async () => {
    const html = await oauthResultHtml({ ...BASE }).text()
    expect(html).toContain('href="/cms/social/accounts"')
    expect(html).toContain('Back to social accounts')
  })
})

describe('oauthResultHtml — script contract, failure branch', () => {
  it('posts error and extra.code, and shows a human sentence', async () => {
    const html = await oauthResultHtml({
      ...BASE,
      success: false,
      error: 'Instagram did not grant the required permission',
      extra: { code: 'permission_denied' },
      backHref: '/cms/settings/instagram',
    }).text()
    expect(payloadOf(html)).toEqual({
      type: 'social-oauth-result',
      success: false,
      provider: 'youtube',
      error: 'Instagram did not grant the required permission',
      code: 'permission_denied',
    })
    expect(html).toContain('Error: Instagram did not grant the required permission')
    expect(html).toContain('Back to Instagram settings')
  })

  it('carries the nonce in the failure branch too', async () => {
    const html = await oauthResultHtml({
      ...BASE,
      success: false,
      error: 'Authorization cancelled',
      extra: { code: 'cancelled' },
    }).text()
    expect(html).toContain('<script nonce="bm9uY2UtMTIz">')
  })

  it('accepts the handle_mismatch status extra', async () => {
    const html = await oauthResultHtml({
      ...BASE,
      success: false,
      error: 'You authorized a different account',
      extra: { status: 'handle_mismatch' },
      backHref: '/cms/settings/instagram',
    }).text()
    expect(payloadOf(html).status).toBe('handle_mismatch')
  })

  it('escapes html in the visible error text', async () => {
    const html = await oauthResultHtml({
      ...BASE,
      success: false,
      error: '<img src=x onerror=1>',
      extra: { code: 'write_failed' },
    }).text()
    expect(html).toContain('&lt;img src=x onerror=1&gt;')
    // Deviation from plan draft: scoped to the VISIBLE portion (before the
    // <script> block). The raw error text intentionally survives inside the
    // JSON payload passed to postMessage (only `</` is escaped there, per the
    // "closing sequence escape" contract below) — script element content is
    // never HTML-parsed, so a literal "<img" there creates no element and is
    // not an injection. Asserting `not.toContain` over the FULL html (as the
    // plan drafted it) would be un-satisfiable together with that contract:
    // this text carries no `</` sequence, so nothing would strip it from the
    // script body. The real security property — the visible <p> is escaped —
    // is what this test is actually about, and is what's asserted below.
    const visible = html.split('<script')[0]!
    expect(visible).not.toContain('<img src=x')
  })
})

describe('oauthResultHtml — closing sequence escape', () => {
  it('escapes </ inside the json payload', async () => {
    const html = await oauthResultHtml({
      ...BASE,
      success: false,
      error: '</script><script>alert(1)</script>',
      extra: { code: 'write_failed' },
    }).text()
    const src = scriptSourceOf(html)
    expect(src).not.toContain('</script>')
    expect(src).toContain('<\\/script>')
    expect(payloadOf(html).error).toBe('</script><script>alert(1)</script>')
  })
})

describe('oauthResultHtml — auto-close only with an opener', () => {
  it('posts the message and schedules window.close when an opener exists', async () => {
    const postMessage = vi.fn()
    const html = await oauthResultHtml({ ...BASE }).text()
    const { close, timeouts } = runScript(html, { postMessage })
    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(postMessage.mock.calls[0]![1]).toBe('https://bythiagofigueiredo.com')
    expect(timeouts).toHaveLength(1)
    timeouts[0]!()
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('never closes the page when there is no opener', async () => {
    const html = await oauthResultHtml({ ...BASE }).text()
    const { close, timeouts } = runScript(html, null)
    expect(timeouts).toHaveLength(0)
    expect(close).not.toHaveBeenCalled()
  })
})

describe('oauthResultHtml — backHref allow-list', () => {
  it('accepts the sign-in href with its own label', async () => {
    const html = await oauthResultHtml({
      ...BASE,
      success: false,
      error: 'Session changed during authorization — sign in and try again',
      extra: { code: 'session_changed' },
      backHref: '/cms/login?next=/cms/settings/instagram',
      status: 401,
    }).text()
    expect(html).toContain('href="/cms/login?next=/cms/settings/instagram"')
    expect(html).toContain('Sign in and try again')
  })

  it.each([
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    'cms/settings/instagram',
  ])('throws on non-relative backHref %j', (backHref) => {
    expect(() => oauthResultHtml({ ...BASE, backHref })).toThrow()
  })

  it('throws on a relative href outside the allow-list', () => {
    expect(() => oauthResultHtml({ ...BASE, backHref: '/cms/settings' })).toThrow()
  })
})

describe('oauthResultHtml — extra is an enum', () => {
  it('throws on an unknown error code', () => {
    expect(() =>
      oauthResultHtml({
        ...BASE,
        success: false,
        extra: { code: 'made_up' } as never,
      }),
    ).toThrow()
  })

  it('throws on an unknown status', () => {
    expect(() =>
      oauthResultHtml({ ...BASE, extra: { status: 'whatever' } as never }),
    ).toThrow()
  })

  it('throws on an extra with two keys', () => {
    expect(() =>
      oauthResultHtml({
        ...BASE,
        extra: { code: 'cancelled', status: 'handle_mismatch' } as never,
      }),
    ).toThrow()
  })
})

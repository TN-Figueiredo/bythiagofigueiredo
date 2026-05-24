// @vitest-environment node
import { describe, it, expect } from 'vitest'

import { POST } from '../../src/app/api/theme/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function themeRequest(body: unknown): Request {
  return new Request('http://localhost/api/theme', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/theme', () => {
  it('returns 400 for invalid theme value', async () => {
    const res = await POST(themeRequest({ theme: 'purple' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid theme')
  })

  it('returns 400 when theme is missing', async () => {
    const res = await POST(themeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const res = await POST(
      new Request('http://localhost/api/theme', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      }),
    )
    // Route catches JSON parse error and defaults to {}
    expect(res.status).toBe(400)
  })

  it('sets dark theme cookie and returns ok', async () => {
    const res = await POST(themeRequest({ theme: 'dark' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('btf_theme=dark')
    expect(setCookie).toContain('Path=/')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
    expect(setCookie).toContain('Max-Age=31536000')
  })

  it('sets light theme cookie and returns ok', async () => {
    const res = await POST(themeRequest({ theme: 'light' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('btf_theme=light')
  })
})

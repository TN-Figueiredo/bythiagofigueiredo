import { describe, it, expect } from 'vitest'
import { POST } from '../../../src/app/api/theme/route'

describe('POST /api/theme', () => {
  it('sets btf_theme=dark cookie', async () => {
    const req = new Request('http://localhost/api/theme', {
      method: 'POST',
      body: JSON.stringify({ theme: 'dark' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('btf_theme=dark')
  })

  it('sets btf_theme=light cookie', async () => {
    const req = new Request('http://localhost/api/theme', {
      method: 'POST',
      body: JSON.stringify({ theme: 'light' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('btf_theme=light')
  })

  it('rejects unknown theme values', async () => {
    const req = new Request('http://localhost/api/theme', {
      method: 'POST',
      body: JSON.stringify({ theme: 'purple' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

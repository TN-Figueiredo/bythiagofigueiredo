import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('links pulse SSE route', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.LINKS_LIVE_PULSE_ENABLED
  })

  it('returns 404 when LINKS_LIVE_PULSE_ENABLED=false', async () => {
    process.env.LINKS_LIVE_PULSE_ENABLED = 'false'
    const { GET } = await import('../../src/app/api/links/[id]/pulse/route')
    const req = new Request('http://localhost/api/links/abc/pulse')
    const res = await GET(req, { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('feature_disabled')
  })

  it('returns SSE stream when enabled (default)', async () => {
    const { GET } = await import('../../src/app/api/links/[id]/pulse/route')
    const req = new Request('http://localhost/api/links/test-id/pulse')
    const res = await GET(req, { params: Promise.resolve({ id: 'test-id' }) })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform')
    expect(res.headers.get('X-Accel-Buffering')).toBe('no')

    // Read the initial data event from the stream
    const reader = res.body!.getReader()
    const { value } = await reader.read()
    const text = new TextDecoder().decode(value)
    expect(text).toContain('data: ')
    expect(text).toContain('"linkId":"test-id"')
    expect(text).toContain('"clicks":0')
    reader.cancel()
  })

  it('emits correctly formatted SSE data event', async () => {
    const { GET } = await import('../../src/app/api/links/[id]/pulse/route')
    const req = new Request('http://localhost/api/links/link-123/pulse')
    const res = await GET(req, { params: Promise.resolve({ id: 'link-123' }) })

    const reader = res.body!.getReader()
    const { value } = await reader.read()
    const text = new TextDecoder().decode(value)

    // SSE format: "data: {json}\n\n"
    expect(text.startsWith('data: ')).toBe(true)
    expect(text.endsWith('\n\n')).toBe(true)

    const jsonStr = text.replace('data: ', '').trim()
    const parsed = JSON.parse(jsonStr)
    expect(parsed).toHaveProperty('linkId', 'link-123')
    expect(parsed).toHaveProperty('clicks', 0)
    expect(parsed).toHaveProperty('ts')
    expect(typeof parsed.ts).toBe('number')

    reader.cancel()
  })
})

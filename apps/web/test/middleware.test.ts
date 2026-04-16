import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const LOCAL_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', LOCAL_ANON)
})
afterAll(() => {
  vi.unstubAllEnvs()
})

async function loadMiddleware() {
  const mod = await import('../src/middleware')
  return mod.default
}

function makeReq(path: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3001${path}`), {
    headers: new Headers({ host: 'localhost:3001' }),
  })
}

describe('middleware', () => {
  it('redirects unauthenticated request to /cms → /cms/login', async () => {
    const middleware = await loadMiddleware()
    const res = await middleware(makeReq('/cms'))
    expect([307, 308]).toContain(res.status)
    expect(res.headers.get('location') ?? '').toMatch(/\/cms\/login/)
  })

  it('redirects unauthenticated request to /admin → /admin/login', async () => {
    const middleware = await loadMiddleware()
    const res = await middleware(makeReq('/admin'))
    expect([307, 308]).toContain(res.status)
    expect(res.headers.get('location') ?? '').toMatch(/\/admin\/login/)
  })

  it('lets anonymous GET / through', async () => {
    const middleware = await loadMiddleware()
    const res = await middleware(makeReq('/'))
    expect([200, 404, undefined]).toContain(res.status)
  })
})

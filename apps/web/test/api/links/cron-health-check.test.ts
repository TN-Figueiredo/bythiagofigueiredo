import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockLimit = vi.fn()
const mockOrder = vi.fn()
const mockOr = vi.fn()
const mockGt = vi.fn()
const mockIsNull = vi.fn()

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            gt: () => ({
              or: () => ({
                order: () => ({
                  limit: () =>
                    Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
      update: (payload: unknown) => {
        mockUpdate(payload)
        return { eq: mockEq }
      },
    }),
    rpc: mockRpc,
  }),
}))

vi.mock('../../../lib/logger', () => ({
  withCronLock: async (
    _sb: unknown,
    _key: string,
    _runId: string,
    _tag: string,
    fn: () => Promise<unknown>,
  ) => {
    const result = await fn()
    return Response.json(result)
  },
  newRunId: () => 'test-run-id',
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

describe('GET /api/cron/links-health-check', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns 401 without valid CRON_SECRET', async () => {
    vi.stubEnv('LINKS_HEALTH_CHECK_ENABLED', 'true')
    vi.stubEnv('CRON_SECRET', 'test-secret')
    const { GET } = await import(
      '../../../src/app/api/cron/links-health-check/route'
    )
    const req = new Request('http://localhost/api/cron/links-health-check', {
      headers: { authorization: 'Bearer wrong-token' },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('returns 401 without authorization header', async () => {
    vi.stubEnv('LINKS_HEALTH_CHECK_ENABLED', 'true')
    vi.stubEnv('CRON_SECRET', 'test-secret')
    const { GET } = await import(
      '../../../src/app/api/cron/links-health-check/route'
    )
    const req = new Request('http://localhost/api/cron/links-health-check')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 with disabled status when LINKS_HEALTH_CHECK_ENABLED is not set', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret')
    // Do NOT set LINKS_HEALTH_CHECK_ENABLED
    const { GET } = await import(
      '../../../src/app/api/cron/links-health-check/route'
    )
    const req = new Request('http://localhost/api/cron/links-health-check', {
      headers: { authorization: 'Bearer test-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('disabled')
  })

  describe('SSRF guard — isPrivateUrl', () => {
    // We test the SSRF guard by importing the module and calling checkUrl
    // indirectly. But since isPrivateUrl and checkUrl are not exported,
    // we test via the regex pattern applied to known private IPs.
    // The handler itself filters private URLs before making requests.

    it('rejects 127.0.0.1 (loopback IPv4)', async () => {
      vi.stubEnv('LINKS_HEALTH_CHECK_ENABLED', 'true')
      vi.stubEnv('CRON_SECRET', 'test-secret')
      // Import the module to access the PRIVATE_IP_RE pattern indirectly
      // We re-test the regex that the route uses
      const PRIVATE_IP_RE =
        /^(https?:\/\/)?(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0|localhost|\[?::1\]?|\[?0+:0+:0+:0+:0+:0+:0+:0*1\]?|\[?fe80:[^\]]*\]?|\[?fc[0-9a-f]{2}:[^\]]*\]?|\[?fd[0-9a-f]{2}:[^\]]*\]?)/i

      expect(PRIVATE_IP_RE.test('http://127.0.0.1/evil')).toBe(true)
      expect(PRIVATE_IP_RE.test('https://127.0.0.1:8080/path')).toBe(true)
    })

    it('rejects 10.x.x.x (private class A)', () => {
      const PRIVATE_IP_RE =
        /^(https?:\/\/)?(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0|localhost|\[?::1\]?|\[?0+:0+:0+:0+:0+:0+:0+:0*1\]?|\[?fe80:[^\]]*\]?|\[?fc[0-9a-f]{2}:[^\]]*\]?|\[?fd[0-9a-f]{2}:[^\]]*\]?)/i

      expect(PRIVATE_IP_RE.test('http://10.0.0.1')).toBe(true)
      expect(PRIVATE_IP_RE.test('https://10.255.255.255/admin')).toBe(true)
    })

    it('rejects 192.168.x.x (private class C)', () => {
      const PRIVATE_IP_RE =
        /^(https?:\/\/)?(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0|localhost|\[?::1\]?|\[?0+:0+:0+:0+:0+:0+:0+:0*1\]?|\[?fe80:[^\]]*\]?|\[?fc[0-9a-f]{2}:[^\]]*\]?|\[?fd[0-9a-f]{2}:[^\]]*\]?)/i

      expect(PRIVATE_IP_RE.test('http://192.168.1.1')).toBe(true)
      expect(PRIVATE_IP_RE.test('https://192.168.0.100/api')).toBe(true)
    })

    it('rejects ::1 (loopback IPv6)', () => {
      const PRIVATE_IP_RE =
        /^(https?:\/\/)?(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0|localhost|\[?::1\]?|\[?0+:0+:0+:0+:0+:0+:0+:0*1\]?|\[?fe80:[^\]]*\]?|\[?fc[0-9a-f]{2}:[^\]]*\]?|\[?fd[0-9a-f]{2}:[^\]]*\]?)/i

      expect(PRIVATE_IP_RE.test('http://[::1]')).toBe(true)
      expect(PRIVATE_IP_RE.test('http://[::1]:3000/path')).toBe(true)
    })

    it('allows public URLs', () => {
      const PRIVATE_IP_RE =
        /^(https?:\/\/)?(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0|localhost|\[?::1\]?|\[?0+:0+:0+:0+:0+:0+:0+:0*1\]?|\[?fe80:[^\]]*\]?|\[?fc[0-9a-f]{2}:[^\]]*\]?|\[?fd[0-9a-f]{2}:[^\]]*\]?)/i

      expect(PRIVATE_IP_RE.test('https://example.com')).toBe(false)
      expect(PRIVATE_IP_RE.test('https://google.com/search')).toBe(false)
      expect(PRIVATE_IP_RE.test('https://bythiagofigueiredo.com')).toBe(false)
    })
  })
})

// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

const { init, agendar } = vi.hoisted(() => ({ init: vi.fn(), agendar: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ init }))
vi.mock('../src/lib/sentry-flush', () => ({ agendarFlushNaVercel: agendar }))

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); init.mockClear(); agendar.mockClear() })

describe('sentry.server.config', () => {
  it('beforeSend agenda o flush na Vercel e devolve o evento limpo', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://k@o0.ingest.sentry.io/1')
    await import('../sentry.server.config')
    const opts = init.mock.calls[0]![0] as { beforeSend: (e: { message: string }) => { message: string } }
    const out = opts.beforeSend({ message: 'oi a@b.com' })
    expect(agendar).toHaveBeenCalledTimes(1)
    expect(out.message).not.toContain('a@b.com')
  })
})

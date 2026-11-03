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

describe('sentry.server.config: trava e transações', () => {
  type Opts = {
    tracesSampleRate: number
    sendDefaultPii: boolean
    beforeSend: (e: { message?: string; level?: string }) => unknown
    beforeSendTransaction: (e: { transaction?: string }) => unknown
  }
  async function opts(): Promise<Opts> {
    vi.stubEnv('SENTRY_DSN', 'https://k@o0.ingest.sentry.io/1')
    await import('../sentry.server.config')
    return init.mock.calls[0]![0] as Opts
  }

  it('beforeSend corta aviso repetido sem agendar flush; error passa sempre', async () => {
    const o = await opts()
    const saidas = Array.from({ length: 200 }, () => o.beforeSend({ message: 'repetido', level: 'warning' }))
    expect(saidas.some((s) => s === null)).toBe(true)
    agendar.mockClear()
    expect(o.beforeSend({ message: 'repetido', level: 'warning' })).toBeNull()
    expect(agendar).not.toHaveBeenCalled()
    expect(o.beforeSend({ message: 'repetido', level: 'error' })).not.toBeNull()
    expect(agendar).toHaveBeenCalledTimes(1)
  })

  it('beforeSendTransaction faz o scrub e agenda o flush', async () => {
    const o = await opts()
    const ev = { message: 'oi a@b.com' }
    const out = o.beforeSendTransaction(ev as never) as { message: string }
    expect(agendar).toHaveBeenCalledTimes(1)
    expect(out.message).not.toContain('a@b.com')
  })

  it('mantém tracesSampleRate 0.1 e sendDefaultPii false', async () => {
    const o = await opts()
    expect(o.tracesSampleRate).toBe(0.1)
    expect(o.sendDefaultPii).toBe(false)
  })
})

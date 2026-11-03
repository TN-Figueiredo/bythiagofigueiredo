// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

const { captureMessage, flush, getClient } = vi.hoisted(() => ({
  captureMessage: vi.fn(),
  flush: vi.fn(async () => true),
  getClient: vi.fn(() => ({ getDsn: () => ({ host: 'segredo.example' }) })),
}))
vi.mock('@sentry/nextjs', () => ({ captureMessage, flush, getClient }))

import { GET } from '../src/app/api/cron/sonda-sentry/route'

const req = (auth?: string) =>
  ({ headers: new Headers(auth ? { authorization: auth } : {}) }) as unknown as Parameters<typeof GET>[0]

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })

describe('sonda-sentry', () => {
  it('sem CRON_SECRET (variável apagada) recusa, mesmo com cabeçalho', async () => {
    delete process.env.CRON_SECRET
    const r = await GET(req('Bearer undefined'))
    expect(r.status).toBe(401)
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('segredo errado recusa', async () => {
    vi.stubEnv('CRON_SECRET', 'abc')
    expect((await GET(req('Bearer xyz'))).status).toBe(401)
    expect((await GET(req())).status).toBe(401)
  })

  it('com segredo: manda aviso, espera flush e devolve só booleanos e id', async () => {
    vi.stubEnv('CRON_SECRET', 'abc')
    const r = await GET(req('Bearer abc'))
    expect(r.status).toBe(200)
    const corpo = await r.json()
    expect(captureMessage).toHaveBeenCalledWith('sonda-sentry', expect.objectContaining({ level: 'warning' }))
    expect(flush).toHaveBeenCalledWith(3000)
    expect(corpo).toMatchObject({ cliente: true, dsnNoCliente: true, flush: true, contextoVercel: false })
    expect(JSON.stringify(corpo)).not.toContain('segredo.example')
    expect(JSON.stringify(corpo)).not.toContain('abc')
  })

  it('sem cliente (init ausente): cliente=false', async () => {
    vi.stubEnv('CRON_SECRET', 'abc')
    getClient.mockReturnValueOnce(undefined as never)
    flush.mockResolvedValueOnce(false)
    const corpo = await (await GET(req('Bearer abc'))).json()
    expect(corpo).toMatchObject({ cliente: false, dsnNoCliente: false, flush: false })
  })
})

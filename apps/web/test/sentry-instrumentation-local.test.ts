// @vitest-environment node
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const web = join(__dirname, '..')
const carregouServer = vi.fn()
const carregouEdge = vi.fn()
let falha = false
vi.mock('@sentry/nextjs', () => ({ captureRequestError: vi.fn() }))

beforeEach(() => {
  vi.resetModules()
  vi.doMock('../sentry.server.config', () => {
    carregouServer()
    if (falha) throw new Error('config quebrado')
    return {}
  })
  vi.doMock('../sentry.edge.config', () => { carregouEdge(); return {} })
})
afterEach(() => {
  vi.unstubAllEnvs()
  carregouServer.mockClear(); carregouEdge.mockClear(); falha = false
})

describe('instrumentation', () => {
  it('com app em src/, o hook fica em src/ (next build só procura em join(appDir, ".."))', () => {
    expect(existsSync(join(web, 'src/app'))).toBe(true)
    expect(existsSync(join(web, 'src/instrumentation.ts'))).toBe(true)
    expect(existsSync(join(web, 'instrumentation.ts'))).toBe(false)
  })

  it('register carrega o config do Node', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    const { register } = await import('../src/instrumentation')
    await register()
    expect(carregouServer).toHaveBeenCalledTimes(1)
    expect(carregouEdge).not.toHaveBeenCalled()
  })

  it('register carrega o config de edge', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge')
    const { register } = await import('../src/instrumentation')
    await register()
    expect(carregouEdge).toHaveBeenCalledTimes(1)
    expect(carregouServer).not.toHaveBeenCalled()
  })

  it('sem NEXT_RUNTIME não carrega nada (variável apagada)', async () => {
    vi.unstubAllEnvs()
    delete process.env.NEXT_RUNTIME
    const { register } = await import('../src/instrumentation')
    await expect(register()).resolves.toBeUndefined()
    expect(carregouServer).not.toHaveBeenCalled()
    expect(carregouEdge).not.toHaveBeenCalled()
  })

  it('register não lança se o config falhar', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    falha = true
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { register } = await import('../src/instrumentation')
    await expect(register()).resolves.toBeUndefined()
    expect(erro).toHaveBeenCalled()
    erro.mockRestore()
  })
})

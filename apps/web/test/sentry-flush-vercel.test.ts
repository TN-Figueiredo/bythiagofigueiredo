// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

const { flush } = vi.hoisted(() => ({ flush: vi.fn(async () => true) }))
vi.mock('@sentry/nextjs', () => ({ flush }))

import { agendarFlushNaVercel } from '../src/lib/sentry-flush'

const CHAVE = Symbol.for('@vercel/request-context')
const g = globalThis as unknown as Record<symbol, unknown>

afterEach(() => { delete g[CHAVE]; flush.mockClear() })

describe('agendarFlushNaVercel', () => {
  it('entrega o flush ao waitUntil da requisição para a função não congelar antes do envio', () => {
    const waitUntil = vi.fn()
    const ctx = { waitUntil }
    g[CHAVE] = { get: () => ctx }
    agendarFlushNaVercel()
    expect(waitUntil).toHaveBeenCalledTimes(1)
    expect(flush).toHaveBeenCalledWith(2000)
  })
  it('junta eventos seguidos da mesma requisição em um só flush', () => {
    const waitUntil = vi.fn()
    const ctx = { waitUntil }
    g[CHAVE] = { get: () => ctx }
    agendarFlushNaVercel(); agendarFlushNaVercel()
    expect(waitUntil).toHaveBeenCalledTimes(1)
  })
  it('evento capturado depois de o flush terminar agenda outro (não se perde na mesma requisição)', async () => {
    const waitUntil = vi.fn()
    const ctx = { waitUntil }
    g[CHAVE] = { get: () => ctx }
    agendarFlushNaVercel()
    await waitUntil.mock.calls[0]![0]
    agendarFlushNaVercel()
    expect(waitUntil).toHaveBeenCalledTimes(2)
  })
  it('evento capturado durante o flush em curso não se perde: nova volta dentro do mesmo waitUntil', async () => {
    let solta!: () => void
    flush.mockImplementationOnce(() => new Promise<boolean>((r) => { solta = () => r(true) }))
    const waitUntil = vi.fn()
    g[CHAVE] = { get: () => ({ waitUntil }) }
    const ctx = { waitUntil }
    g[CHAVE] = { get: () => ctx }
    agendarFlushNaVercel()
    agendarFlushNaVercel()
    solta()
    await waitUntil.mock.calls[0]![0]
    expect(waitUntil).toHaveBeenCalledTimes(1)
    expect(flush).toHaveBeenCalledTimes(2)
  })
  it('teto de 5 voltas mesmo com eventos sem fim', async () => {
    const waitUntil = vi.fn()
    const ctx = { waitUntil }
    g[CHAVE] = { get: () => ctx }
    flush.mockImplementation(async () => { agendarFlushNaVercel(); return true })
    agendarFlushNaVercel()
    await waitUntil.mock.calls[0]![0]
    flush.mockImplementation(async () => true)
    expect(flush).toHaveBeenCalledTimes(5)
  })
  it('sem contexto da Vercel (dev, teste, fora de requisição) não faz nada nem lança', () => {
    expect(() => agendarFlushNaVercel()).not.toThrow()
    expect(flush).not.toHaveBeenCalled()
  })
})

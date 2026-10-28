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
  it('sem contexto da Vercel (dev, teste, fora de requisição) não faz nada nem lança', () => {
    expect(() => agendarFlushNaVercel()).not.toThrow()
    expect(flush).not.toHaveBeenCalled()
  })
})

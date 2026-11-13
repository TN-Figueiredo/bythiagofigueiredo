// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const captureMessage = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => captureMessage(...a) }))

import { avisarRecusa, hostSeguro, __zerarAvisos } from '../../../src/lib/youtube/observatorio/acesso-ia/oauth/aviso'

beforeEach(() => { captureMessage.mockClear(); __zerarAvisos() })

describe('avisarRecusa', () => {
  it('100 recusas na mesma hora = 1 captureMessage, com contagem e sem IP', () => {
    for (let i = 0; i < 100; i++) avisarRecusa('redirect', 'evil.com')
    expect(captureMessage).toHaveBeenCalledTimes(1)
    const [, opts] = captureMessage.mock.calls[0]
    expect(opts.level).toBe('warning')
    expect(opts.extra.contagem).toBe(1)
    expect(opts.extra.host).toBe('evil.com')
    expect(JSON.stringify(captureMessage.mock.calls[0])).not.toMatch(/\b\d+\.\d+\.\d+\.\d+\b/)
  })
  it('tipos diferentes têm avisos independentes', () => {
    avisarRecusa('redirect'); avisarRecusa('teto_dia')
    expect(captureMessage).toHaveBeenCalledTimes(2)
  })
  it('na hora seguinte avisa de novo com a contagem acumulada', () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.UTC(2026, 10, 13, 10, 5))
    for (let i = 0; i < 5; i++) avisarRecusa('limite_register')
    vi.setSystemTime(Date.UTC(2026, 10, 13, 11, 1))
    avisarRecusa('limite_register')
    vi.useRealTimers()
    expect(captureMessage).toHaveBeenCalledTimes(2)
    expect(captureMessage.mock.calls[1][1].extra.contagem).toBe(5)
  })
})

describe('hostSeguro', () => {
  it('extrai o host em minúsculas', () => {
    expect(hostSeguro('https://EVIL.com/x?y')).toBe('evil.com')
  })
  it('rejeita o que não é [a-z0-9.-]{1,100}', () => {
    expect(hostSeguro('não é url')).toBeNull()
    expect(hostSeguro('https://' + 'a'.repeat(101) + '.com/')).toBeNull()
  })
})

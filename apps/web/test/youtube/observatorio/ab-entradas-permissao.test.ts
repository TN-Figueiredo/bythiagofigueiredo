// @vitest-environment node
// Yannis M3: a guarda de edição que LANÇA vira "false" (nada aparece) mas deixa rastro no Sentry.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const m = vi.hoisted(() => ({ guarda: vi.fn(), captureException: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureException: m.captureException }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: m.guarda }))

import { podeEditarSite } from '../../../src/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/permissao'

beforeEach(() => { m.guarda.mockReset(); m.captureException.mockReset() })

describe('podeEditarSite', () => {
  it('ok e negado não chamam o Sentry', async () => {
    m.guarda.mockResolvedValueOnce({ ok: true })
    expect(await podeEditarSite('s1')).toBe(true)
    m.guarda.mockResolvedValueOnce({ ok: false })
    expect(await podeEditarSite('s1')).toBe(false)
    expect(m.captureException).not.toHaveBeenCalled()
  })
  it('guarda que lança: false e UM aviso ao Sentry com o siteId', async () => {
    m.guarda.mockRejectedValue(new Error('x'))
    expect(await podeEditarSite('s1')).toBe(false)
    expect(m.captureException).toHaveBeenCalledTimes(1)
    expect(m.captureException.mock.calls[0]![1]).toMatchObject({ extra: { siteId: 's1' } })
  })
})

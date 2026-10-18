// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

const has = vi.fn()
vi.mock('../../lib/auth/has-recovery-session', () => ({ hasRecoverySession: () => has() }))
vi.mock('../../src/app/cms/reset/reset-form', () => ({ ResetForm: () => null }))

describe('/cms/reset page', () => {
  it('com sessão: canReset true', async () => {
    has.mockResolvedValue(true)
    const { default: Page } = await import('../../src/app/cms/reset/page')
    const el = await Page()
    expect((el.props as { canReset: boolean }).canReset).toBe(true)
  })
  it('sem sessão: canReset false', async () => {
    has.mockResolvedValue(false)
    const { default: Page } = await import('../../src/app/cms/reset/page')
    const el = await Page()
    expect((el.props as { canReset: boolean }).canReset).toBe(false)
  })
})

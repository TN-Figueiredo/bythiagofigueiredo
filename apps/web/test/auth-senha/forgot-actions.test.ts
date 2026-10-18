// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const base = vi.fn(async (_i: unknown) => ({ ok: true }))
vi.mock('@tn-figueiredo/auth-nextjs/actions', () => ({ forgotPassword: (i: unknown) => base(i) }))

describe('forgot actions resetPath', () => {
  beforeEach(() => base.mockClear())

  it('cms passa pelo callback com next=/cms/reset', async () => {
    const { forgotPassword } = await import('../../src/app/cms/forgot/actions')
    await forgotPassword({ email: 'a@b.c' })
    expect(base.mock.calls[0]![0]).toMatchObject({ resetPath: '/auth/callback?next=/cms/reset' })
  })

  it('admin passa pelo callback com next=/admin/reset', async () => {
    const { forgotPassword } = await import('../../src/app/admin/forgot/actions')
    await forgotPassword({ email: 'a@b.c' })
    expect(base.mock.calls[0]![0]).toMatchObject({ resetPath: '/auth/callback?next=/admin/reset' })
  })

  it('sem NEXT_PUBLIC_APP_URL cai em string vazia (default)', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    const { forgotPassword } = await import('../../src/app/cms/forgot/actions')
    await forgotPassword({ email: 'a@b.c' })
    expect(base.mock.calls[0]![0]).toMatchObject({ appUrl: '' })
  })
})

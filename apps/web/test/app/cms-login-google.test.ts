// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

const base = vi.fn(async (_i: unknown) => ({ ok: true as const, data: { url: 'https://g.example' } }))
vi.mock('@tn-figueiredo/auth-nextjs/actions', () => ({ signInWithGoogle: (i: unknown) => base(i) }))
vi.mock('next/headers', () => ({ cookies: async () => ({ set: vi.fn() }) }))

import { signInWithGoogle } from '../../src/app/cms/login/actions'

describe('signInWithGoogle (login do CMS)', () => {
  it('repassa o destino ao pacote', async () => {
    await signInWithGoogle({ appUrl: 'https://x.example', redirectTo: '/oauth/consentimento?authorization_id=abc' })
    expect(base).toHaveBeenCalledWith({ appUrl: 'https://x.example', redirectTo: '/oauth/consentimento?authorization_id=abc' })
  })
})

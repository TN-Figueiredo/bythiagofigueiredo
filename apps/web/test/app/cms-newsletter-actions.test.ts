import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/cms/auth-guards', () => ({
  requireSiteAdminForRow: vi.fn().mockResolvedValue({ siteId: 's1' }),
}))

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({
    siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR', primaryDomain: 'localhost',
  }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

const fromMock = vi.fn()
const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null })

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'test@example.com' } } }),
    },
  }),
}))

vi.mock('../../lib/email/service', () => ({
  getEmailService: () => ({
    send: vi.fn().mockResolvedValue({ messageId: 'msg_1', provider: 'resend' }),
  }),
}))

import {
  saveEdition,
  sendTestEmail,
  cancelEdition,
} from '../../src/app/cms/(authed)/newsletters/actions'

describe('newsletter actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'ed1', site_id: 's1', status: 'draft', newsletter_type_id: 'main-pt' },
            error: null,
          }),
          single: vi.fn().mockResolvedValue({
            data: { id: 'ed1', site_id: 's1', status: 'draft', sender_name: 'Test', sender_email: 'test@test.com' },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ data: null, error: null }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'ed1' },
            error: null,
          }),
        }),
      }),
    })
  })

  it('saveEdition returns ok for valid input', async () => {
    const result = await saveEdition('ed1', {
      subject: 'Test Newsletter',
      content_mdx: '# Hello',
    })
    expect(result.ok).toBe(true)
  })

  it('cancelEdition sets status to cancelled', async () => {
    const result = await cancelEdition('ed1')
    expect(result.ok).toBe(true)
  })
})

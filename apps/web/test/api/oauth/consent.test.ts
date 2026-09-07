// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}))

import * as Sentry from '@sentry/nextjs'
import { recordSocialConsent } from '@/lib/oauth/consent'

type ServiceClient = Parameters<typeof recordSocialConsent>[0]

const SITE = '11111111-2222-4333-8444-555555555555'
const USER = '66666666-7777-4888-8999-aaaaaaaaaaaa'

function makeSupabase(opts: {
  textRow?: { id: string } | null
  textError?: { code: string; message: string } | null
  insertError?: { code?: string; message: string } | null
} = {}) {
  const insert = vi.fn().mockResolvedValue({ error: opts.insertError ?? null })
  const maybeSingle = vi.fn().mockResolvedValue({
    data: opts.textRow === undefined ? { id: 'social_integration_v1_pt-BR' } : opts.textRow,
    error: opts.textError ?? null,
  })
  const chain: Record<string, unknown> = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle,
    insert,
  }
  for (const key of ['select', 'eq', 'is', 'order', 'limit']) {
    ;(chain[key] as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  }
  const from = vi.fn().mockReturnValue(chain)
  return { client: { from } as unknown as ServiceClient, from, chain, insert, maybeSingle }
}

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request('https://bythiagofigueiredo.com/api/social/oauth/google/callback', {
    headers: {
      'x-forwarded-for': '203.0.113.9, 70.41.3.18',
      'user-agent': 'Mozilla/5.0 (Test)',
      ...headers,
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('recordSocialConsent', () => {
  it('reads the newest non-superseded text for the request locale', async () => {
    const sb = makeSupabase()
    await recordSocialConsent(sb.client, {
      userId: USER,
      siteId: SITE,
      category: 'social_integration',
      req: makeReq({ 'x-default-locale': 'en' }),
    })

    expect(sb.from).toHaveBeenCalledWith('consent_texts')
    expect(sb.chain.eq).toHaveBeenCalledWith('category', 'social_integration')
    expect(sb.chain.eq).toHaveBeenCalledWith('locale', 'en')
    expect(sb.chain.is).toHaveBeenCalledWith('superseded_at', null)
    expect(sb.chain.order).toHaveBeenCalledWith('effective_at', { ascending: false })
    expect(sb.chain.limit).toHaveBeenCalledWith(1)
  })

  it('falls back to pt-BR when the middleware set no locale', async () => {
    const sb = makeSupabase()
    await recordSocialConsent(sb.client, {
      userId: USER,
      siteId: SITE,
      category: 'social_integration',
      req: makeReq(),
    })
    expect(sb.chain.eq).toHaveBeenCalledWith('locale', 'pt-BR')
  })

  it('inserts the consent row with ip and user_agent', async () => {
    const sb = makeSupabase()
    await recordSocialConsent(sb.client, {
      userId: USER,
      siteId: SITE,
      category: 'social_integration',
      req: makeReq(),
    })

    expect(sb.from).toHaveBeenCalledWith('consents')
    expect(sb.insert).toHaveBeenCalledTimes(1)
    const row = sb.insert.mock.calls[0]![0] as Record<string, unknown>
    expect(row.user_id).toBe(USER)
    expect(row.site_id).toBe(SITE)
    expect(row.category).toBe('social_integration')
    expect(row.consent_text_id).toBe('social_integration_v1_pt-BR')
    expect(row.granted).toBe(true)
    expect(row.ip).toBe('203.0.113.9')
    expect(row.user_agent).toBe('Mozilla/5.0 (Test)')
  })

  it('never uses upsert (the composite onConflict is not inferable)', async () => {
    const sb = makeSupabase()
    await recordSocialConsent(sb.client, {
      userId: USER,
      siteId: SITE,
      category: 'social_integration',
      req: makeReq(),
    })
    expect(sb.chain.upsert).toBeUndefined()
  })

  it('does not insert when no consent text exists, and reports it', async () => {
    const sb = makeSupabase({ textRow: null })
    await recordSocialConsent(sb.client, {
      userId: USER,
      siteId: SITE,
      category: 'social_integration',
      req: makeReq(),
    })
    expect(sb.insert).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })

  it('does not insert when the lookup itself errors', async () => {
    const sb = makeSupabase({ textError: { code: '42501', message: 'denied' } })
    await recordSocialConsent(sb.client, {
      userId: USER,
      siteId: SITE,
      category: 'social_integration',
      req: makeReq(),
    })
    expect(sb.insert).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })

  it('treats 23505 as already recorded and stays quiet', async () => {
    const sb = makeSupabase({ insertError: { code: '23505', message: 'duplicate key' } })
    await recordSocialConsent(sb.client, {
      userId: USER,
      siteId: SITE,
      category: 'social_integration',
      req: makeReq(),
    })
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('reports any other insert error without throwing', async () => {
    const sb = makeSupabase({ insertError: { code: '23514', message: 'check violation' } })
    await expect(
      recordSocialConsent(sb.client, {
        userId: USER,
        siteId: SITE,
        category: 'social_integration',
        req: makeReq(),
      }),
    ).resolves.toBeUndefined()
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })

  it('contains a thrown client and never rejects the caller', async () => {
    const client = {
      from: () => {
        throw new Error('connection reset')
      },
    } as unknown as ServiceClient
    await expect(
      recordSocialConsent(client, {
        userId: USER,
        siteId: SITE,
        category: 'social_integration',
        req: makeReq(),
      }),
    ).resolves.toBeUndefined()
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })
})

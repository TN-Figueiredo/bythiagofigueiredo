import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/cron-health', () => ({
  recordCronSuccess: vi.fn(),
  recordCronFailure: vi.fn(),
}))

import { GET } from '@/app/api/cron/research-digest/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { createNotification } from '@/lib/notifications/create'

const mockNotify = vi.mocked(createNotification)

function makeRequest(secret = 'test-secret') {
  return new NextRequest('http://localhost/api/cron/research-digest', {
    headers: { authorization: `Bearer ${secret}` },
  })
}

interface SiteData {
  items?: unknown[]
  foco?: unknown
  decisions?: unknown[]
  owner?: { user_id: string } | null
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

// Mock that serves: sites list, then per-site digest queries + owner lookup.
function buildMockSupabase(sites: string[], dataBySite: Record<string, SiteData>) {
  // current site context — set as queries flow; research queries always carry
  // .eq('site_id', X) first, so we capture it.
  function from(table: string) {
    if (table === 'sites') {
      return {
        select: () => Promise.resolve({ data: sites.map(id => ({ id })), error: null }),
      }
    }
    if (table === 'research_items') {
      let siteId = ''
      const b: Record<string, unknown> = {
        select: () => b,
        eq: (_col: string, val: string) => {
          siteId = val
          return Promise.resolve({ data: dataBySite[siteId]?.items ?? [], error: null })
        },
      }
      return b
    }
    if (table === 'research_focos') {
      let siteId = ''
      const b: Record<string, unknown> = {
        select: () => b,
        eq: (col: string, val: string) => {
          if (col === 'site_id') siteId = val
          return b
        },
        maybeSingle: () => Promise.resolve({ data: dataBySite[siteId]?.foco ?? null, error: null }),
      }
      return b
    }
    if (table === 'research_decisions') {
      let siteId = ''
      const b: Record<string, unknown> = {
        select: () => b,
        eq: (col: string, val: string) => {
          if (col === 'site_id') siteId = val
          return b
        },
        neq: () => Promise.resolve({ data: dataBySite[siteId]?.decisions ?? [], error: null }),
      }
      return b
    }
    if (table === 'site_users') {
      let siteId = ''
      const b: Record<string, unknown> = {
        select: () => b,
        eq: (col: string, val: string) => {
          if (col === 'site_id') siteId = val
          return b
        },
        limit: () => b,
        single: () => Promise.resolve({ data: dataBySite[siteId]?.owner ?? null, error: null }),
      }
      return b
    }
    throw new Error(`unexpected table ${table}`)
  }
  return { from }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', 'test-secret')
  mockNotify.mockResolvedValue({ success: true, notificationId: 'n1' })
})

describe('cron/research-digest', () => {
  it('rejects unauthorized requests', async () => {
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(buildMockSupabase([], {}))
    const res = await GET(makeRequest('wrong'))
    expect(res.status).toBe(401)
    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('notifies the owner when a maturing theme exists', async () => {
    const items = Array.from({ length: 3 }, (_, i) => ({
      id: `g${i}`, title: `G${i}`, status: 'analise', theme_id: 'games', pinned: false,
      created_at: daysAgoIso(3), updated_at: daysAgoIso(3),
    }))
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(
      buildMockSupabase(['site-1'], {
        'site-1': { items, owner: { user_id: 'owner-1' } },
      }),
    )

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.notified).toBe(1)
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'pipeline.research_digest',
        domain: 'pipeline',
        site_id: 'site-1',
        user_id: 'owner-1',
        dedup_key: expect.stringContaining('research-digest:site-1:'),
      }),
    )
    const arg = mockNotify.mock.calls[0]![0]
    expect(arg.dedup_key).toContain('tema-games')
    expect(arg.message).toContain('games')
  })

  it('sends NO notification when nothing is worth surfacing (suggest-don\'t-nag)', async () => {
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(
      buildMockSupabase(['site-1'], {
        'site-1': {
          items: [{ id: 'a', title: 'A', status: 'fresca', theme_id: 'games', pinned: false, created_at: daysAgoIso(1), updated_at: daysAgoIso(1) }],
          owner: { user_id: 'owner-1' },
        },
      }),
    )

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.notified).toBe(0)
    expect(body.skipped).toBe(1)
    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('prioritizes overdue revisit over maturing theme', async () => {
    const items = Array.from({ length: 3 }, (_, i) => ({
      id: `g${i}`, title: `G${i}`, status: 'analise', theme_id: 'games', pinned: false,
      created_at: daysAgoIso(3), updated_at: daysAgoIso(3),
    }))
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(
      buildMockSupabase(['site-1'], {
        'site-1': {
          items,
          decisions: [{ id: 'd1', title: 'X', horizon: 'agora', status: 'decidido', revisit: daysAgoIso(10) }],
          owner: { user_id: 'owner-1' },
        },
      }),
    )

    await GET(makeRequest())
    const arg = mockNotify.mock.calls[0]![0]
    expect(arg.dedup_key).toContain(':revisit')
    expect(arg.payload).toMatchObject({ kind: 'revisit_due' })
  })

  it('skips a site with no owner', async () => {
    const items = Array.from({ length: 3 }, (_, i) => ({
      id: `g${i}`, title: `G${i}`, status: 'analise', theme_id: 'games', pinned: false,
      created_at: daysAgoIso(3), updated_at: daysAgoIso(3),
    }))
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(
      buildMockSupabase(['site-1'], { 'site-1': { items, owner: null } }),
    )

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.notified).toBe(0)
    expect(body.skipped).toBe(1)
    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('fans out across multiple sites independently', async () => {
    const maturing = Array.from({ length: 3 }, (_, i) => ({
      id: `g${i}`, title: `G${i}`, status: 'analise', theme_id: 'games', pinned: false,
      created_at: daysAgoIso(3), updated_at: daysAgoIso(3),
    }))
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(
      buildMockSupabase(['site-1', 'site-2'], {
        'site-1': { items: maturing, owner: { user_id: 'owner-1' } },
        'site-2': { items: [], owner: { user_id: 'owner-2' } }, // nothing to surface
      }),
    )

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.sites).toBe(2)
    expect(body.notified).toBe(1)
    expect(mockNotify).toHaveBeenCalledTimes(1)
  })
})

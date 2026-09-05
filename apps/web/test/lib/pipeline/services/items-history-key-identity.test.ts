import { describe, it, expect, vi, beforeEach } from 'vitest'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_ITEM_ID = '22222222-2222-2222-2222-222222222222'
const MOCK_KEY_ID = '33333333-3333-3333-3333-333333333333'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { restoreItem } from '@/lib/pipeline/services/items'
import type { ServiceContext } from '@/lib/pipeline/services/types'

/**
 * `content_pipeline_history.changed_by` is a strict FK to auth.users(id), so every
 * write made via a pipeline_api_keys credential (Cowork/MCP) leaves it NULL. The
 * additive `changed_by_key_id` column (migration
 * 20260903000001_pipeline_history_key_identity) exists to give those writes a
 * reconstructible identity trail — but only if every history insert actually
 * populates it from ServiceContext.keyId. This test fails if that plumbing is
 * ever dropped (e.g. someone reverts the insert payload back to omitting the
 * field, or authToServiceContext/buildCtx stop forwarding keyId).
 */
function makeInsertCapturingSupabase(updateResult: { data: unknown; error?: unknown }) {
  const insertCalls: Record<string, unknown>[] = []

  const updateChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(updateResult),
  }

  const historyChain = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      insertCalls.push(payload)
      return Promise.resolve({ data: null, error: null })
    }),
  }

  const from = vi.fn((table: string) => {
    if (table === 'content_pipeline_history') return historyChain
    return updateChain
  })

  return { supabase: { from } as any, insertCalls }
}

function baseCtx(overrides: Partial<ServiceContext>): ServiceContext {
  return {
    siteId: MOCK_SITE_ID,
    permissions: ['write'],
    source: 'api_key',
    supabase: undefined as any,
    ...overrides,
  }
}

describe('restoreItem — content_pipeline_history.changed_by_key_id', () => {
  const restored = { id: MOCK_ITEM_ID, version: 3, updated_at: '2026-01-01', is_archived: false }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('populates changed_by_key_id from ctx.keyId when source is api_key', async () => {
    const { supabase, insertCalls } = makeInsertCapturingSupabase({ data: restored })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase)

    const ctx = baseCtx({ source: 'api_key', keyId: MOCK_KEY_ID, supabase })
    await restoreItem(ctx, MOCK_ITEM_ID)

    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0]).toMatchObject({ changed_by_key_id: MOCK_KEY_ID })
  })

  it('writes changed_by_key_id: null for session-authenticated writes', async () => {
    const { supabase, insertCalls } = makeInsertCapturingSupabase({ data: restored })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase)

    const ctx = baseCtx({ source: 'session', keyId: undefined, supabase })
    await restoreItem(ctx, MOCK_ITEM_ID)

    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0]).toMatchObject({ changed_by_key_id: null })
  })

  it('writes changed_by_key_id: null for api_key source with no keyId resolved (defensive)', async () => {
    const { supabase, insertCalls } = makeInsertCapturingSupabase({ data: restored })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase)

    const ctx = baseCtx({ source: 'api_key', keyId: undefined, supabase })
    await restoreItem(ctx, MOCK_ITEM_ID)

    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0]).toMatchObject({ changed_by_key_id: null })
  })
})

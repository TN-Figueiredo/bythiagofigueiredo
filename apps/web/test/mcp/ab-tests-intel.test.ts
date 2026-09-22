// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mcpCtx = { siteId: 'site-1', permissions: ['read'] as string[], keyHash: 'h', keyId: 'key-1' }
vi.mock('@/lib/pipeline/mcp/context', () => ({ getMcpContext: () => mcpCtx }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn(() => ({ from: vi.fn() })) }))
vi.mock('@/lib/pipeline/services/youtube', async (orig) => ({
  ...(await orig<typeof import('@/lib/pipeline/services/youtube')>()),
  claimNextTask: vi.fn(async () => ({ data: null })),
  submitIntelRecommendations: vi.fn(async () => ({ data: { status: 'ok', processed: true } })),
}))

import { manageAbTest } from '@/lib/pipeline/mcp/services/ab-tests'
import { claimNextTask } from '@/lib/pipeline/services/youtube'

describe('manage_ab_test — intelligence actions require write over MCP', () => {
  beforeEach(() => { vi.clearAllMocks(); mcpCtx.permissions = ['read'] })

  it('FORBIDs claim_task for a {read} key', async () => {
    const res = await manageAbTest({ action: 'claim_task' })
    expect(JSON.stringify(res)).toContain('FORBIDDEN')
    expect(claimNextTask).not.toHaveBeenCalled()
  })

  it('FORBIDs claim_task for a {read,intelligence} key — REST only', async () => {
    mcpCtx.permissions = ['read', 'intelligence']
    const res = await manageAbTest({ action: 'claim_task' })
    expect(JSON.stringify(res)).toContain('FORBIDDEN')
    expect(claimNextTask).not.toHaveBeenCalled()
  })

  it('passes keyId into the service context so claimed_by is recorded', async () => {
    mcpCtx.permissions = ['read', 'write']
    await manageAbTest({ action: 'claim_task' })
    expect(vi.mocked(claimNextTask).mock.calls[0]![0]).toMatchObject({ keyId: 'key-1' })
  })

  it('FORBIDs upsert_variants and delete_variant for {read,intelligence}', async () => {
    mcpCtx.permissions = ['read', 'intelligence']
    for (const action of ['upsert_variants', 'delete_variant', 'submit_intelligence']) {
      expect(JSON.stringify(await manageAbTest({ action }))).toContain('FORBIDDEN')
    }
  })
})

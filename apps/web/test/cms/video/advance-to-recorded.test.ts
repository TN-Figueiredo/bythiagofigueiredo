import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1', timezone: 'UTC' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

import { advanceToRecorded } from '@/app/cms/(authed)/video/[id]/edit/actions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

function buildSupabase(item: Record<string, unknown> | null, updateError: { message: string } | null = null) {
  const updateData: Record<string, unknown>[] = []
  const chain = (table: string) => {
    const obj: Record<string, unknown> = {}
    const ret = () => obj
    obj.select = vi.fn(ret); obj.eq = vi.fn(ret)
    obj.update = vi.fn((d: Record<string, unknown>) => { updateData.push({ table, ...d }); return obj })
    // single() resolves the read first; after an update was queued, it resolves the updated row.
    obj.single = vi.fn().mockImplementation(() =>
      updateData.length > 0 && !updateError
        ? Promise.resolve({ data: { ...item, stage: 'gravacao', version: (item!.version as number) + 1 }, error: null })
        : updateError
          ? Promise.resolve({ data: null, error: updateError })
          : Promise.resolve({ data: item, error: item ? null : { message: 'no row' } }),
    )
    return obj
  }
  return { from: vi.fn(chain), _updateData: updateData }
}

beforeEach(() => vi.clearAllMocks())

describe('advanceToRecorded', () => {
  it('sets stage=gravacao when current stage is below gravacao (edit scope)', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'u1' } } as never)
    const sb = buildSupabase({ id: 'p1', stage: 'idea', version: 1, format: 'video' })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(sb as never)
    const res = await advanceToRecorded('p1', 1)
    expect(res.ok).toBe(true)
    expect(requireSiteScope).toHaveBeenCalledWith(expect.objectContaining({ mode: 'edit' }))
  })

  it('is a no-op (returns current) when already at/above gravacao — never downgrades', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'u1' } } as never)
    const sb = buildSupabase({ id: 'p1', stage: 'pos_producao', version: 2, format: 'video' })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(sb as never)
    const res = await advanceToRecorded('p1', 2)
    expect(res.ok).toBe(true)
    expect(sb._updateData.length).toBe(0)
  })

  it('returns 403 when scope check fails', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'insufficient_access' } as never)
    const res = await advanceToRecorded('p1', 1)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('forbidden')
  })

  it('returns version conflict on stale version', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'u1' } } as never)
    const sb = buildSupabase({ id: 'p1', stage: 'idea', version: 5, format: 'video' })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(sb as never)
    const res = await advanceToRecorded('p1', 1)
    expect(res.ok).toBe(false)
  })
})

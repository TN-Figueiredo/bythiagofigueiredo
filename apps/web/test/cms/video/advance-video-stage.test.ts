import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

import { advanceVideoStage } from '@/app/cms/(authed)/video/[id]/edit/actions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

function buildSupabase(item: Record<string, unknown>) {
  const obj: Record<string, unknown> = {}
  const ret = () => obj
  obj.select = vi.fn(ret); obj.eq = vi.fn(ret); obj.update = vi.fn(ret)
  // First single() = the row read; subsequent single() = the updated row.
  obj.single = vi.fn()
    .mockResolvedValueOnce({ data: item, error: null })
    .mockResolvedValue({ data: { ...item, version: (item.version as number) + 1 }, error: null })
  return { from: vi.fn(() => obj) }
}

beforeEach(() => vi.clearAllMocks())

describe('advanceVideoStage scope escalation (§3.2/§9)', () => {
  it('uses mode:edit when target stage is NOT publish-equivalent (roteiro→gravacao)', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'u1' } } as never)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(buildSupabase({ id: 'p1', stage: 'roteiro', version: 1, format: 'video', language: 'pt-br' }) as never)
    await advanceVideoStage('p1', 1)
    expect(requireSiteScope).toHaveBeenCalledWith(expect.objectContaining({ mode: 'edit' }))
  })

  it('escalates to mode:publish when target stage is scheduled (publish-equivalent)', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'u1' } } as never)
    // pos_producao → scheduled is publish-equivalent (videoColumn(scheduled)==='published')
    vi.mocked(getSupabaseServiceClient).mockReturnValue(buildSupabase({ id: 'p1', stage: 'pos_producao', version: 1, format: 'video', language: 'pt-br' }) as never)
    await advanceVideoStage('p1', 1)
    expect(requireSiteScope).toHaveBeenCalledWith(expect.objectContaining({ mode: 'publish' }))
  })

  it('reporter (publish denied) gets 403 when target is publish-equivalent', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'insufficient_access' } as never)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(buildSupabase({ id: 'p1', stage: 'pos_producao', version: 1, format: 'video', language: 'pt-br' }) as never)
    const res = await advanceVideoStage('p1', 1)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('forbidden')
  })
})

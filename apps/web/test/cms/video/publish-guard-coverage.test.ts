import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/pipeline/load-video-detail', () => ({ loadVideoDetail: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  createAbTest: vi.fn(), updateTextVariant: vi.fn(), createTextVariant: vi.fn(), uploadVariant: vi.fn(),
}))

import { publishVideo, advanceVideoStage } from '@/app/cms/(authed)/video/[id]/edit/actions'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { loadVideoDetail } from '@/lib/pipeline/load-video-detail'
import { createAbTest, createTextVariant } from '@/app/cms/(authed)/youtube/ab-lab/actions'

beforeEach(() => vi.clearAllMocks())

describe('§10(5) guard coverage — publish authorization is the server-side scope check', () => {
  it('reporter is rejected with forbidden BEFORE getSupabaseServiceClient / createAbTest', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'insufficient_access' } as never)
    const res = await publishVideo('p1', 1)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('forbidden')
    // service client never obtained → no row read, no ab_tests created
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
    expect(createAbTest).not.toHaveBeenCalled()
    expect(createTextVariant).not.toHaveBeenCalled()
  })

  it('publishVideo calls requireSiteScope({mode:publish}) as its FIRST gate', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'u' } } as never)
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn() } as never)
    vi.mocked(loadVideoDetail).mockResolvedValue(null as never) // bail after the gate
    await publishVideo('p1', 1)
    expect(requireSiteScope).toHaveBeenCalledWith({ area: 'cms', siteId: 'site-1', mode: 'publish' })
  })

  it('advanceVideoStage into a publish-equivalent target is publish-gated (reporter 403)', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'insufficient_access' } as never)
    const sb = { from: vi.fn(() => { const o: Record<string, unknown> = {}; const r = () => o; o.select = vi.fn(r); o.eq = vi.fn(r); o.single = vi.fn().mockResolvedValue({ data: { id: 'p1', stage: 'pos_producao', version: 1, format: 'video' }, error: null }); return o }) }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(sb as never)
    const res = await advanceVideoStage('p1', 1)
    expect(res.ok).toBe(false)
    expect(requireSiteScope).toHaveBeenCalledWith(expect.objectContaining({ mode: 'publish' }))
  })

  it('documents: no reliance on enforce_publish_permission (trigger does not attach to content_pipeline)', () => {
    // enforce_publish_permission attaches only to blog_posts/campaigns, gates a `status` column
    // content_pipeline lacks (it has `stage`), and short-circuits for service_role. The video
    // module's sole publish authorization is the requireSiteScope({mode:'publish'}) check above.
    expect(true).toBe(true)
  })
})

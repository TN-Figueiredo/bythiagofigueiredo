import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/pipeline/load-video-detail', () => ({ loadVideoDetail: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  createAbTest: vi.fn(),
  updateTextVariant: vi.fn(),
  createTextVariant: vi.fn(),
  uploadVariant: vi.fn(),
}))

import { publishVideo } from '@/app/cms/(authed)/video/[id]/edit/actions'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { loadVideoDetail } from '@/lib/pipeline/load-video-detail'
import { createAbTest, updateTextVariant, createTextVariant, uploadVariant } from '@/app/cms/(authed)/youtube/ab-lab/actions'

const VALID_DRAFT = {
  leader: 'A',
  variants: [
    { id: 'A', tag: 'original', title: 'Orig', brief: 'b orig' },
    { id: 'B', title: 'B', brief: 'b B' },
    { id: 'C', title: 'C', brief: 'b C' },
    { id: 'D', title: 'D', brief: 'b D' },
  ],
}

function detail(over: Record<string, unknown> = {}) {
  return {
    id: 'p1', code: 'VID-001', stage: 'pos_producao', language: 'pt-br', version: 1,
    titlePt: 'T', titleEn: null, formatMetadata: {}, youtubeVideoId: 'yt-1',
    sections: { publish_pt: VALID_DRAFT },
    abJoinFacts: { youtubeVideoId: 'yt-1', thumbnailHqUrl: 'https://x/t.jpg', durationSeconds: 300 },
    ...over,
  }
}

function buildSupabase() {
  const obj: Record<string, unknown> = {}
  const ret = () => obj
  obj.select = vi.fn(ret); obj.eq = vi.fn(ret)
  // ab_test_variants original lookup: select().eq().eq().single() → { id }
  obj.single = vi.fn().mockResolvedValue({ data: { id: 'orig-var-1' }, error: null })
  // content_pipeline update chain → published row
  obj.update = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'p1', stage: 'published', version: 2 }, error: null }) })) })) })) })) }))
  return { from: vi.fn(() => obj) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSupabaseServiceClient).mockReturnValue(buildSupabase() as never)
  vi.mocked(createAbTest).mockResolvedValue({ ok: true, id: 'test-1' } as never)
  vi.mocked(updateTextVariant).mockResolvedValue({ ok: true } as never)
  vi.mocked(createTextVariant).mockResolvedValue({ ok: true, id: 'v' } as never)
})

describe('publishVideo (§5.4/§9)', () => {
  it('calls requireSiteScope mode:publish before any createAbTest', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'u1' } } as never)
    vi.mocked(loadVideoDetail).mockResolvedValue(detail() as never)
    await publishVideo('p1', 1)
    expect(requireSiteScope).toHaveBeenCalledWith(expect.objectContaining({ mode: 'publish' }))
  })

  it('reporter (publish denied) gets 403 and createAbTest is NEVER reached', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'insufficient_access' } as never)
    const res = await publishVideo('p1', 1)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('forbidden')
    expect(createAbTest).not.toHaveBeenCalled()
    expect(createTextVariant).not.toHaveBeenCalled()
  })

  it('materializes in order: createAbTest 1× + updateTextVariant 1× (original) + createTextVariant 3×; uploadVariant never', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'u1' } } as never)
    vi.mocked(loadVideoDetail).mockResolvedValue(detail() as never)
    const res = await publishVideo('p1', 1)
    expect(res.ok).toBe(true)
    expect(createAbTest).toHaveBeenCalledTimes(1)
    expect(createAbTest).toHaveBeenCalledWith(expect.objectContaining({ youtube_video_id: 'yt-1', test_type: 'title' }))
    expect(updateTextVariant).toHaveBeenCalledTimes(1)
    expect(updateTextVariant).toHaveBeenCalledWith('orig-var-1', { title_text: 'Orig', metadata: { visual_description: 'b orig' } })
    expect(createTextVariant).toHaveBeenCalledTimes(3)
    expect(uploadVariant).not.toHaveBeenCalled()
  })

  it('passes content_pipeline.youtube_video_id DIRECTLY (no resolve/upsert step)', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'u1' } } as never)
    vi.mocked(loadVideoDetail).mockResolvedValue(detail() as never)
    await publishVideo('p1', 1)
    const call = vi.mocked(createAbTest).mock.calls[0]?.[0] as { youtube_video_id: string }
    expect(call.youtube_video_id).toBe('yt-1')
  })

  it('rejects publish (no materialize) when precondition fails — Short', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'u1' } } as never)
    vi.mocked(loadVideoDetail).mockResolvedValue(detail({ abJoinFacts: { youtubeVideoId: 'yt-1', thumbnailHqUrl: 'https://x/t.jpg', durationSeconds: 60 } }) as never)
    const res = await publishVideo('p1', 1)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('Shorts')
    expect(createAbTest).not.toHaveBeenCalled()
  })

  it('rejects publish when FK is null (no linked video)', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'u1' } } as never)
    vi.mocked(loadVideoDetail).mockResolvedValue(detail({ youtubeVideoId: null, abJoinFacts: { youtubeVideoId: null, thumbnailHqUrl: null, durationSeconds: null } }) as never)
    const res = await publishVideo('p1', 1)
    expect(res.ok).toBe(false)
    expect(createAbTest).not.toHaveBeenCalled()
  })
})

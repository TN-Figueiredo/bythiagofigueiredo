import { describe, it, expect, vi, beforeEach } from 'vitest'

const calls: string[] = []

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn(async () => {
    calls.push('site-context')
    return { siteId: 'site-1' }
  }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn(async (opts: { mode: string; area: string }) => {
    calls.push(`guard:${opts.area}:${opts.mode}`)
    return { ok: true }
  }),
}))

vi.mock('@/lib/pipeline/load-video-hub', () => ({
  loadVideoHub: vi.fn(async (siteId: string) => {
    calls.push(`load:${siteId}`)
    return { cards: [], stats: { total: 0, roteiro: 0, gravacao: 0, published: 0 }, pillarCounts: {} }
  }),
}))

vi.mock('@tn-figueiredo/cms-ui/client', () => ({ CmsTopbar: () => null }))
vi.mock('@/app/cms/(authed)/video/_components/video-hub', () => ({
  VideoHub: () => null,
}))

import VideoHubPage from '@/app/cms/(authed)/video/page'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

describe('video hub page guard', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('calls requireSiteScope edit BEFORE loading hub data', async () => {
    await VideoHubPage()
    expect(requireSiteScope).toHaveBeenCalledWith({ area: 'cms', siteId: 'site-1', mode: 'edit' })
    expect(calls.indexOf('guard:cms:edit')).toBeLessThan(calls.indexOf('load:site-1'))
  })
})

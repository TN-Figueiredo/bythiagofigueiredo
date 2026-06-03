import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Supabase builder ──────────────────────────────────────────────────
// Reuses the proxy-based thenable chain from blog-hub-actions.test.ts

type MockRow = Record<string, unknown>

let defaultRows: MockRow[] = []
let defaultError: { message: string; code?: string } | null = null
let perTableRows: Record<string, MockRow[]> = {}
let perTableError: Record<string, { message: string; code?: string } | null> = {}
let perTableCount: Record<string, number> = {}
let callLog: Array<{ table: string; method: string; args: unknown[] }> = []
let perTableSequence: Record<string, Array<{ rows?: MockRow[]; error?: { message: string; code?: string } | null }>> = {}
let perTableCallIndex: Record<string, number> = {}

function createMockSupabase() {
  function makeChain(table: string) {
    let useSingle = false
    let isCountQuery = false
    const chain: Record<string, unknown> = {}

    const seqIdx = perTableCallIndex[table] ?? 0
    perTableCallIndex[table] = seqIdx + 1
    const seqEntry = perTableSequence[table]?.[seqIdx]

    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_target, prop: string) {
        if (prop === 'then') {
          const rows = seqEntry?.rows ?? perTableRows[table] ?? defaultRows
          const err = seqEntry?.error !== undefined ? seqEntry.error : (perTableError[table] ?? defaultError)
          if (isCountQuery) {
            const countVal = perTableCount[table] ?? (rows?.length ?? 0)
            const result = { data: null, error: err, count: countVal }
            return (resolve?: (v: unknown) => void) => resolve?.(result)
          }
          if (useSingle) {
            const result = { data: err ? null : (rows?.[0] ?? null), error: err }
            return (resolve?: (v: unknown) => void) => resolve?.(result)
          }
          const result = { data: err ? null : rows, error: err, count: rows?.length ?? 0 }
          return (resolve?: (v: unknown) => void) => resolve?.(result)
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return () => {
            useSingle = true
            return new Proxy(chain, handler)
          }
        }
        if (prop === 'from') {
          return (t: string) => {
            callLog.push({ table: t, method: 'from', args: [t] })
            return makeChain(t)
          }
        }
        return (...args: unknown[]) => {
          callLog.push({ table, method: prop, args })
          if (prop === 'select' && args.length >= 2) {
            const opts = args[1] as Record<string, unknown> | undefined
            if (opts?.count === 'exact' && opts?.head === true) {
              isCountQuery = true
            }
          }
          return new Proxy(chain, handler)
        }
      },
    }
    return new Proxy(chain, handler)
  }

  const top: Record<string, unknown> = {}
  const topHandler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === 'from') {
        return (t: string) => {
          callLog.push({ table: t, method: 'from', args: [t] })
          return makeChain(t)
        }
      }
      return undefined
    },
  }
  return new Proxy(top, topHandler)
}

// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => createMockSupabase(),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 'site-1', orgId: 'org-1', defaultLocale: 'pt-BR' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
  createServerClient: vi.fn().mockReturnValue({
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }),
    },
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [],
      set: vi.fn(),
    }),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }),
    },
  }),
}))

vi.mock('@/lib/seo/cache-invalidation', () => ({
  revalidateBlogPostSeo: vi.fn(),
  revalidateCampaignSeo: vi.fn(),
  revalidateSiteBranding: vi.fn(),
}))

vi.mock('@/lib/links/auto-link', () => ({
  ensureTrackedLink: vi.fn().mockResolvedValue({ linkId: 'link-1', code: 'abc1234', isNew: true }),
  deactivateSourceLinks: vi.fn().mockResolvedValue(0),
  reactivateSourceLinks: vi.fn().mockResolvedValue(0),
  generateShortCode: vi.fn().mockReturnValue('abc1234'),
}))

vi.mock('@/lib/pipeline/blog-sync', () => ({
  syncPipelineOnPostStatusChange: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/social/create-from-content', () => ({
  createSocialPostFromContent: vi.fn().mockResolvedValue({ postId: 'social-1', shortLinkId: null }),
}))

// ─── Imports ────────────────────────────────────────────────────────────────

import {
  movePost,
  deleteHubPost,
  bulkPublish,
  bulkArchive,
  bulkDelete,
} from '../../src/app/cms/(authed)/blog/actions'

import { ensureTrackedLink, deactivateSourceLinks } from '@/lib/links/auto-link'
import { createSocialPostFromContent } from '@/lib/social/create-from-content'

// ─── Helpers ────────────────────────────────────────────────────────────────

function resetMockState(opts?: {
  rows?: MockRow[]
  error?: { message: string; code?: string } | null
  perTable?: Record<string, MockRow[]>
  perTableErr?: Record<string, { message: string; code?: string } | null>
  perTableCnt?: Record<string, number>
  perTableSeq?: Record<string, Array<{ rows?: MockRow[]; error?: { message: string; code?: string } | null }>>
}) {
  defaultRows = opts?.rows ?? []
  defaultError = opts?.error ?? null
  perTableRows = opts?.perTable ?? {}
  perTableError = opts?.perTableErr ?? {}
  perTableCount = opts?.perTableCnt ?? {}
  perTableSequence = opts?.perTableSeq ?? {}
  perTableCallIndex = {}
  callLog = []
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

// ─── Test Suites ─────────────────────────────────────────────────────────────

describe('Blog Publish → Link Lifecycle (E2E)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
  })

  // ──────────────────────────────────────────────────────────────────────────
  describe('publish creates tracked link', () => {
    it('movePost to published calls ensureTrackedLink with correct URL', async () => {
      resetMockState({
        perTable: {
          blog_posts: [
            {
              id: 'p1',
              status: 'ready',
              site_id: 'site-1',
              social_config: null,
              blog_translations: [{ locale: 'pt-BR', slug: 'meu-post' }],
            },
          ],
        },
      })
      const result = await movePost('p1', 'published')
      expect(result).toMatchObject({ ok: true })
      await new Promise((r) => setTimeout(r, 0))
      expect(vi.mocked(ensureTrackedLink)).toHaveBeenCalledOnce()
      expect(vi.mocked(ensureTrackedLink)).toHaveBeenCalledWith(
        expect.anything(),
        'site-1',
        'p1',
        'blog',
        expect.stringContaining('/pt-BR/blog/meu-post'),
        'meu-post',
      )
    })

    it('URL format is {APP_URL}/{locale}/blog/{slug}', async () => {
      resetMockState({
        perTable: {
          blog_posts: [
            {
              id: 'p1',
              status: 'ready',
              site_id: 'site-1',
              social_config: null,
              blog_translations: [{ locale: 'en', slug: 'my-post' }],
            },
          ],
        },
      })
      await movePost('p1', 'published')
      await new Promise((r) => setTimeout(r, 0))
      const [, , , , url] = vi.mocked(ensureTrackedLink).mock.calls[0]!
      expect(url).toBe(`${APP_URL}/en/blog/my-post`)
    })

    it('passes slug as link title', async () => {
      resetMockState({
        perTable: {
          blog_posts: [
            {
              id: 'p1',
              status: 'ready',
              site_id: 'site-1',
              social_config: null,
              blog_translations: [{ locale: 'pt-BR', slug: 'titulo-do-post' }],
            },
          ],
        },
      })
      await movePost('p1', 'published')
      await new Promise((r) => setTimeout(r, 0))
      const [, , , , , title] = vi.mocked(ensureTrackedLink).mock.calls[0]!
      expect(title).toBe('titulo-do-post')
    })

    it('does NOT call ensureTrackedLink for draft → ready transition', async () => {
      resetMockState({
        perTable: {
          blog_posts: [
            {
              id: 'p1',
              status: 'draft',
              site_id: 'site-1',
              social_config: null,
              blog_translations: [{ locale: 'pt-BR', slug: 'meu-post' }],
            },
          ],
        },
      })
      await movePost('p1', 'ready')
      await new Promise((r) => setTimeout(r, 0))
      expect(vi.mocked(ensureTrackedLink)).not.toHaveBeenCalled()
    })

    it('skips ensureTrackedLink when post has no translations', async () => {
      resetMockState({
        perTable: {
          blog_posts: [
            {
              id: 'p1',
              status: 'ready',
              site_id: 'site-1',
              social_config: null,
              blog_translations: [],
            },
          ],
        },
      })
      await movePost('p1', 'published')
      await new Promise((r) => setTimeout(r, 0))
      expect(vi.mocked(ensureTrackedLink)).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  describe('archive deactivates tracked link', () => {
    it('movePost to archived calls deactivateSourceLinks', async () => {
      resetMockState({
        perTable: {
          blog_posts: [
            {
              id: 'p1',
              status: 'published',
              site_id: 'site-1',
              social_config: null,
              blog_translations: [{ locale: 'pt-BR', slug: 'meu-post' }],
            },
          ],
        },
      })
      await movePost('p1', 'archived')
      await new Promise((r) => setTimeout(r, 0))
      expect(vi.mocked(deactivateSourceLinks)).toHaveBeenCalledWith(
        expect.anything(),
        'p1',
        'blog',
      )
    })

    it('bulkArchive calls deactivateSourceLinks for each archived post', async () => {
      resetMockState({
        perTable: {
          blog_posts: [
            { id: 'p1', site_id: 'site-1', blog_translations: [{ locale: 'pt-BR', slug: 'post-1' }] },
            { id: 'p2', site_id: 'site-1', blog_translations: [{ locale: 'pt-BR', slug: 'post-2' }] },
          ],
        },
      })
      const result = await bulkArchive(['p1', 'p2'])
      expect(result).toEqual({ ok: true, count: 2 })
      await new Promise((r) => setTimeout(r, 0))
      expect(vi.mocked(deactivateSourceLinks)).toHaveBeenCalledTimes(2)
      expect(vi.mocked(deactivateSourceLinks)).toHaveBeenCalledWith(expect.anything(), 'p1', 'blog')
      expect(vi.mocked(deactivateSourceLinks)).toHaveBeenCalledWith(expect.anything(), 'p2', 'blog')
    })

    it('does NOT call deactivateSourceLinks when archiving empty list', async () => {
      const result = await bulkArchive([])
      expect(result).toEqual({ ok: true, count: 0 })
      await new Promise((r) => setTimeout(r, 0))
      expect(vi.mocked(deactivateSourceLinks)).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  describe('delete deactivates tracked link', () => {
    it('deleteHubPost calls deactivateSourceLinks', async () => {
      resetMockState({
        perTable: {
          blog_posts: [
            {
              id: 'p1',
              status: 'draft',
              site_id: 'site-1',
              blog_translations: [{ locale: 'en', slug: 'bye' }],
            },
          ],
        },
      })
      const result = await deleteHubPost('p1')
      expect(result).toEqual({ ok: true })
      await new Promise((r) => setTimeout(r, 0))
      expect(vi.mocked(deactivateSourceLinks)).toHaveBeenCalledWith(
        expect.anything(),
        'p1',
        'blog',
      )
    })

    it('bulkDelete calls deactivateSourceLinks for each deleted post', async () => {
      // First from('blog_posts') call: select returns posts to delete
      // Second from('blog_posts') call: delete succeeds
      resetMockState({
        perTableSeq: {
          blog_posts: [
            {
              rows: [
                { id: 'p1', site_id: 'site-1', blog_translations: [{ locale: 'pt-BR', slug: 'draft-1' }] },
                { id: 'p2', site_id: 'site-1', blog_translations: [{ locale: 'pt-BR', slug: 'draft-2' }] },
              ],
            },
            { rows: [] }, // delete result
          ],
        },
      })
      const result = await bulkDelete(['p1', 'p2'])
      expect(result).toEqual({ ok: true, count: 2 })
      await new Promise((r) => setTimeout(r, 0))
      expect(vi.mocked(deactivateSourceLinks)).toHaveBeenCalledTimes(2)
      expect(vi.mocked(deactivateSourceLinks)).toHaveBeenCalledWith(expect.anything(), 'p1', 'blog')
      expect(vi.mocked(deactivateSourceLinks)).toHaveBeenCalledWith(expect.anything(), 'p2', 'blog')
    })

    it('bulkDelete does NOT call deactivateSourceLinks when no posts qualify', async () => {
      resetMockState({
        perTableSeq: {
          blog_posts: [
            { rows: [] }, // select returns nothing (all published)
          ],
        },
      })
      const result = await bulkDelete(['p1'])
      expect(result).toEqual({ ok: true, count: 0 })
      await new Promise((r) => setTimeout(r, 0))
      expect(vi.mocked(deactivateSourceLinks)).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  describe('scheduled publish (cron scenario)', () => {
    // The cron publishes scheduled posts via bulkPublish (direct DB update),
    // NOT via movePost — because scheduled → published is not a valid
    // movePost transition (the state machine skips it to prevent manual bypass).

    it('movePost rejects scheduled → published (invalid transition)', async () => {
      resetMockState({
        perTable: {
          blog_posts: [
            {
              id: 'p1',
              status: 'scheduled',
              site_id: 'site-1',
              social_config: null,
              blog_translations: [{ locale: 'pt-BR', slug: 'post-agendado' }],
            },
          ],
        },
      })
      const result = await movePost('p1', 'published')
      expect(result).toEqual({ ok: false, error: 'invalid_transition' })
      await new Promise((r) => setTimeout(r, 0))
      // No link should be created since transition was rejected
      expect(vi.mocked(ensureTrackedLink)).not.toHaveBeenCalled()
    })

    it('bulkPublish (cron path) creates tracked link for scheduled post', async () => {
      resetMockState({
        perTable: {
          blog_posts: [
            {
              id: 'p1',
              site_id: 'site-1',
              social_config: null,
              blog_translations: [{ locale: 'pt-BR', slug: 'post-agendado' }],
            },
          ],
        },
      })
      const result = await bulkPublish(['p1'])
      expect(result).toEqual({ ok: true, count: 1 })
      await new Promise((r) => setTimeout(r, 0))
      expect(vi.mocked(ensureTrackedLink)).toHaveBeenCalledOnce()
      expect(vi.mocked(ensureTrackedLink)).toHaveBeenCalledWith(
        expect.anything(),
        'site-1',
        'p1',
        'blog',
        `${APP_URL}/pt-BR/blog/post-agendado`,
        'post-agendado',
      )
    })

    it('bulkPublish creates tracked links for each published post', async () => {
      resetMockState({
        perTable: {
          blog_posts: [
            {
              id: 'p1',
              site_id: 'site-1',
              social_config: null,
              blog_translations: [{ locale: 'pt-BR', slug: 'post-um' }],
            },
            {
              id: 'p2',
              site_id: 'site-1',
              social_config: null,
              blog_translations: [{ locale: 'en', slug: 'post-two' }],
            },
          ],
        },
      })
      const result = await bulkPublish(['p1', 'p2'])
      expect(result).toEqual({ ok: true, count: 2 })
      await new Promise((r) => setTimeout(r, 0))
      expect(vi.mocked(ensureTrackedLink)).toHaveBeenCalledTimes(2)
      expect(vi.mocked(ensureTrackedLink)).toHaveBeenCalledWith(
        expect.anything(),
        'site-1',
        'p1',
        'blog',
        `${APP_URL}/pt-BR/blog/post-um`,
        'post-um',
      )
      expect(vi.mocked(ensureTrackedLink)).toHaveBeenCalledWith(
        expect.anything(),
        'site-1',
        'p2',
        'blog',
        `${APP_URL}/en/blog/post-two`,
        'post-two',
      )
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  describe('publish with social config', () => {
    it('fires both ensureTrackedLink and createSocialPostFromContent when social.enabled=true', async () => {
      resetMockState({
        perTable: {
          blog_posts: [
            {
              id: 'p1',
              status: 'ready',
              site_id: 'site-1',
              social_config: {
                enabled: true,
                platforms: ['bluesky'],
                captions: {},
                hashtags: [],
                image_source: 'cover_image',
                ig_template: 'card',
                formats: {},
              },
              blog_translations: [{ locale: 'pt-BR', slug: 'post-com-social' }],
            },
          ],
        },
      })
      await movePost('p1', 'published')
      await new Promise((r) => setTimeout(r, 0))
      expect(vi.mocked(ensureTrackedLink)).toHaveBeenCalledOnce()
      expect(vi.mocked(createSocialPostFromContent)).toHaveBeenCalledOnce()
      expect(vi.mocked(createSocialPostFromContent)).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: 'site-1',
          contentType: 'blog',
          contentId: 'p1',
          origin: 'auto',
          userId: 'system',
        }),
      )
    })

    it('does NOT fire social when social_config.enabled is false', async () => {
      resetMockState({
        perTable: {
          blog_posts: [
            {
              id: 'p1',
              status: 'ready',
              site_id: 'site-1',
              social_config: {
                enabled: false,
                platforms: ['bluesky'],
                captions: {},
                hashtags: [],
                image_source: 'cover_image',
                ig_template: 'card',
                formats: {},
              },
              blog_translations: [{ locale: 'pt-BR', slug: 'post-sem-social' }],
            },
          ],
        },
      })
      await movePost('p1', 'published')
      await new Promise((r) => setTimeout(r, 0))
      // Link is still created
      expect(vi.mocked(ensureTrackedLink)).toHaveBeenCalledOnce()
      // But social is NOT fired
      expect(vi.mocked(createSocialPostFromContent)).not.toHaveBeenCalled()
    })

    it('does NOT fire social when social_config is null', async () => {
      resetMockState({
        perTable: {
          blog_posts: [
            {
              id: 'p1',
              status: 'ready',
              site_id: 'site-1',
              social_config: null,
              blog_translations: [{ locale: 'pt-BR', slug: 'post-null-social' }],
            },
          ],
        },
      })
      await movePost('p1', 'published')
      await new Promise((r) => setTimeout(r, 0))
      expect(vi.mocked(ensureTrackedLink)).toHaveBeenCalledOnce()
      expect(vi.mocked(createSocialPostFromContent)).not.toHaveBeenCalled()
    })

    it('bulkPublish fires social for posts with social_config.enabled', async () => {
      resetMockState({
        perTable: {
          blog_posts: [
            {
              id: 'p1',
              site_id: 'site-1',
              social_config: {
                enabled: true,
                platforms: ['bluesky'],
                captions: {},
                hashtags: [],
                image_source: 'cover_image',
                ig_template: 'card',
                formats: {},
              },
              blog_translations: [{ locale: 'pt-BR', slug: 'social-post' }],
            },
            {
              id: 'p2',
              site_id: 'site-1',
              social_config: { enabled: false, platforms: [], captions: {}, hashtags: [], image_source: 'cover_image', ig_template: 'card', formats: {} },
              blog_translations: [{ locale: 'pt-BR', slug: 'no-social' }],
            },
          ],
        },
      })
      await bulkPublish(['p1', 'p2'])
      await new Promise((r) => setTimeout(r, 0))
      // Both get tracked links
      expect(vi.mocked(ensureTrackedLink)).toHaveBeenCalledTimes(2)
      // Only p1 fires social (enabled=true)
      expect(vi.mocked(createSocialPostFromContent)).toHaveBeenCalledTimes(1)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  describe('multi-locale publish', () => {
    it('uses primary translation (first) for the tracked link', async () => {
      resetMockState({
        perTable: {
          blog_posts: [
            {
              id: 'p1',
              status: 'ready',
              locale: 'pt-BR',
              site_id: 'site-1',
              social_config: null,
              // Two translations — first is the primary
              blog_translations: [
                { locale: 'pt-BR', slug: 'post-principal' },
                { locale: 'en', slug: 'main-post' },
              ],
            },
          ],
        },
      })
      await movePost('p1', 'published')
      await new Promise((r) => setTimeout(r, 0))
      // Only one call, using the FIRST translation
      expect(vi.mocked(ensureTrackedLink)).toHaveBeenCalledOnce()
      const [, , , , url, title] = vi.mocked(ensureTrackedLink).mock.calls[0]!
      expect(url).toBe(`${APP_URL}/pt-BR/blog/post-principal`)
      expect(title).toBe('post-principal')
    })

    it('skips link creation when no translations exist', async () => {
      resetMockState({
        perTable: {
          blog_posts: [
            {
              id: 'p1',
              status: 'ready',
              site_id: 'site-1',
              social_config: null,
              blog_translations: [],
            },
          ],
        },
      })
      await movePost('p1', 'published')
      await new Promise((r) => setTimeout(r, 0))
      expect(vi.mocked(ensureTrackedLink)).not.toHaveBeenCalled()
    })

    it('bulkPublish uses first translation per post for tracked link URL', async () => {
      resetMockState({
        perTable: {
          blog_posts: [
            {
              id: 'p1',
              locale: 'pt-BR',
              site_id: 'site-1',
              social_config: null,
              blog_translations: [
                { locale: 'pt-BR', slug: 'primeiro' },
                { locale: 'en', slug: 'first' },
              ],
            },
          ],
        },
      })
      await bulkPublish(['p1'])
      await new Promise((r) => setTimeout(r, 0))
      expect(vi.mocked(ensureTrackedLink)).toHaveBeenCalledOnce()
      const [, , , , url] = vi.mocked(ensureTrackedLink).mock.calls[0]!
      expect(url).toBe(`${APP_URL}/pt-BR/blog/primeiro`)
    })
  })
})

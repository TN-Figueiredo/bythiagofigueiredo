import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 'test-site-id', orgId: 'o1', defaultLocale: 'pt-BR' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'test-user-id' } }),
}))

vi.mock('@/lib/social/create-from-content', () => ({
  createSocialPostFromContent: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

const revalidateBlogPostSeoMock = vi.fn()
vi.mock('@/lib/seo/cache-invalidation', () => ({
  revalidateBlogPostSeo: (...args: unknown[]) => revalidateBlogPostSeoMock(...args),
  revalidateCampaignSeo: vi.fn(),
  revalidateSiteBranding: vi.fn(),
}))

const syncPipelineMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/pipeline/blog-sync', () => ({
  syncPipelineOnPostStatusChange: (...args: unknown[]) => syncPipelineMock(...args),
}))

// Supabase chainable mock — built per-test via setupChain()
const fromMock = vi.fn()
const updateMock = vi.fn()
const selectMock = vi.fn()
const insertMock = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: fromMock }),
}))

import {
  savePostContent,
  savePostSeo,
  savePostSocialConfig,
  savePostPublishSettings,
  savePostCoverImage,
  schedulePost,
  publishPost,
  returnToPipeline,
} from '../../src/app/cms/(authed)/posts/actions'

import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { revalidatePath } from 'next/cache'
import { createSocialPostFromContent } from '@/lib/social/create-from-content'

// ── Helpers ──────────────────────────────────────────────────────────

const VALID_UUID = '00000000-0000-0000-0000-000000000001'
const SITE_ID = 'test-site-id'

/**
 * Builds a table-specific handler map so fromMock can route different tables
 * to different chains. If a table isn't listed it falls back to a default
 * chain using updateMock/selectMock.
 */
function buildFromMock(tables: Record<string, {
  update?: unknown
  select?: unknown
  insert?: unknown
}>) {
  fromMock.mockImplementation((table: string) => {
    const cfg = tables[table]
    if (!cfg) {
      return {
        update: updateMock,
        select: selectMock,
        insert: insertMock,
      }
    }
    return {
      update: cfg.update ?? updateMock,
      select: cfg.select ?? selectMock,
      insert: cfg.insert ?? insertMock,
    }
  })
}

/** Creates a chainable query builder that resolves to `result` at the end. */
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  chain.eq = vi.fn().mockReturnThis()
  chain.in = vi.fn().mockReturnThis()
  chain.single = vi.fn().mockResolvedValue(result)
  chain.maybeSingle = vi.fn().mockResolvedValue(result)
  // Make the chain itself awaitable (terminal)
  ;(chain as unknown as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve)
  return chain
}

/** Wraps makeChain in an update mock that also supports .returnThis chaining. */
function makeUpdateChain(result: { data: unknown; error: unknown }) {
  const chain = makeChain(result)
  return vi.fn().mockReturnValue(chain)
}

/** Wraps makeChain in a select mock. */
function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain = makeChain(result)
  return vi.fn().mockReturnValue(chain)
}

// ── savePostContent ───────────────────────────────────────────────────

describe('savePostContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } } as never)
  })

  it('rejects invalid UUID', async () => {
    const result = await savePostContent('not-a-uuid', 'pt-BR', { title: 'Hello' })
    expect(result).toEqual({ ok: false, error: 'ID inválido' })
  })

  it('rejects invalid locale', async () => {
    const result = await savePostContent(VALID_UUID, 'x', { title: 'Hello' })
    expect(result).toEqual({ ok: false, error: 'Locale inválido' })
  })

  it('rejects invalid content data', async () => {
    const result = await savePostContent(VALID_UUID, 'pt-BR', {
      // slug must match /^[a-z0-9]+(?:-[a-z0-9]+)*$/
      slug: 'INVALID SLUG WITH SPACES',
    })
    expect(result).toEqual({ ok: false, error: 'Dados inválidos' })
  })

  it('returns not found when post does not belong to site', async () => {
    // blog_posts.select returns null (not found)
    const selectPostChain = makeSelectChain({ data: null, error: null })
    buildFromMock({ blog_posts: { select: selectPostChain } })

    const result = await savePostContent(VALID_UUID, 'pt-BR', { title: 'Hello' })
    expect(result).toEqual({ ok: false, error: 'Post não encontrado' })
  })

  it('saves content and revalidates on success', async () => {
    const updateTranslationChain = makeChain({ data: null, error: null })
    const updateMockFn = vi.fn().mockReturnValue(updateTranslationChain)

    buildFromMock({
      blog_posts: { select: makeSelectChain({ data: { id: VALID_UUID }, error: null }) },
      blog_translations: { update: updateMockFn },
    })

    const result = await savePostContent(VALID_UUID, 'pt-BR', {
      title: 'Hello',
      slug: 'hello',
      excerpt: 'An excerpt',
      contentMdx: '# Hello',
    })

    expect(result).toEqual({ ok: true })
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/cms/posts/${VALID_UUID}`)
  })

  it('returns DB error message on update failure', async () => {
    const updateTranslationChain = makeChain({ data: null, error: { message: 'db error' } })
    const updateMockFn = vi.fn().mockReturnValue(updateTranslationChain)

    buildFromMock({
      blog_posts: { select: makeSelectChain({ data: { id: VALID_UUID }, error: null }) },
      blog_translations: { update: updateMockFn },
    })

    const result = await savePostContent(VALID_UUID, 'pt-BR', { title: 'Hello' })
    expect(result).toEqual({ ok: false, error: 'Erro ao salvar conteúdo' })
  })

  it('returns ok immediately for empty data without hitting blog_translations', async () => {
    const updateTranslationFn = vi.fn()
    buildFromMock({
      blog_posts: { select: makeSelectChain({ data: { id: VALID_UUID }, error: null }) },
      blog_translations: { update: updateTranslationFn },
    })

    // Empty patch — no fields to update
    const result = await savePostContent(VALID_UUID, 'pt-BR', {})
    expect(result).toEqual({ ok: true })
    // The empty-patch guard short-circuits before touching blog_translations
    expect(updateTranslationFn).not.toHaveBeenCalled()
  })

  it('returns error on auth failure (forbidden)', async () => {
    vi.mocked(requireSiteScope).mockResolvedValueOnce({ ok: false, reason: 'forbidden' } as never)
    await expect(
      savePostContent(VALID_UUID, 'pt-BR', { title: 'Hello' }),
    ).rejects.toThrow(/forbidden/)
  })

  it('returns error on auth failure (unauthenticated)', async () => {
    vi.mocked(requireSiteScope).mockResolvedValueOnce({ ok: false, reason: 'unauthenticated' } as never)
    await expect(
      savePostContent(VALID_UUID, 'pt-BR', { title: 'Hello' }),
    ).rejects.toThrow(/unauthenticated/)
  })
})

// ── savePostSeo ───────────────────────────────────────────────────────

describe('savePostSeo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } } as never)
  })

  it('rejects invalid UUID', async () => {
    const result = await savePostSeo('not-a-uuid', 'pt-BR', { metaTitle: 'Title' })
    expect(result).toEqual({ ok: false, error: 'ID inválido' })
  })

  it('rejects invalid locale', async () => {
    const result = await savePostSeo(VALID_UUID, 'x', { metaTitle: 'Title' })
    expect(result).toEqual({ ok: false, error: 'Locale inválido' })
  })

  it('rejects invalid SEO data (bad ogImageUrl)', async () => {
    const result = await savePostSeo(VALID_UUID, 'pt-BR', {
      ogImageUrl: 'not-a-url',
    })
    expect(result).toEqual({ ok: false, error: 'Dados inválidos' })
  })

  it('returns not found when post does not belong to site', async () => {
    buildFromMock({
      blog_posts: { select: makeSelectChain({ data: null, error: null }) },
    })

    const result = await savePostSeo(VALID_UUID, 'pt-BR', { metaTitle: 'My Title' })
    expect(result).toEqual({ ok: false, error: 'Post não encontrado' })
  })

  it('saves SEO fields and revalidates', async () => {
    // First select: blog_posts ownership check
    // Second select: blog_translations slug lookup
    let selectCallCount = 0
    const selectFn = vi.fn().mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        return makeSelectChain({ data: { id: VALID_UUID }, error: null })()
      }
      return makeSelectChain({ data: { slug: 'my-post' }, error: null })()
    })

    const updateChain = makeChain({ data: null, error: null })
    const updateFn = vi.fn().mockReturnValue(updateChain)

    buildFromMock({
      blog_posts: { select: selectFn },
      blog_translations: {
        update: updateFn,
        select: selectFn,
      },
    })

    const result = await savePostSeo(VALID_UUID, 'pt-BR', {
      metaTitle: 'My Title',
      metaDescription: 'My description',
    })

    expect(result).toEqual({ ok: true })
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/cms/posts/${VALID_UUID}`)
    expect(revalidateBlogPostSeoMock).toHaveBeenCalled()
  })
})

// ── savePostSocialConfig ──────────────────────────────────────────────

describe('savePostSocialConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } } as never)
  })

  it('rejects invalid UUID', async () => {
    const config = {
      enabled: true,
      platforms: ['bluesky' as const],
      captions: {},
      hashtags: [],
      image_source: 'cover_image' as const,
      ig_template: 'card' as const,
      formats: {},
    }
    const result = await savePostSocialConfig('not-a-uuid', config)
    expect(result).toEqual({ ok: false, error: 'ID inválido' })
  })

  it('rejects invalid config shape (missing required fields)', async () => {
    const result = await savePostSocialConfig(VALID_UUID, {
      // missing required "enabled" and "platforms"
    } as never)
    expect(result).toEqual({ ok: false, error: 'Configuração inválida' })
  })

  it('rejects invalid platform value', async () => {
    const result = await savePostSocialConfig(VALID_UUID, {
      enabled: true,
      platforms: ['twitter' as never], // not a valid platform
      captions: {},
      hashtags: [],
      image_source: 'cover_image' as const,
      ig_template: 'card' as const,
      formats: {},
    })
    expect(result).toEqual({ ok: false, error: 'Configuração inválida' })
  })

  it('saves valid config and revalidates', async () => {
    const updateChain = makeChain({ data: null, error: null })
    buildFromMock({
      blog_posts: { update: vi.fn().mockReturnValue(updateChain) },
    })

    const result = await savePostSocialConfig(VALID_UUID, {
      enabled: true,
      platforms: ['bluesky', 'instagram'],
      captions: {},
      hashtags: ['#test'],
      image_source: 'cover_image',
      ig_template: 'card',
      formats: {},
    })

    expect(result).toEqual({ ok: true })
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/cms/posts/${VALID_UUID}`)
  })

  it('returns error on DB failure', async () => {
    const updateChain = makeChain({ data: null, error: { message: 'db-error' } })
    buildFromMock({
      blog_posts: { update: vi.fn().mockReturnValue(updateChain) },
    })

    const result = await savePostSocialConfig(VALID_UUID, {
      enabled: false,
      platforms: [],
      captions: {},
      hashtags: [],
      image_source: 'og_image',
      ig_template: 'card',
      formats: {},
    })

    expect(result).toEqual({ ok: false, error: 'Erro ao salvar' })
  })

  it('rejects invalid image_source enum value', async () => {
    const result = await savePostSocialConfig(VALID_UUID, {
      enabled: true,
      platforms: ['bluesky'],
      captions: {},
      hashtags: [],
      image_source: 'invalid_value' as never,
      ig_template: 'card',
      formats: {},
    })
    expect(result).toEqual({ ok: false, error: 'Configuração inválida' })
  })
})

// ── savePostPublishSettings ───────────────────────────────────────────

describe('savePostPublishSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } } as never)
  })

  it('rejects invalid UUID', async () => {
    const result = await savePostPublishSettings('not-a-uuid', { rssIncluded: true })
    expect(result).toEqual({ ok: false, error: 'ID inválido' })
  })

  it('rejects invalid data (bad canonicalUrl)', async () => {
    const result = await savePostPublishSettings(VALID_UUID, {
      canonicalUrl: 'not-a-url',
    })
    expect(result).toEqual({ ok: false, error: 'Dados inválidos' })
  })

  it('saves publish settings and revalidates', async () => {
    const updateChain = makeChain({ data: null, error: null })
    buildFromMock({
      blog_posts: { update: vi.fn().mockReturnValue(updateChain) },
    })

    const result = await savePostPublishSettings(VALID_UUID, {
      includeInNewsletter: true,
      rssIncluded: false,
      searchIndexable: true,
      canonicalUrl: 'https://example.com/canonical',
    })

    expect(result).toEqual({ ok: true })
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/cms/posts/${VALID_UUID}`)
  })

  it('returns error when update fails', async () => {
    const updateChain = makeChain({ data: null, error: { message: 'db-fail' } })
    buildFromMock({
      blog_posts: { update: vi.fn().mockReturnValue(updateChain) },
    })

    const result = await savePostPublishSettings(VALID_UUID, { rssIncluded: true })
    expect(result).toEqual({ ok: false, error: 'Erro ao salvar' })
  })
})

// ── savePostCoverImage ────────────────────────────────────────────────

describe('savePostCoverImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } } as never)
  })

  it('rejects invalid UUID', async () => {
    const result = await savePostCoverImage('not-a-uuid', 'https://example.com/img.jpg')
    expect(result).toEqual({ ok: false, error: 'ID inválido' })
  })

  it('saves cover image URL', async () => {
    const updateChain = makeChain({ data: null, error: null })
    buildFromMock({
      blog_posts: { update: vi.fn().mockReturnValue(updateChain) },
    })

    const result = await savePostCoverImage(VALID_UUID, 'https://example.com/img.jpg')
    expect(result).toEqual({ ok: true })
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/cms/posts/${VALID_UUID}`)
  })

  it('removes cover image when null is passed', async () => {
    const updateFn = vi.fn().mockReturnValue(makeChain({ data: null, error: null }))
    buildFromMock({
      blog_posts: { update: updateFn },
    })

    const result = await savePostCoverImage(VALID_UUID, null)
    expect(result).toEqual({ ok: true })
    // Ensure null was passed as cover_image_url
    const updateCall = updateFn.mock.calls[0]
    expect(updateCall[0]).toEqual({ cover_image_url: null })
  })

  it('returns error when update fails', async () => {
    const updateChain = makeChain({ data: null, error: { message: 'storage-error' } })
    buildFromMock({
      blog_posts: { update: vi.fn().mockReturnValue(updateChain) },
    })

    const result = await savePostCoverImage(VALID_UUID, 'https://example.com/img.jpg')
    expect(result).toEqual({ ok: false, error: 'Erro ao salvar' })
  })
})

// ── schedulePost ──────────────────────────────────────────────────────

describe('schedulePost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } } as never)
  })

  it('rejects invalid UUID', async () => {
    const result = await schedulePost('not-a-uuid', '2026-06-01T10:00:00.000Z')
    expect(result).toEqual({ ok: false, error: 'ID inválido' })
  })

  it('rejects invalid ISO date string', async () => {
    const result = await schedulePost(VALID_UUID, 'not-a-date')
    expect(result).toEqual({ ok: false, error: 'Data inválida' })
  })

  it('rejects date without timezone (not a valid datetime)', async () => {
    const result = await schedulePost(VALID_UUID, '2026-06-01')
    expect(result).toEqual({ ok: false, error: 'Data inválida' })
  })

  it('returns not found when post does not exist for this site', async () => {
    buildFromMock({
      blog_posts: {
        select: makeSelectChain({ data: null, error: { message: 'not found' } }),
      },
    })

    const result = await schedulePost(VALID_UUID, '2026-06-01T10:00:00.000Z')
    expect(result).toEqual({ ok: false, error: 'Post not found' })
  })

  it('rejects scheduling an already published post', async () => {
    buildFromMock({
      blog_posts: {
        select: makeSelectChain({
          data: { id: VALID_UUID, status: 'published', social_config: null },
          error: null,
        }),
      },
    })

    const result = await schedulePost(VALID_UUID, '2026-06-01T10:00:00.000Z')
    expect(result).toEqual({ ok: false, error: 'Post already published' })
  })

  it('schedules post with valid date and triggers pipeline sync', async () => {
    const updateChain = makeChain({ data: null, error: null })
    const updateFn = vi.fn().mockReturnValue(updateChain)

    let selectCallCount = 0
    const selectFn = vi.fn().mockImplementation(() => {
      selectCallCount++
      return makeSelectChain({
        data: { id: VALID_UUID, status: 'draft', social_config: null },
        error: null,
      })()
    })

    buildFromMock({
      blog_posts: { select: selectFn, update: updateFn },
    })

    const result = await schedulePost(VALID_UUID, '2026-06-01T10:00:00.000Z')
    expect(result).toEqual({ ok: true })
    expect(syncPipelineMock).toHaveBeenCalledWith(VALID_UUID, 'scheduled', 'draft')
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/cms/posts')
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/cms/posts/${VALID_UUID}`)
  })

  it('returns error when update fails', async () => {
    const updateChain = makeChain({ data: null, error: { message: 'schedule-err' } })
    const updateFn = vi.fn().mockReturnValue(updateChain)

    buildFromMock({
      blog_posts: {
        select: makeSelectChain({ data: { id: VALID_UUID, status: 'draft', social_config: null }, error: null }),
        update: updateFn,
      },
    })

    const result = await schedulePost(VALID_UUID, '2026-06-01T10:00:00.000Z')
    expect(result).toEqual({ ok: false, error: 'Erro ao agendar' })
  })
})

// ── publishPost ───────────────────────────────────────────────────────

describe('publishPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } } as never)
  })

  it('rejects invalid UUID', async () => {
    const result = await publishPost('not-a-uuid')
    expect(result).toEqual({ ok: false, error: 'ID inválido' })
  })

  it('returns not found when post does not exist', async () => {
    buildFromMock({
      blog_posts: {
        select: makeSelectChain({ data: null, error: { message: 'not-found' } }),
      },
    })

    const result = await publishPost(VALID_UUID)
    expect(result).toEqual({ ok: false, error: 'Post not found' })
  })

  it('returns error when post is already published', async () => {
    buildFromMock({
      blog_posts: {
        select: makeSelectChain({
          data: {
            id: VALID_UUID,
            status: 'published',
            social_config: null,
            blog_translations: [],
          },
          error: null,
        }),
      },
    })

    const result = await publishPost(VALID_UUID)
    expect(result).toEqual({ ok: false, error: 'Post already published' })
  })

  it('publishes post, revalidates SEO, and triggers pipeline sync', async () => {
    const updateChain = makeChain({ data: null, error: null })
    const updateFn = vi.fn().mockReturnValue(updateChain)

    buildFromMock({
      blog_posts: {
        select: makeSelectChain({
          data: {
            id: VALID_UUID,
            status: 'draft',
            social_config: null,
            blog_translations: [
              { locale: 'pt-BR', slug: 'meu-post' },
              { locale: 'en', slug: 'my-post' },
            ],
          },
          error: null,
        }),
        update: updateFn,
      },
    })

    const result = await publishPost(VALID_UUID)
    expect(result).toEqual({ ok: true })
    expect(revalidateBlogPostSeoMock).toHaveBeenCalledWith(SITE_ID, VALID_UUID, 'pt-BR', 'meu-post')
    expect(revalidateBlogPostSeoMock).toHaveBeenCalledWith(SITE_ID, VALID_UUID, 'en', 'my-post')
    expect(syncPipelineMock).toHaveBeenCalledWith(VALID_UUID, 'published', 'draft')
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/cms/posts')
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/cms/posts/${VALID_UUID}`)
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/cms/blog')
  })

  it('returns error on auth failure', async () => {
    vi.mocked(requireSiteScope).mockResolvedValueOnce({ ok: false, reason: 'forbidden' } as never)
    await expect(publishPost(VALID_UUID)).rejects.toThrow(/forbidden/)
  })

  it('returns error when update fails', async () => {
    const updateChain = makeChain({ data: null, error: { message: 'publish-err' } })
    const updateFn = vi.fn().mockReturnValue(updateChain)

    buildFromMock({
      blog_posts: {
        select: makeSelectChain({
          data: { id: VALID_UUID, status: 'draft', social_config: null, blog_translations: [] },
          error: null,
        }),
        update: updateFn,
      },
    })

    const result = await publishPost(VALID_UUID)
    expect(result).toEqual({ ok: false, error: 'Erro ao publicar' })
  })

  it('triggers social post creation when social_config is enabled', async () => {
    const updateChain = makeChain({ data: null, error: null })
    const updateFn = vi.fn().mockReturnValue(updateChain)

    buildFromMock({
      blog_posts: {
        select: makeSelectChain({
          data: {
            id: VALID_UUID,
            status: 'draft',
            social_config: {
              enabled: true,
              platforms: ['bluesky'],
              captions: {},
              hashtags: [],
              image_source: 'cover_image',
              ig_template: 'card',
              formats: {},
            },
            blog_translations: [],
          },
          error: null,
        }),
        update: updateFn,
      },
    })

    const result = await publishPost(VALID_UUID)
    expect(result).toEqual({ ok: true })

    // The dynamic import + createSocialPostFromContent call is fire-and-forget.
    // Wait for the microtask queue to drain so the .then() callback has run.
    await vi.waitFor(() => {
      expect(vi.mocked(createSocialPostFromContent)).toHaveBeenCalledOnce()
    })
    expect(vi.mocked(createSocialPostFromContent)).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId: SITE_ID,
        contentType: 'blog',
        contentId: VALID_UUID,
        origin: 'auto',
      }),
    )
  })
})

// ── returnToPipeline ──────────────────────────────────────────────────

describe('returnToPipeline', () => {
  const PIPELINE_ID = '00000000-0000-0000-0000-000000000002'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } } as never)
  })

  it('rejects invalid UUID', async () => {
    const result = await returnToPipeline('not-a-uuid')
    expect(result).toEqual({ ok: false, error: 'ID inválido' })
  })

  it('returns error when no linked pipeline item exists', async () => {
    buildFromMock({
      content_pipeline: {
        select: makeSelectChain({ data: null, error: null }),
      },
    })

    const result = await returnToPipeline(VALID_UUID)
    expect(result).toEqual({ ok: false, error: 'No linked pipeline item found' })
  })

  it('archives post and restores pipeline item, then records history', async () => {
    const pipelineItem = { id: PIPELINE_ID, stage: 'published', version: 3 }

    const archiveChain = makeChain({ data: null, error: null })
    const archiveFn = vi.fn().mockReturnValue(archiveChain)

    const pipelineUpdateChain = makeChain({ data: null, error: null })
    const pipelineUpdateFn = vi.fn().mockReturnValue(pipelineUpdateChain)

    const historyInsertChain = makeChain({ data: null, error: null })
    const historyInsertFn = vi.fn().mockReturnValue(historyInsertChain)

    buildFromMock({
      content_pipeline: {
        select: makeSelectChain({ data: pipelineItem, error: null }),
        update: pipelineUpdateFn,
      },
      blog_posts: { update: archiveFn },
      content_pipeline_history: { insert: historyInsertFn },
    })

    const result = await returnToPipeline(VALID_UUID)

    expect(result).toEqual({ ok: true, data: { pipelineItemId: PIPELINE_ID } })
    // blog post was archived
    expect(archiveFn).toHaveBeenCalledWith({ status: 'archived' })
    // pipeline item was restored to draft with version bump
    expect(pipelineUpdateFn).toHaveBeenCalledWith({
      blog_post_id: null,
      social_config: null,
      stage: 'draft',
      version: 4,
    })
    // history entry was inserted
    expect(historyInsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        pipeline_id: PIPELINE_ID,
        event_type: 'returned_from_post',
        from_value: `post:${VALID_UUID}`,
        to_value: 'draft',
      }),
    )
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/cms/posts')
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/cms/pipeline')
  })

  it('returns error if archive blog_post update fails (before pipeline restore)', async () => {
    const pipelineItem = { id: PIPELINE_ID, stage: 'published', version: 1 }
    const archiveChain = makeChain({ data: null, error: { message: 'archive-fail' } })
    const archiveFn = vi.fn().mockReturnValue(archiveChain)

    buildFromMock({
      content_pipeline: {
        select: makeSelectChain({ data: pipelineItem, error: null }),
      },
      blog_posts: { update: archiveFn },
    })

    const result = await returnToPipeline(VALID_UUID)
    expect(result).toEqual({ ok: false, error: 'Erro ao retornar ao pipeline' })
  })

  it('returns error (compensates) if pipeline restore fails after archive', async () => {
    const pipelineItem = { id: PIPELINE_ID, stage: 'published', version: 1 }
    const archiveChain = makeChain({ data: null, error: null })
    const archiveFn = vi.fn().mockReturnValue(archiveChain)

    const pipelineUpdateChain = makeChain({ data: null, error: { message: 'pipeline-fail' } })
    const pipelineUpdateFn = vi.fn().mockReturnValue(pipelineUpdateChain)

    buildFromMock({
      content_pipeline: {
        select: makeSelectChain({ data: pipelineItem, error: null }),
        update: pipelineUpdateFn,
      },
      blog_posts: { update: archiveFn },
    })

    const result = await returnToPipeline(VALID_UUID)
    expect(result).toEqual({ ok: false, error: 'Erro ao retornar ao pipeline' })

    // Verify compensation: blog_posts.update was called twice —
    // first to archive (status: 'archived'), then to revert (status: 'draft').
    expect(archiveFn).toHaveBeenCalledTimes(2)
    expect(archiveFn).toHaveBeenNthCalledWith(1, { status: 'archived' })
    expect(archiveFn).toHaveBeenNthCalledWith(2, { status: 'draft' })
  })

  it('returns error on auth failure', async () => {
    vi.mocked(requireSiteScope).mockResolvedValueOnce({ ok: false, reason: 'forbidden' } as never)
    await expect(returnToPipeline(VALID_UUID)).rejects.toThrow(/forbidden/)
  })
})

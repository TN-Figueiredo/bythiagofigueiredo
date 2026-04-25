import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as authGuards from '../../lib/cms/auth-guards'

vi.mock('../../lib/cms/auth-guards', () => ({
  requireSiteAdminForRow: vi.fn().mockResolvedValue({ siteId: 's1' }),
}))

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
}))

const getByIdMock = vi.fn().mockResolvedValue({
  id: 'p1',
  site_id: 's1',
  status: 'draft',
  translations: [{ locale: 'pt-BR', slug: 'hello' }],
})
const updateMock = vi.fn().mockResolvedValue({
  id: 'p1',
  site_id: 's1',
  translations: [{ locale: 'pt-BR', slug: 'hello' }],
})
const publishMock = vi.fn().mockResolvedValue({
  id: 'p1',
  site_id: 's1',
  translations: [{ locale: 'pt-BR', slug: 'hello' }],
})
const unpublishMock = vi.fn().mockResolvedValue({
  id: 'p1',
  site_id: 's1',
  translations: [{ locale: 'pt-BR', slug: 'hello' }],
})
const archiveMock = vi.fn().mockResolvedValue({
  id: 'p1',
  site_id: 's1',
  translations: [{ locale: 'pt-BR', slug: 'hello' }],
})
const deleteMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../../lib/cms/repositories', () => ({
  postRepo: () => ({
    getById: getByIdMock,
    update: updateMock,
    publish: publishMock,
    unpublish: unpublishMock,
    archive: archiveMock,
    delete: deleteMock,
  }),
}))

vi.mock('../../lib/cms/registry', () => ({ blogRegistry: {} }))

vi.mock('@tn-figueiredo/cms', async () => {
  const actual = await vi.importActual<object>('@tn-figueiredo/cms')
  return {
    ...actual,
    compileMdx: vi.fn().mockResolvedValue({ compiledSource: 'src', toc: [], readingTimeMin: 1 }),
  }
})

// SEO cache-invalidation helpers (introduced in PR-B). The action layer now
// calls these instead of raw `revalidatePath` per Sprint 5b PR-C plan.
const { revalidateBlogPostSeoMock } = vi.hoisted(() => ({
  revalidateBlogPostSeoMock: vi.fn(),
}))
vi.mock('@/lib/seo/cache-invalidation', () => ({
  revalidateBlogPostSeo: revalidateBlogPostSeoMock,
  revalidateCampaignSeo: vi.fn(),
  revalidateSiteBranding: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

// Service-client mock used for the seo_extras workaround (the cms package's
// UpdatePostInput.translation type doesn't include seo_extras, so the action
// applies it via a direct supabase update on blog_translations).
const { seoExtrasUpdateEqMock, seoExtrasUpdateBuilder, seoExtrasUpdateMock, fromMock } = vi.hoisted(() => {
  const seoExtrasUpdateEqMock = vi.fn().mockResolvedValue({ data: null, error: null })
  const seoExtrasUpdateBuilder = {
    eq: vi.fn(() => ({ eq: seoExtrasUpdateEqMock })),
  }
  const seoExtrasUpdateMock = vi.fn(() => seoExtrasUpdateBuilder)
  const fromMock = vi.fn(() => ({ update: seoExtrasUpdateMock }))
  return { seoExtrasUpdateEqMock, seoExtrasUpdateBuilder, seoExtrasUpdateMock, fromMock }
})
vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: fromMock }),
}))

import {
  savePost,
  publishPost,
  unpublishPost,
  archivePost,
  deletePost,
} from '../../src/app/cms/(authed)/blog/[id]/edit/actions'

describe('savePost', () => {
  beforeEach(() => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockResolvedValue({ siteId: 's1' })
    revalidateBlogPostSeoMock.mockClear()
    updateMock.mockClear()
    seoExtrasUpdateMock.mockClear()
    seoExtrasUpdateBuilder.eq.mockClear()
    seoExtrasUpdateEqMock.mockClear()
    fromMock.mockClear()
  })

  it('returns ok for valid input', async () => {
    const result = await savePost('p1', 'pt-BR', {
      content_mdx: '# Hello',
      title: 'Hello',
      slug: 'hello',
    })
    expect(result.ok).toBe(true)
  })

  it('returns validation error for empty title', async () => {
    const result = await savePost('p1', 'pt-BR', { content_mdx: '', title: '', slug: 'x' })
    expect(result.ok).toBe(false)
    if (!result.ok && result.error === 'validation_failed') {
      expect(result.fields.title).toBeTruthy()
    }
  })

  it('returns validation error for empty slug', async () => {
    const result = await savePost('p1', 'pt-BR', { content_mdx: '', title: 'Ok', slug: '' })
    expect(result.ok).toBe(false)
    if (!result.ok && result.error === 'validation_failed') {
      expect(result.fields.slug).toBeTruthy()
    }
  })

  it('calls revalidateBlogPostSeo with site/post/locale/slug', async () => {
    await savePost('p1', 'pt-BR', {
      content_mdx: '# Hi',
      title: 'Hello',
      slug: 'hello',
    })
    expect(revalidateBlogPostSeoMock).toHaveBeenCalledWith('s1', 'p1', 'pt-BR', 'hello')
  })
})

describe('savePost frontmatter parsing', () => {
  beforeEach(() => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockResolvedValue({ siteId: 's1' })
    updateMock.mockClear()
    seoExtrasUpdateMock.mockClear()
    seoExtrasUpdateBuilder.eq.mockClear()
    seoExtrasUpdateEqMock.mockClear()
    fromMock.mockClear()
  })

  it('strips frontmatter from content_mdx and persists seo_extras', async () => {
    const mdx = `---\nseo_extras:\n  faq:\n    - q: "Q1?"\n      a: "A1."\n---\n# Body`
    const result = await savePost('p1', 'pt-BR', {
      content_mdx: mdx,
      title: 'T',
      slug: 'frontmatter-post',
    })
    expect(result.ok).toBe(true)
    // The cms-package update receives the stripped content (no `---`).
    const updateCall = updateMock.mock.calls[0]
    expect(updateCall).toBeDefined()
    const patch = updateCall![1] as { translation?: { content_mdx?: string } }
    expect(patch.translation?.content_mdx).toBeDefined()
    expect(patch.translation!.content_mdx).not.toMatch(/^---/)
    expect(patch.translation!.content_mdx).toContain('# Body')
    // seo_extras workaround: direct supabase update on blog_translations.
    expect(fromMock).toHaveBeenCalledWith('blog_translations')
    expect(seoExtrasUpdateMock).toHaveBeenCalledWith({
      seo_extras: { faq: [{ q: 'Q1?', a: 'A1.' }] },
    })
  })

  it('returns invalid_seo_extras error shape for malformed frontmatter', async () => {
    const mdx = `---\nseo_extras:\n  faq:\n    - q: ""\n      a: "x"\n---\n# Body`
    const result = await savePost('p1', 'pt-BR', {
      content_mdx: mdx,
      title: 'T',
      slug: 's',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('invalid_seo_extras')
    }
    // No DB write should happen on validation failure.
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('leaves seo_extras null and content unchanged when no frontmatter', async () => {
    const mdx = '# Plain body, no frontmatter'
    const result = await savePost('p1', 'pt-BR', {
      content_mdx: mdx,
      title: 'T',
      slug: 's',
    })
    expect(result.ok).toBe(true)
    const updateCall = updateMock.mock.calls[0]
    expect(updateCall).toBeDefined()
    const patch = updateCall![1] as { translation?: { content_mdx?: string } }
    expect(patch.translation!.content_mdx).toBe(mdx)
    // blog_posts.locale update fires, but no seo_extras update on blog_translations.
    expect(fromMock).toHaveBeenCalledWith('blog_posts')
    expect(fromMock).not.toHaveBeenCalledWith('blog_translations')
  })
})

describe('publishPost', () => {
  beforeEach(() => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockResolvedValue({ siteId: 's1' })
    revalidateBlogPostSeoMock.mockClear()
  })

  it('calls postRepo.publish + revalidates each translation via SEO helper', async () => {
    publishMock.mockResolvedValueOnce({
      id: 'p1',
      site_id: 's1',
      translations: [
        { locale: 'pt-BR', slug: 'hello' },
        { locale: 'en', slug: 'hello-en' },
      ],
    })
    await publishPost('p1')
    expect(revalidateBlogPostSeoMock).toHaveBeenCalledWith('s1', 'p1', 'pt-BR', 'hello')
    expect(revalidateBlogPostSeoMock).toHaveBeenCalledWith('s1', 'p1', 'en', 'hello-en')
  })
})

describe('unpublishPost', () => {
  beforeEach(() => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockResolvedValue({ siteId: 's1' })
    revalidateBlogPostSeoMock.mockClear()
  })

  it('revalidates per translation via SEO helper', async () => {
    await unpublishPost('p1')
    expect(revalidateBlogPostSeoMock).toHaveBeenCalledWith('s1', 'p1', 'pt-BR', 'hello')
  })
})

// Regression test for Sprint 5b PR-C bug fix: archivePost previously only
// revalidated the index `/blog/${locale}` page, missing the slug page. The
// new helper call ensures the slug page is also re-rendered after archiving.
describe('archivePost slug-page regression', () => {
  beforeEach(() => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockResolvedValue({ siteId: 's1' })
    revalidateBlogPostSeoMock.mockClear()
  })

  it('revalidates BOTH the index and the slug page (was: index only)', async () => {
    archiveMock.mockResolvedValueOnce({
      id: 'p1',
      site_id: 's1',
      translations: [{ locale: 'pt-BR', slug: 'hello' }],
    })
    await archivePost('p1')
    // The helper covers /blog/pt-BR + /blog/pt-BR/hello + tag invalidations.
    expect(revalidateBlogPostSeoMock).toHaveBeenCalledWith('s1', 'p1', 'pt-BR', 'hello')
  })
})

describe('savePost URL-encodes slug when calling SEO helper', () => {
  beforeEach(() => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockResolvedValue({ siteId: 's1' })
    revalidateBlogPostSeoMock.mockClear()
  })

  it('passes the raw slug through (helper handles encoding internally)', async () => {
    await savePost('p1', 'pt-BR', {
      content_mdx: '# Hi',
      title: 'Olá',
      slug: 'ação-e-reação',
    })
    expect(revalidateBlogPostSeoMock).toHaveBeenCalledWith(
      's1',
      'p1',
      'pt-BR',
      'ação-e-reação',
    )
  })
})

describe('deletePost discriminated result', () => {
  beforeEach(() => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockResolvedValue({ siteId: 's1' })
    getByIdMock.mockReset()
    deleteMock.mockReset()
    deleteMock.mockResolvedValue(undefined)
    revalidateBlogPostSeoMock.mockClear()
  })

  it('returns ok:true when post is draft and delete succeeds', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 'p1',
      site_id: 's1',
      status: 'draft',
      translations: [{ locale: 'pt-BR', slug: 'hi' }],
    })
    const result = await deletePost('p1')
    expect(result).toEqual({ ok: true })
    expect(deleteMock).toHaveBeenCalledWith('p1')
    expect(revalidateBlogPostSeoMock).toHaveBeenCalledWith('s1', 'p1', 'pt-BR', 'hi')
  })

  it('returns not_found when repo returns null (stale id)', async () => {
    getByIdMock.mockResolvedValueOnce(null)
    const result = await deletePost('gone')
    expect(result).toEqual({ ok: false, error: 'not_found' })
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('returns already_published when status transitioned to published between list render and click', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 'p1',
      site_id: 's1',
      status: 'published',
      translations: [{ locale: 'pt-BR', slug: 'hi' }],
    })
    const result = await deletePost('p1')
    expect(result).toEqual({ ok: false, error: 'already_published' })
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('returns db_error when the delete call throws', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 'p1',
      site_id: 's1',
      status: 'draft',
      translations: [{ locale: 'pt-BR', slug: 'hi' }],
    })
    deleteMock.mockRejectedValueOnce(new Error('boom'))
    const result = await deletePost('p1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('db_error')
      expect(result.message).toBe('boom')
    }
  })
})

describe('authorization', () => {
  it('savePost throws when requireSiteAdminForRow throws forbidden', async () => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockRejectedValueOnce(new Error('forbidden'))
    await expect(
      savePost('p1', 'pt-BR', { content_mdx: '', title: 'T', slug: 's' }),
    ).rejects.toThrow(/forbidden/)
  })

  it('publishPost throws when requireSiteAdminForRow throws forbidden', async () => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockRejectedValueOnce(new Error('forbidden'))
    await expect(publishPost('p1')).rejects.toThrow(/forbidden/)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

const eqMock2 = vi.fn(() => ({ error: null }))
const eqMock = vi.fn(() => ({ eq: eqMock2, error: null }))
const updateMock = vi.fn(() => ({ eq: eqMock }))
const fromMock = vi.fn(() => ({ update: updateMock }))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: fromMock }),
}))

vi.mock('@/lib/cms/auth-guards', () => ({
  requireSiteAdminForRow: vi.fn().mockResolvedValue({ siteId: 's1' }),
}))

const revalidateBlogPostSeoMock = vi.fn()
vi.mock('@/lib/seo/cache-invalidation', () => ({
  revalidateBlogPostSeo: (...args: unknown[]) => revalidateBlogPostSeoMock(...args),
}))

const revalidateTagMock = vi.fn()
vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
  revalidatePath: vi.fn(),
}))

/* ------------------------------------------------------------------ */
/*  Import under test (after mocks)                                   */
/* ------------------------------------------------------------------ */

import { savePostField } from '@/app/cms/(authed)/blog/[id]/edit/actions'

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('savePostField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset chainable mocks to default success
    eqMock2.mockReturnValue({ error: null })
    eqMock.mockReturnValue({ eq: eqMock2, error: null })
    updateMock.mockReturnValue({ eq: eqMock })
    fromMock.mockReturnValue({ update: updateMock })
  })

  it('returns ok:true for valid post-level field (tag_id)', async () => {
    const result = await savePostField('p1', 'pt', 'tag_id', 'tag-abc')

    expect(result).toEqual({ ok: true })
    expect(fromMock).toHaveBeenCalledWith('blog_posts')
    expect(updateMock).toHaveBeenCalledWith({ tag_id: 'tag-abc' })
    expect(eqMock).toHaveBeenCalledWith('id', 'p1')
  })

  it('returns ok:true for valid translation-level field (slug)', async () => {
    const result = await savePostField('p1', 'pt', 'slug', 'new-slug')

    expect(result).toEqual({ ok: true })
    expect(fromMock).toHaveBeenCalledWith('blog_translations')
    expect(updateMock).toHaveBeenCalledWith({ slug: 'new-slug' })
    expect(eqMock).toHaveBeenCalledWith('post_id', 'p1')
    expect(eqMock2).toHaveBeenCalledWith('locale', 'pt')
  })

  it('returns ok:false with invalid_field for unknown field', async () => {
    const result = await savePostField('p1', 'pt', 'hacker_field', 'x')

    expect(result).toEqual({ ok: false, error: 'invalid_field' })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('calls revalidateBlogPostSeo when updating slug', async () => {
    await savePostField('p1', 'pt', 'slug', 'my-new-slug')

    expect(revalidateBlogPostSeoMock).toHaveBeenCalledWith('s1', 'p1', 'pt', 'my-new-slug')
    expect(revalidateTagMock).toHaveBeenCalledWith('blog-hub')
  })

  it('does NOT call revalidation when updating tag_id', async () => {
    await savePostField('p1', 'pt', 'tag_id', 'tag-xyz')

    expect(revalidateBlogPostSeoMock).not.toHaveBeenCalled()
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })

  it('calls revalidation for other SEO fields (meta_title)', async () => {
    await savePostField('p1', 'en', 'meta_title', 'New Title')

    expect(revalidateBlogPostSeoMock).toHaveBeenCalledWith('s1', 'p1', 'en', '')
    expect(revalidateTagMock).toHaveBeenCalledWith('blog-hub')
  })

  it('returns ok:false with unauthorized when auth guard throws', async () => {
    const { requireSiteAdminForRow } = await import('@/lib/cms/auth-guards')
    vi.mocked(requireSiteAdminForRow).mockRejectedValueOnce(new Error('forbidden'))

    const result = await savePostField('p1', 'pt', 'tag_id', 'x')

    expect(result).toEqual({ ok: false, error: 'unauthorized' })
  })

  it('returns ok:false with db_error when supabase update fails', async () => {
    eqMock.mockReturnValueOnce({ eq: eqMock2, error: { message: 'something broke' } })

    const result = await savePostField('p1', 'pt', 'tag_id', 'x')

    expect(result).toEqual({ ok: false, error: 'db_error' })
  })
})

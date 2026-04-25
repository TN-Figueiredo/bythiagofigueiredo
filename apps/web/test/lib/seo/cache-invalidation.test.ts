import { describe, it, expect, vi, beforeEach } from 'vitest'

const revalidateTag = vi.fn()
const revalidatePath = vi.fn()

vi.mock('next/cache', () => ({ revalidateTag, revalidatePath }))

describe('cache-invalidation helpers', () => {
  beforeEach(() => {
    revalidateTag.mockClear()
    revalidatePath.mockClear()
  })

  it('revalidateBlogPostSeo invalidates post/og/sitemap tags + 2 paths', async () => {
    const { revalidateBlogPostSeo } = await import('@/lib/seo/cache-invalidation')
    revalidateBlogPostSeo('site-1', 'post-123', 'pt-BR', 'my-post')
    expect(revalidateTag).toHaveBeenCalledWith('blog:post:post-123')
    expect(revalidateTag).toHaveBeenCalledWith('og:blog:post-123')
    expect(revalidateTag).toHaveBeenCalledWith('sitemap:site-1')
    expect(revalidatePath).toHaveBeenCalledWith('/blog/pt-BR/my-post')
    expect(revalidatePath).toHaveBeenCalledWith('/blog/pt-BR')
  })

  it('revalidateCampaignSeo invalidates campaign/og/sitemap tags + 1 path', async () => {
    const { revalidateCampaignSeo } = await import('@/lib/seo/cache-invalidation')
    revalidateCampaignSeo('site-1', 'camp-9', 'pt-BR', 'launch')
    expect(revalidateTag).toHaveBeenCalledWith('campaign:camp-9')
    expect(revalidateTag).toHaveBeenCalledWith('og:campaign:camp-9')
    expect(revalidateTag).toHaveBeenCalledWith('sitemap:site-1')
    expect(revalidatePath).toHaveBeenCalledWith('/pt/campaigns/launch')
  })

  it('revalidateSiteBranding invalidates seo-config tag', async () => {
    const { revalidateSiteBranding } = await import('@/lib/seo/cache-invalidation')
    revalidateSiteBranding()
    expect(revalidateTag).toHaveBeenCalledWith('seo-config')
  })
})

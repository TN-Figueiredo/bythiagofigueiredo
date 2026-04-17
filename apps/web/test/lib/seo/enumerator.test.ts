import { describe, it, expect } from 'vitest'
import { skipIfNoLocalDb } from '../../helpers/db-skip'
import { getSupabaseServiceClient } from '../../../lib/supabase/service'

describe.skipIf(skipIfNoLocalDb())('enumerateSiteRoutes (RLS mirror)', () => {
  it('excludes drafts and future-scheduled posts', async () => {
    const { seedSite, seedPublishedPost, seedDraftPost, seedFutureScheduledPost } = await import(
      '../../helpers/db-seed'
    )
    const db = getSupabaseServiceClient()
    const site = await seedSite(db, { siteSlug: 'test-site' })
    await seedPublishedPost(site.siteId, { slug: 'published-1', locale: 'pt-BR' })
    await seedDraftPost(site.siteId, { slug: 'draft-1', locale: 'pt-BR' })
    await seedFutureScheduledPost(site.siteId, { slug: 'future-1', locale: 'pt-BR' })

    const { enumerateSiteRoutes } = await import('@/lib/seo/enumerator')
    const { getSiteSeoConfig } = await import('@/lib/seo/config')
    const config = await getSiteSeoConfig(site.siteId, 'test-site.invalid')
    const routes = await enumerateSiteRoutes(site.siteId, config)
    const paths = routes.map((r) => r.path)
    expect(paths).toContain('/blog/pt-BR/published-1')
    expect(paths).not.toContain('/blog/pt-BR/draft-1')
    expect(paths).not.toContain('/blog/pt-BR/future-1')
  })

  it('includes static routes for supported locales', async () => {
    const { seedSite } = await import('../../helpers/db-seed')
    const db = getSupabaseServiceClient()
    const site = await seedSite(db, { siteSlug: 'static-test' })
    const { enumerateSiteRoutes } = await import('@/lib/seo/enumerator')
    const { getSiteSeoConfig } = await import('@/lib/seo/config')
    const config = await getSiteSeoConfig(site.siteId, 'static-test.invalid')
    const routes = await enumerateSiteRoutes(site.siteId, config)
    expect(routes.map((r) => r.path)).toEqual(
      expect.arrayContaining(['/', '/privacy', '/terms', '/contact']),
    )
  })
})

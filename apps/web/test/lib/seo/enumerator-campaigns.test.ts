// @vitest-environment node
/**
 * Sitemap: só campanha PUBLICADA (status 'published', published_at no passado) do site entra.
 * Antes filtrava status='active', valor que não existe no enum post_status: o Postgres recusa a
 * consulta (22P02) e o enumerador caía para as rotas estáticas, sem blog nem campanhas.
 */
import { describe, it, expect, vi } from 'vitest'
import { fakePostgrest } from '../../helpers/fake-postgrest'

let db: ReturnType<typeof fakePostgrest>
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: (t: string) => db.client.from(t) }) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { enumerateSiteRoutes } from '../../../lib/seo/enumerator'
import type { SiteSeoConfig } from '../../../lib/seo/config'

const past = new Date(Date.now() - 864e5).toISOString()
const future = new Date(Date.now() + 864e5).toISOString()
const tx = (slug: string, c: Record<string, unknown>) => ({ slug, locale: 'en', updated_at: past, campaigns: { id: `c-${slug}`, site_id: 'site-1', ...c } })

describe('enumerador do sitemap: campanhas', () => {
  it('lista só publicadas e já vencidas, do site', async () => {
    db = fakePostgrest({
      tables: {
        blog_translations: [],
        newsletter_editions: [],
        newsletter_types: [],
        campaign_translations: [
          tx('pub', { status: 'published', published_at: past }),
          tx('draft', { status: 'draft', published_at: null }),
          tx('sched', { status: 'scheduled', published_at: null }),
          tx('archived', { status: 'archived', published_at: past }),
          tx('future', { status: 'published', published_at: future }),
          tx('other-site', { status: 'published', published_at: past, site_id: 'site-2' }),
        ],
      },
      columns: { blog_translations: ['slug', 'locale', 'updated_at'], newsletter_editions: ['id', 'sent_at'], newsletter_types: ['slug', 'updated_at'] },
    })
    const config = { supportedLocales: ['en'], contentPaths: { blog: '/blog', campaigns: '/campaigns' } } as unknown as SiteSeoConfig
    const paths = (await enumerateSiteRoutes('site-1', config)).map(r => r.path)
    expect(paths).toContain('/campaigns/pub')
    for (const slug of ['draft', 'sched', 'archived', 'future', 'other-site']) {
      expect(paths).not.toContain(`/campaigns/${slug}`)
    }
  })
})

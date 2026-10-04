// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

const h = vi.hoisted(() => ({ filters: [] as Array<[string, unknown]>, ctx: null as { siteId: string } | null }))
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Map([['host', 'example.com'], ['x-locale', 'pt-BR']])) }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND') } }))
vi.mock('../../lib/cms/site-context', () => ({ tryGetSiteContext: () => Promise.resolve(h.ctx) }))
vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => {
    const chain: Record<string, unknown> = {}
    chain.select = () => chain
    chain.eq = (c: string, v: unknown) => { h.filters.push([c, v]); return chain }
    // a campanha só existe no site B
    chain.maybeSingle = () => Promise.resolve({ data: h.filters.some(f => f[0] === 'site_id' && f[1] !== 'site-B') ? null : { id: 'c1', status: 'draft', campaign_translations: [{}] }, error: null })
    return { from: () => chain }
  },
}))

import CampaignPage from '../../src/app/(public)/campaigns/[slug]/page'

describe('página pública de campanha — escopo de site', () => {
  it('slug que só existe em outro site: 404 com filtro site_id do host', async () => {
    h.ctx = { siteId: 'site-A' }; h.filters.length = 0
    await expect(CampaignPage({ params: Promise.resolve({ slug: 'so-no-b' }) } as never)).rejects.toThrow('NEXT_NOT_FOUND')
    expect(h.filters).toContainEqual(['site_id', 'site-A'])
  })
})

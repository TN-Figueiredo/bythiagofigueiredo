import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Sprint 5b PR-B Phase 3 — `getCampaignBySlug` wrapper test.
 *
 * The wrapper queries `campaigns` + `campaign_translations!inner` filtered by
 * site_id + status='active' + locale + slug, returning `{id, translation}` or
 * null. Mirrors the public-read RLS shape even though it runs as service role.
 */
describe('getCampaignBySlug', () => {
  beforeEach(() => vi.resetModules())

  it('returns null when campaign not found', async () => {
    vi.doMock('@/lib/supabase/service', () => {
      const builder = makeBuilder({ data: null, error: null })
      return { getSupabaseServiceClient: () => ({ from: () => builder }) }
    })
    const { getCampaignBySlug } = await import('@/lib/cms/repositories')
    const result = await getCampaignBySlug({
      siteId: 'site-1',
      locale: 'pt-BR',
      slug: 'missing',
    })
    expect(result).toBeNull()
  })

  it('returns {id, translation} when found', async () => {
    const row = {
      id: 'camp-1',
      site_id: 'site-1',
      status: 'active',
      campaign_translations: [
        {
          locale: 'pt-BR',
          slug: 'launch',
          meta_title: 'Launch',
          meta_description: 'Desc',
          og_image_url: null,
        },
      ],
    }
    vi.doMock('@/lib/supabase/service', () => {
      const builder = makeBuilder({ data: row, error: null })
      return { getSupabaseServiceClient: () => ({ from: () => builder }) }
    })
    const { getCampaignBySlug } = await import('@/lib/cms/repositories')
    const result = await getCampaignBySlug({
      siteId: 'site-1',
      locale: 'pt-BR',
      slug: 'launch',
    })
    expect(result).not.toBeNull()
    expect(result?.id).toBe('camp-1')
    expect(result?.translation.meta_title).toBe('Launch')
    expect(result?.translation.slug).toBe('launch')
  })

  it('throws when supabase returns an error', async () => {
    vi.doMock('@/lib/supabase/service', () => {
      const builder = makeBuilder({
        data: null,
        error: { message: 'boom', code: 'PGRST', details: '', hint: '' },
      })
      return { getSupabaseServiceClient: () => ({ from: () => builder }) }
    })
    const { getCampaignBySlug } = await import('@/lib/cms/repositories')
    await expect(
      getCampaignBySlug({ siteId: 'site-1', locale: 'pt-BR', slug: 'x' }),
    ).rejects.toMatchObject({ message: 'boom' })
  })
})

/**
 * Minimal Supabase query builder stub. Each chain method returns the same
 * builder so call order doesn't matter; `maybeSingle()` resolves with the
 * provided `{data, error}` payload.
 */
function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const passthrough = () => builder
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'range', 'not', 'is', 'lte', 'gte']) {
    builder[m] = passthrough
  }
  builder.maybeSingle = () => Promise.resolve(result)
  builder.single = () => Promise.resolve(result)
  return builder
}

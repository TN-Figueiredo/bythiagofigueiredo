import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as authGuards from '../../lib/cms/auth-guards'

vi.mock('../../lib/cms/auth-guards', () => ({
  requireSiteAdminForRow: vi.fn().mockResolvedValue({ siteId: 's1' }),
}))

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
}))

const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null })

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ rpc: rpcMock }),
}))

const getByIdMock = vi.fn()
const deleteMock = vi.fn()
vi.mock('../../lib/cms/repositories', () => ({
  campaignRepo: () => ({
    getById: getByIdMock,
    publish: vi.fn().mockResolvedValue({
      id: 'c1',
      translations: [{ locale: 'pt-BR', slug: 'promo' }],
    }),
    unpublish: vi.fn().mockResolvedValue({
      id: 'c1',
      translations: [{ locale: 'pt-BR', slug: 'promo' }],
    }),
    archive: vi.fn().mockResolvedValue({
      id: 'c1',
      translations: [{ locale: 'pt-BR', slug: 'promo' }],
    }),
    delete: deleteMock,
  }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const { revalidateCampaignSeoMock } = vi.hoisted(() => ({
  revalidateCampaignSeoMock: vi.fn(),
}))
vi.mock('@/lib/seo/cache-invalidation', () => ({
  revalidateCampaignSeo: revalidateCampaignSeoMock,
  revalidateBlogPostSeo: vi.fn(),
  revalidateSiteBranding: vi.fn(),
}))

import {
  saveCampaign,
  publishCampaign,
  unpublishCampaign,
  archiveCampaign,
  deleteCampaign,
} from '../../src/app/cms/(authed)/campaigns/[id]/edit/actions'

describe('saveCampaign', () => {
  beforeEach(() => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockResolvedValue({ siteId: 's1' })
    rpcMock.mockClear()
    rpcMock.mockResolvedValue({ data: null, error: null })
    revalidateCampaignSeoMock.mockClear()
    getByIdMock.mockReset()
    getByIdMock.mockResolvedValue({
      id: 'c1',
      site_id: 's1',
      status: 'draft',
      translations: [{ locale: 'pt-BR', slug: 'promo' }],
    })
  })

  it('returns ok and calls update_campaign_atomic for valid input', async () => {
    const result = await saveCampaign(
      'c1',
      { interest: 'lead_magnet' },
      [{ locale: 'pt-BR', slug: 'promo', main_hook_md: 'Hook' }],
    )
    expect(result.ok).toBe(true)
    expect(rpcMock).toHaveBeenCalledWith(
      'update_campaign_atomic',
      expect.objectContaining({
        p_campaign_id: 'c1',
        p_patch: expect.objectContaining({ interest: 'lead_magnet' }),
        p_translations: expect.any(Array),
      }),
    )
  })

  it('calls revalidateCampaignSeo once per refreshed translation', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 'c1',
      site_id: 's1',
      status: 'draft',
      translations: [
        { locale: 'pt-BR', slug: 'promo' },
        { locale: 'en', slug: 'promo-en' },
      ],
    })
    const result = await saveCampaign(
      'c1',
      { interest: 'lead_magnet' },
      [{ locale: 'pt-BR', slug: 'promo', main_hook_md: 'Hook' }],
    )
    expect(result.ok).toBe(true)
    expect(revalidateCampaignSeoMock).toHaveBeenCalledTimes(2)
    expect(revalidateCampaignSeoMock).toHaveBeenCalledWith('s1', 'c1', 'pt-BR', 'promo')
    expect(revalidateCampaignSeoMock).toHaveBeenCalledWith('s1', 'c1', 'en', 'promo-en')
  })

  it('rejects patches containing status/scheduled_for/published_at', async () => {
    const result = await saveCampaign(
      'c1',
      { status: 'published' } as unknown as Parameters<typeof saveCampaign>[1],
      [{ locale: 'pt-BR', slug: 'promo' }],
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('status_transition_rejected')
    }
  })

  it('returns validation error when translation locale is missing', async () => {
    const result = await saveCampaign(
      'c1',
      {},
      [{ locale: '', slug: 'promo' }],
    )
    expect(result.ok).toBe(false)
    if (!result.ok && result.error === 'validation_failed') {
      expect(result.fields.locale).toBeTruthy()
    }
  })

  it('returns validation error when translation slug is explicitly empty', async () => {
    const result = await saveCampaign(
      'c1',
      {},
      [{ locale: 'pt-BR', slug: '' }],
    )
    expect(result.ok).toBe(false)
    if (!result.ok && result.error === 'validation_failed') {
      expect(result.fields.slug).toBeTruthy()
    }
  })

  it('returns db_error when RPC fails', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    const result = await saveCampaign(
      'c1',
      { interest: 'lead_magnet' },
      [{ locale: 'pt-BR', slug: 'promo' }],
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('db_error')
    }
  })
})

describe('publish/unpublish/archive/delete transitions', () => {
  beforeEach(() => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockResolvedValue({ siteId: 's1' })
    revalidateCampaignSeoMock.mockClear()
    getByIdMock.mockReset()
    getByIdMock.mockResolvedValue({
      id: 'c1',
      site_id: 's1',
      status: 'draft',
      translations: [{ locale: 'pt-BR', slug: 'promo' }],
    })
    deleteMock.mockReset()
    deleteMock.mockResolvedValue(undefined)
  })

  it('publishCampaign calls revalidateCampaignSeo per translation', async () => {
    await publishCampaign('c1')
    expect(revalidateCampaignSeoMock).toHaveBeenCalledWith('s1', 'c1', 'pt-BR', 'promo')
  })

  it('unpublishCampaign calls revalidateCampaignSeo per translation', async () => {
    await unpublishCampaign('c1')
    expect(revalidateCampaignSeoMock).toHaveBeenCalledWith('s1', 'c1', 'pt-BR', 'promo')
  })

  it('archiveCampaign calls revalidateCampaignSeo per translation', async () => {
    await archiveCampaign('c1')
    expect(revalidateCampaignSeoMock).toHaveBeenCalledWith('s1', 'c1', 'pt-BR', 'promo')
  })

  it('deleteCampaign returns ok:true for a draft and revalidates SEO + listing', async () => {
    const result = await deleteCampaign('c1')
    expect(result).toEqual({ ok: true })
    expect(revalidateCampaignSeoMock).toHaveBeenCalledWith('s1', 'c1', 'pt-BR', 'promo')
    const { revalidatePath } = await import('next/cache')
    expect(revalidatePath).toHaveBeenCalledWith('/cms/campaigns')
  })

  it('deleteCampaign returns already_published when status is published', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 'c1',
      site_id: 's1',
      status: 'published',
      translations: [{ locale: 'pt-BR', slug: 'promo' }],
    })
    const result = await deleteCampaign('c1')
    expect(result).toEqual({ ok: false, error: 'already_published' })
    expect(deleteMock).not.toHaveBeenCalled()
    expect(revalidateCampaignSeoMock).not.toHaveBeenCalled()
  })

  it('deleteCampaign returns not_found when getById yields null', async () => {
    getByIdMock.mockResolvedValueOnce(null)
    const result = await deleteCampaign('c1')
    expect(result).toEqual({ ok: false, error: 'not_found' })
    expect(deleteMock).not.toHaveBeenCalled()
    expect(revalidateCampaignSeoMock).not.toHaveBeenCalled()
  })
})

describe('saveCampaign URL sanitization', () => {
  beforeEach(() => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockResolvedValue({ siteId: 's1' })
    rpcMock.mockClear()
    rpcMock.mockResolvedValue({ data: null, error: null })
    revalidateCampaignSeoMock.mockClear()
    getByIdMock.mockReset()
    getByIdMock.mockResolvedValue({
      id: 'c1',
      site_id: 's1',
      status: 'draft',
      translations: [{ locale: 'pt-BR', slug: 'p' }],
    })
  })

  it('rejects javascript: og_image_url in a translation', async () => {
    const result = await saveCampaign(
      'c1',
      { interest: 'x' },
      [{ locale: 'pt-BR', slug: 'p', og_image_url: 'javascript:alert(1)' }],
    )
    expect(result.ok).toBe(false)
    if (!result.ok && result.error === 'validation_failed') {
      expect(result.fields.og_image_url).toBe('invalid_url')
    }
    expect(rpcMock).not.toHaveBeenCalled()
    expect(revalidateCampaignSeoMock).not.toHaveBeenCalled()
  })

  it('accepts https og_image_url', async () => {
    const result = await saveCampaign(
      'c1',
      { interest: 'x' },
      [{ locale: 'pt-BR', slug: 'p', og_image_url: 'https://cdn.example.com/x.png' }],
    )
    expect(result.ok).toBe(true)
  })
})

describe('authorization', () => {
  it('saveCampaign throws when requireSiteAdminForRow throws forbidden', async () => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockRejectedValueOnce(new Error('forbidden'))
    await expect(
      saveCampaign('c1', {}, [{ locale: 'pt-BR' }]),
    ).rejects.toThrow(/forbidden/)
  })

  it('publishCampaign throws when requireSiteAdminForRow throws forbidden', async () => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockRejectedValueOnce(new Error('forbidden'))
    await expect(publishCampaign('c1')).rejects.toThrow(/forbidden/)
  })

  it('deleteCampaign throws when requireSiteAdminForRow throws forbidden', async () => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockRejectedValueOnce(new Error('forbidden'))
    await expect(deleteCampaign('c1')).rejects.toThrow(/forbidden/)
  })
})

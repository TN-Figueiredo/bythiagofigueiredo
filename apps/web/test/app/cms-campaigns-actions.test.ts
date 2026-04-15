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

vi.mock('../../lib/cms/repositories', () => ({
  campaignRepo: () => ({
    getById: vi.fn().mockResolvedValue({
      id: 'c1',
      site_id: 's1',
      status: 'draft',
      translations: [{ locale: 'pt-BR', slug: 'promo' }],
    }),
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
    delete: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  saveCampaign,
  publishCampaign,
  unpublishCampaign,
  archiveCampaign,
  deleteCampaign,
} from '../../src/app/cms/campaigns/[id]/edit/actions'

describe('saveCampaign', () => {
  beforeEach(() => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockResolvedValue({ siteId: 's1' })
    rpcMock.mockClear()
    rpcMock.mockResolvedValue({ data: null, error: null })
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
  })

  it('publishCampaign revalidates public paths', async () => {
    await publishCampaign('c1')
    const { revalidatePath } = await import('next/cache')
    expect(revalidatePath).toHaveBeenCalledWith('/campaigns/pt-BR/promo')
  })

  it('unpublishCampaign revalidates', async () => {
    await unpublishCampaign('c1')
    const { revalidatePath } = await import('next/cache')
    expect(revalidatePath).toHaveBeenCalled()
  })

  it('archiveCampaign revalidates', async () => {
    await archiveCampaign('c1')
    const { revalidatePath } = await import('next/cache')
    expect(revalidatePath).toHaveBeenCalled()
  })

  it('deleteCampaign revalidates cms list', async () => {
    await deleteCampaign('c1')
    const { revalidatePath } = await import('next/cache')
    expect(revalidatePath).toHaveBeenCalledWith('/cms/campaigns')
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

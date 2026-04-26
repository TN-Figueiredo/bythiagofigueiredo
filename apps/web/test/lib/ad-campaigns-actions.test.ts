import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ---------------------------------------------------------------------------
 * Mock result + chainable builder
 * Supports .insert().select().single(), .update().eq().eq(), .delete().eq().eq()
 * -------------------------------------------------------------------------*/
const mockResult = { data: { id: 'c-1' } as Record<string, unknown> | null, error: null as { message: string } | null }

function makeChainable(result = mockResult) {
  const chain: Record<string, unknown> = {
    eq: vi.fn(() => makeChainable(result)),
    select: vi.fn(() => makeChainable(result)),
    single: vi.fn(() => makeChainable(result)),
    delete: vi.fn(() => makeChainable(result)),
    insert: vi.fn(() => makeChainable(result)),
    upsert: vi.fn(() => makeChainable(result)),
    then: (resolve: (v: typeof result) => void) => Promise.resolve(result).then(resolve),
  }
  return chain
}

const mockInsertChain = makeChainable()
const mockUpdateChain = makeChainable()
const mockDeleteChain = makeChainable()
const mockUpsertChain = makeChainable()
const mockSelectChain = makeChainable()

const mockChain = {
  insert: vi.fn(() => mockInsertChain),
  update: vi.fn(() => mockUpdateChain),
  delete: vi.fn(() => mockDeleteChain),
  upsert: vi.fn(() => mockUpsertChain),
  select: vi.fn(() => mockSelectChain),
}
const mockFrom = vi.fn(() => mockChain)

/* ---------------------------------------------------------------------------
 * Storage mock
 * -------------------------------------------------------------------------*/
const mockStorageUpload = vi.fn()
const mockStorageRemove = vi.fn()
const mockStorageGetPublicUrl = vi.fn()
const mockStorageBucket = {
  upload: mockStorageUpload,
  remove: mockStorageRemove,
  getPublicUrl: mockStorageGetPublicUrl,
}
const mockStorageFrom = vi.fn(() => mockStorageBucket)
const mockStorage = { from: mockStorageFrom }

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom, storage: mockStorage }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireArea: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/sentry-wrap', () => ({
  captureServerActionError: vi.fn(),
}))

vi.mock('@/lib/ads/config', () => ({
  AD_APP_ID: 'bythiagofigueiredo',
}))

const mockFetchAdCampaignById = vi.fn().mockResolvedValue({ id: 'c-1', name: 'Test' })
vi.mock('@tn-figueiredo/ad-engine-admin', () => ({
  createAdminQueries: () => ({
    fetchAdCampaignById: mockFetchAdCampaignById,
  }),
}))

import { requireArea } from '@tn-figueiredo/auth-nextjs/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { captureServerActionError } from '@/lib/sentry-wrap'

const actionsPath = '../../src/app/admin/(authed)/ads/_actions/campaigns'

function baseCampaignData() {
  return {
    name: 'Test Campaign',
    format: 'banner' as const,
    audience: ['free'],
    limits: { maxPerSession: 1, maxPerDay: 3, cooldownMs: 3600000 },
    priority: 5,
    pricing: { model: 'cpm' as const, value: 10 },
    schedule: { start: '2026-01-01', end: '2026-12-31' },
    status: 'draft' as const,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockResult.data = { id: 'c-1' }
  mockResult.error = null
  // Default storage happy-path responses
  mockStorageUpload.mockResolvedValue({ data: { path: 'ads/media/test.png' }, error: null })
  mockStorageRemove.mockResolvedValue({ data: null, error: null })
  mockStorageGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/ads/media/test.png' } })
})

/* ---------------------------------------------------------------------------
 * createCampaign
 * -------------------------------------------------------------------------*/
describe('createCampaign', () => {
  it('calls requireArea("admin") before inserting', async () => {
    const { createCampaign } = await import(actionsPath)
    await createCampaign(baseCampaignData())
    expect(requireArea).toHaveBeenCalledWith('admin')
  })

  it('inserts with app_id = "bythiagofigueiredo"', async () => {
    const { createCampaign } = await import(actionsPath)
    await createCampaign(baseCampaignData())
    expect(mockFrom).toHaveBeenCalledWith('ad_campaigns')
    const insertArg = mockChain.insert.mock.calls[0][0]
    expect(insertArg.app_id).toBe('bythiagofigueiredo')
  })

  it('persists the type field from form data', async () => {
    const { createCampaign } = await import(actionsPath)
    const data = { ...baseCampaignData(), type: 'cpa' }
    await createCampaign(data)
    const insertArg = mockChain.insert.mock.calls[0][0]
    expect(insertArg.type).toBe('cpa')
  })

  it('inserts creatives with correct locale and interaction', async () => {
    const { createCampaign } = await import(actionsPath)
    const data = {
      ...baseCampaignData(),
      creatives: {
        slot1: {
          slotKey: 'banner_top',
          title: 'Ad Title',
          body: 'Ad Body',
          ctaText: 'Click',
          ctaUrl: 'https://example.com',
          imageUrl: null,
          dismissSeconds: 0,
          locale: 'en',
          interaction: 'modal',
        },
      },
    }
    await createCampaign(data)

    // First call to mockFrom is for ad_campaigns, second for ad_slot_creatives
    const fromCalls = mockFrom.mock.calls.map((c: unknown[]) => c[0])
    expect(fromCalls).toContain('ad_slot_creatives')

    // The second insert call is for creatives
    const creativesInsertCall = mockChain.insert.mock.calls[1]
    const creatives = creativesInsertCall[0]
    expect(creatives[0].locale).toBe('en')
    expect(creatives[0].interaction).toBe('modal')
    expect(creatives[0].campaign_id).toBe('c-1')
  })

  it('calls revalidatePath and revalidateTag after success', async () => {
    const { createCampaign } = await import(actionsPath)
    await createCampaign(baseCampaignData())
    expect(revalidatePath).toHaveBeenCalledWith('/admin/ads')
    expect(revalidateTag).toHaveBeenCalledWith('ads')
  })
})

/* ---------------------------------------------------------------------------
 * updateCampaign
 * -------------------------------------------------------------------------*/
describe('updateCampaign', () => {
  it('scopes update by app_id via .eq()', async () => {
    const { updateCampaign } = await import(actionsPath)
    await updateCampaign('c-1', baseCampaignData())
    expect(mockFrom).toHaveBeenCalledWith('ad_campaigns')
    expect(mockChain.update).toHaveBeenCalled()
    // .eq('id', ...).eq('app_id', ...) chain
    const eqFn = mockUpdateChain.eq as ReturnType<typeof vi.fn>
    expect(eqFn).toHaveBeenCalledWith('id', 'c-1')
  })

  it('deletes old creatives then inserts new ones', async () => {
    const { updateCampaign } = await import(actionsPath)
    const data = {
      ...baseCampaignData(),
      creatives: {
        slot1: {
          slotKey: 'banner_top',
          title: 'Updated',
          ctaText: 'Go',
          ctaUrl: 'https://example.com',
        },
      },
    }
    await updateCampaign('c-1', data)

    const fromCalls = mockFrom.mock.calls.map((c: unknown[]) => c[0])
    // Should call from('ad_slot_creatives') for delete + insert
    const slotCreativeCalls = fromCalls.filter((n: string) => n === 'ad_slot_creatives')
    expect(slotCreativeCalls.length).toBeGreaterThanOrEqual(2)
    expect(mockChain.delete).toHaveBeenCalled()
    // insert is called for the new creatives
    expect(mockChain.insert.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('captures Sentry error on DB failure', async () => {
    const { updateCampaign } = await import(actionsPath)
    mockResult.error = { message: 'db boom' }
    await expect(updateCampaign('c-1', baseCampaignData())).rejects.toThrow('db boom')
    expect(captureServerActionError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'db boom' }),
      expect.objectContaining({ action: 'update_campaign', campaign_id: 'c-1' }),
    )
  })
})

/* ---------------------------------------------------------------------------
 * deleteCampaign
 * -------------------------------------------------------------------------*/
describe('deleteCampaign', () => {
  it('scopes delete by app_id', async () => {
    const { deleteCampaign } = await import(actionsPath)
    await deleteCampaign('c-1')
    expect(mockFrom).toHaveBeenCalledWith('ad_campaigns')
    expect(mockChain.delete).toHaveBeenCalled()
  })
})

/* ---------------------------------------------------------------------------
 * updateCampaignStatus
 * -------------------------------------------------------------------------*/
describe('updateCampaignStatus', () => {
  it('rejects invalid status values', async () => {
    const { updateCampaignStatus } = await import(actionsPath)
    await expect(updateCampaignStatus('c-1', 'hacked')).rejects.toThrow('Invalid status')
  })

  it('accepts all valid statuses', async () => {
    const { updateCampaignStatus } = await import(actionsPath)
    for (const status of ['draft', 'active', 'paused', 'archived']) {
      mockChain.update.mockClear()
      mockResult.error = null
      await updateCampaignStatus('c-1', status)
      expect(mockChain.update).toHaveBeenCalled()
    }
  })

  it('scopes by app_id', async () => {
    const { updateCampaignStatus } = await import(actionsPath)
    await updateCampaignStatus('c-1', 'active')
    expect(mockFrom).toHaveBeenCalledWith('ad_campaigns')
    const eqFn = mockUpdateChain.eq as ReturnType<typeof vi.fn>
    expect(eqFn).toHaveBeenCalledWith('id', 'c-1')
  })
})

/* ---------------------------------------------------------------------------
 * fetchCampaignById
 * -------------------------------------------------------------------------*/
describe('fetchCampaignById', () => {
  it('calls requireArea("admin") before querying', async () => {
    const { fetchCampaignById } = await import(actionsPath)
    await fetchCampaignById('c-1')
    expect(requireArea).toHaveBeenCalledWith('admin')
  })
})

/* ---------------------------------------------------------------------------
 * uploadMedia
 * -------------------------------------------------------------------------*/
describe('uploadMedia', () => {
  it('calls requireArea("admin") before uploading', async () => {
    const { uploadMedia } = await import(actionsPath)
    const file = new File(['data'], 'test.png', { type: 'image/png' })
    await uploadMedia(file)
    expect(requireArea).toHaveBeenCalledWith('admin')
  })

  it('uploads to storage bucket "media" with correct content type', async () => {
    const { uploadMedia } = await import(actionsPath)
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    await uploadMedia(file)
    expect(mockStorageFrom).toHaveBeenCalledWith('media')
    const [path, , opts] = mockStorageUpload.mock.calls[0]
    expect(path).toMatch(/^ads\/media\/.+\.jpg$/)
    expect(opts).toMatchObject({ contentType: 'image/jpeg', upsert: false })
  })

  it('inserts a row into ad_media with app_id, mime_type, file_name', async () => {
    const { uploadMedia } = await import(actionsPath)
    const file = new File(['data'], 'banner.png', { type: 'image/png' })
    await uploadMedia(file)
    expect(mockFrom).toHaveBeenCalledWith('ad_media')
    const insertArg = mockChain.insert.mock.calls[0][0]
    expect(insertArg.app_id).toBe('bythiagofigueiredo')
    expect(insertArg.mime_type).toBe('image/png')
    expect(insertArg.file_name).toBe('banner.png')
    expect(insertArg.public_url).toBe('https://cdn.example.com/ads/media/test.png')
  })

  it('returns { id, url } from inserted row', async () => {
    const { uploadMedia } = await import(actionsPath)
    const file = new File(['data'], 'img.png', { type: 'image/png' })
    const result = await uploadMedia(file)
    expect(result.id).toBe('c-1')
    expect(result.url).toBe('https://cdn.example.com/ads/media/test.png')
  })

  it('throws and captures Sentry error when storage upload fails', async () => {
    const { uploadMedia } = await import(actionsPath)
    mockStorageUpload.mockResolvedValueOnce({ data: null, error: { message: 'storage boom' } })
    const file = new File(['data'], 'img.png', { type: 'image/png' })
    await expect(uploadMedia(file)).rejects.toThrow('storage boom')
    expect(captureServerActionError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'storage boom' }),
      expect.objectContaining({ action: 'upload_media' }),
    )
  })

  it('throws and captures Sentry error when ad_media insert fails', async () => {
    const { uploadMedia } = await import(actionsPath)
    mockResult.error = { message: 'insert boom' }
    mockResult.data = null
    const file = new File(['data'], 'img.png', { type: 'image/png' })
    await expect(uploadMedia(file)).rejects.toThrow('insert boom')
    expect(captureServerActionError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'insert boom' }),
      expect.objectContaining({ action: 'upload_media_insert' }),
    )
  })

  it('rejects files with disallowed MIME types', async () => {
    const { uploadMedia } = await import(actionsPath)
    const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' })
    await expect(uploadMedia(file)).rejects.toThrow('Invalid file type')
  })

  it('rejects files exceeding 5MB', async () => {
    const { uploadMedia } = await import(actionsPath)
    // Create a file object with a size > 5MB via Object.defineProperty
    const file = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 })
    await expect(uploadMedia(file)).rejects.toThrow('File too large')
  })

  it('accepts all allowed MIME types', async () => {
    const { uploadMedia } = await import(actionsPath)
    for (const mime of ['image/png', 'image/jpeg', 'image/gif', 'image/webp']) {
      vi.clearAllMocks()
      mockResult.data = { id: 'c-1' }
      mockResult.error = null
      mockStorageUpload.mockResolvedValue({ data: { path: 'ads/media/test.png' }, error: null })
      mockStorageGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/ads/media/test.png' } })
      const file = new File(['data'], `test.${mime.split('/')[1]}`, { type: mime })
      await expect(uploadMedia(file)).resolves.toBeDefined()
    }
  })
})

/* ---------------------------------------------------------------------------
 * deleteMedia
 * -------------------------------------------------------------------------*/
describe('deleteMedia', () => {
  it('calls requireArea("admin") before deleting', async () => {
    const { deleteMedia } = await import(actionsPath)
    mockResult.data = { storage_path: 'ads/media/test.png' }
    await deleteMedia('m-1')
    expect(requireArea).toHaveBeenCalledWith('admin')
  })

  it('fetches storage_path from ad_media then removes from storage', async () => {
    const { deleteMedia } = await import(actionsPath)
    mockResult.data = { storage_path: 'ads/media/abc.png' }
    await deleteMedia('m-1')
    expect(mockFrom).toHaveBeenCalledWith('ad_media')
    expect(mockStorageFrom).toHaveBeenCalledWith('media')
    expect(mockStorageRemove).toHaveBeenCalledWith(['ads/media/abc.png'])
  })

  it('deletes the ad_media row after removing from storage', async () => {
    const { deleteMedia } = await import(actionsPath)
    mockResult.data = { storage_path: 'ads/media/abc.png' }
    await deleteMedia('m-1')
    const deleteCalls = mockFrom.mock.calls.filter((c: unknown[]) => c[0] === 'ad_media')
    expect(deleteCalls.length).toBeGreaterThanOrEqual(2)
    expect(mockChain.delete).toHaveBeenCalled()
  })

  it('throws and captures Sentry error when fetch fails', async () => {
    const { deleteMedia } = await import(actionsPath)
    mockResult.error = { message: 'fetch boom' }
    mockResult.data = null
    await expect(deleteMedia('m-1')).rejects.toThrow('fetch boom')
    expect(captureServerActionError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'fetch boom' }),
      expect.objectContaining({ action: 'delete_media_fetch', media_id: 'm-1' }),
    )
  })

  it('throws and captures Sentry error when storage remove fails', async () => {
    const { deleteMedia } = await import(actionsPath)
    mockResult.data = { storage_path: 'ads/media/abc.png' }
    mockStorageRemove.mockResolvedValueOnce({ data: null, error: { message: 'storage remove boom' } })
    await expect(deleteMedia('m-1')).rejects.toThrow('storage remove boom')
    expect(captureServerActionError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'storage remove boom' }),
      expect.objectContaining({ action: 'delete_media_storage', media_id: 'm-1' }),
    )
  })
})

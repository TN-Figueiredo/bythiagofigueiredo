import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.fn()
const mockDelete = vi.fn()
const mockSelect = vi.fn()

const insertChain: Record<string, unknown> = {}
insertChain.select = vi.fn(() => insertChain)
insertChain.single = vi.fn(() => Promise.resolve({ data: { id: 'u-1' }, error: null }))

const deleteChain: Record<string, unknown> = {}
deleteChain.eq = vi.fn(() => deleteChain)
deleteChain.then = (resolve: (v: unknown) => void) => resolve({ error: null })

const selectChain: Record<string, unknown> = {}
selectChain.eq = vi.fn(() => selectChain)
selectChain.then = (resolve: (v: unknown) => void) =>
  resolve({
    data: [
      { resource_type: 'blog_post', resource_id: 'bp-1', field_name: 'cover_image_url' },
    ],
    error: null,
  })

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'media_asset_usage') {
      return {
        insert: mockInsert.mockReturnValue(insertChain),
        delete: mockDelete.mockReturnValue(deleteChain),
        select: mockSelect.mockReturnValue(selectChain),
      }
    }
    return {}
  }),
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => mockSupabase),
}))

describe('media/track-usage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('trackMediaUsage inserts a row into media_asset_usage', async () => {
    const { trackMediaUsage } = await import('@/lib/media/track-usage')
    await trackMediaUsage('asset-1', 'blog_post', 'bp-1', 'cover_image_url')

    expect(mockSupabase.from).toHaveBeenCalledWith('media_asset_usage')
    expect(mockInsert).toHaveBeenCalledWith(
      {
        asset_id: 'asset-1',
        resource_type: 'blog_post',
        resource_id: 'bp-1',
        field_name: 'cover_image_url',
      },
    )
  })

  it('trackMediaUsage handles duplicate without error', async () => {
    insertChain.single = vi.fn(() =>
      Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate' } }),
    )

    const { trackMediaUsage } = await import('@/lib/media/track-usage')
    await expect(
      trackMediaUsage('asset-1', 'blog_post', 'bp-1', 'cover_image_url'),
    ).resolves.toBeUndefined()
  })

  it('removeMediaUsage deletes matching row', async () => {
    const { removeMediaUsage } = await import('@/lib/media/track-usage')
    await removeMediaUsage('asset-1', 'blog_post', 'bp-1', 'cover_image_url')

    expect(mockSupabase.from).toHaveBeenCalledWith('media_asset_usage')
    expect(mockDelete).toHaveBeenCalled()
    expect(deleteChain.eq).toHaveBeenCalledWith('asset_id', 'asset-1')
  })

  it('getAssetUsages returns usages for an asset', async () => {
    const { getAssetUsages } = await import('@/lib/media/track-usage')
    const result = await getAssetUsages('asset-1')

    expect(result).toEqual([
      { resourceType: 'blog_post', resourceId: 'bp-1', fieldName: 'cover_image_url' },
    ])
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpsertResult = { error: null as { message: string } | null }
const mockSingleResult = { data: null as Record<string, unknown> | null, error: null }

const mockUpsertFn = vi.fn(() => ({
  then: (resolve: (v: typeof mockUpsertResult) => void) =>
    Promise.resolve(mockUpsertResult).then(resolve),
}))

const mockSingleFn = vi.fn(() => ({
  then: (resolve: (v: typeof mockSingleResult) => void) =>
    Promise.resolve(mockSingleResult).then(resolve),
}))

const mockEqChain = {
  eq: vi.fn().mockReturnThis(),
  single: mockSingleFn,
}

const mockSelectChain = {
  eq: vi.fn(() => mockEqChain),
}

const mockRpc = vi.fn().mockResolvedValue({ data: 'org-uuid', error: null })

const mockFrom = vi.fn(() => ({
  select: vi.fn(() => mockSelectChain),
  upsert: mockUpsertFn,
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireArea: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/sentry-wrap', () => ({
  captureServerActionError: vi.fn(),
}))

import { requireArea } from '@tn-figueiredo/auth-nextjs/server'
import { revalidateTag, revalidatePath } from 'next/cache'
import { captureServerActionError } from '@/lib/sentry-wrap'

const actionsPath = '../../src/app/admin/(authed)/settings/ads/_actions'

beforeEach(() => {
  vi.clearAllMocks()
  mockUpsertResult.error = null
  mockSingleResult.data = null
  mockSingleResult.error = null
})

describe('savePublisherId action', () => {
  it('calls requireArea("admin") before upserting', async () => {
    const { savePublisherId } = await import(actionsPath)
    await savePublisherId('pub-1234567890')
    expect(requireArea).toHaveBeenCalledWith('admin')
  })

  it('rejects invalid publisher IDs (not matching pub-\\d{10,16} pattern)', async () => {
    const { savePublisherId } = await import(actionsPath)
    await expect(savePublisherId('invalid-id')).rejects.toThrow('Invalid publisher ID format')
  })

  it('rejects publisher IDs with too few digits', async () => {
    const { savePublisherId } = await import(actionsPath)
    await expect(savePublisherId('pub-123456789')).rejects.toThrow('Invalid publisher ID format')
  })

  it('rejects publisher IDs with too many digits', async () => {
    const { savePublisherId } = await import(actionsPath)
    await expect(savePublisherId('pub-12345678901234567')).rejects.toThrow('Invalid publisher ID format')
  })

  it('rejects empty string', async () => {
    const { savePublisherId } = await import(actionsPath)
    await expect(savePublisherId('')).rejects.toThrow('Invalid publisher ID format')
  })

  it('accepts valid pub-XXXXXXXXXX format (10 digits)', async () => {
    const { savePublisherId } = await import(actionsPath)
    await expect(savePublisherId('pub-1234567890')).resolves.not.toThrow()
  })

  it('accepts valid pub-XXXXXXXXXXXXXXXX format (16 digits)', async () => {
    const { savePublisherId } = await import(actionsPath)
    await expect(savePublisherId('pub-1234567890123456')).resolves.not.toThrow()
  })

  it('upserts into ad_network_settings table', async () => {
    const { savePublisherId } = await import(actionsPath)
    await savePublisherId('pub-1234567890')
    expect(mockFrom).toHaveBeenCalledWith('ad_network_settings')
    expect(mockUpsertFn).toHaveBeenCalled()
    const upsertArg = mockUpsertFn.mock.calls[0][0] as Record<string, unknown>
    expect(upsertArg.app_id).toBe('bythiagofigueiredo')
    expect(upsertArg.network).toBe('adsense')
    expect(upsertArg.publisher_id).toBe('pub-1234567890')
  })

  it('revalidates "ads" tag and path after successful save', async () => {
    const { savePublisherId } = await import(actionsPath)
    await savePublisherId('pub-1234567890')
    expect(revalidateTag).toHaveBeenCalledWith('ads')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/settings/ads')
  })

  it('captures Sentry error and rethrows on DB failure', async () => {
    const { savePublisherId } = await import(actionsPath)
    mockUpsertResult.error = { message: 'db boom' }
    await expect(savePublisherId('pub-1234567890')).rejects.toThrow('db boom')
    expect(captureServerActionError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'db boom' }),
      expect.objectContaining({ action: 'save_publisher_id' }),
    )
  })
})

describe('/api/adsense/status route', () => {
  it('returns connected:false when no publisher_id row', async () => {
    mockSingleResult.data = {
      adsense_publisher_id: null,
      adsense_sync_status: 'disconnected',
      adsense_connected_at: null,
      adsense_last_sync_at: null,
      adsense_refresh_token_enc: null,
    }

    const { GET } = await import('../../src/app/api/adsense/status/route')
    const req = new Request('http://localhost/api/adsense/status')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toHaveProperty('connected')
    expect(body.connected).toBe(false)
  })
})

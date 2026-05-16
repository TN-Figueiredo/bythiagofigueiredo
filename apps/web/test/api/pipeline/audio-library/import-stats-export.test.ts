import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn(),
  buildRateLimitHeaders: vi.fn(() => ({})),
}))
vi.mock('@/lib/pipeline/audio-import', () => ({
  mapJsonToDbRow: vi.fn((item: Record<string, unknown>, type: string) => ({ asset_id: item.asset_id, type, original_filename: `${item.asset_id}.mp3` })),
  classifyImportItem: vi.fn(() => 'create'),
  buildDiffLog: vi.fn(() => []),
  buildExportJson: vi.fn((assets: unknown[]) => ({ schema_version: '6.1.0', music: assets, sfx: [] })),
}))

import { POST as ImportPOST } from '@/app/api/pipeline/audio-library/import/route'
import { GET as StatsGET } from '@/app/api/pipeline/audio-library/stats/route'
import { GET as ExportGET } from '@/app/api/pipeline/audio-library/export/route'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const mockAuth = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' as const } }

function mockSupabase(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null }),
    in: vi.fn().mockReturnThis(),
    ...overrides,
  }
  return { from: vi.fn().mockReturnValue(chain) }
}

beforeEach(() => {
  vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth as never)
  vi.mocked(requirePermission).mockReturnValue(true)
})

describe('POST /api/pipeline/audio-library/import', () => {
  it('returns preview for dry_run: true', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    }) as never)
    const req = new NextRequest('http://localhost/api/pipeline/audio-library/import', {
      method: 'POST',
      body: JSON.stringify({ schema_version: '6.1.0', dry_run: true, music: [{ asset_id: 'M1' }], sfx: [] }),
    })
    const res = await ImportPOST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.dry_run).toBe(true)
    expect(json.data.preview).toBeDefined()
    expect(json.data.preview.to_create).toBe(1)
  })

  it('executes import and returns counts', async () => {
    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'audio_assets') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
            upsert: vi.fn().mockImplementation(() => { callCount++; return Promise.resolve({ error: null }) }),
          }
        }
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null }),
        }
      }),
    } as never)
    const req = new NextRequest('http://localhost/api/pipeline/audio-library/import', {
      method: 'POST',
      body: JSON.stringify({ schema_version: '6.1.0', music: [{ asset_id: 'M1' }, { asset_id: 'M2' }], sfx: [] }),
    })
    const res = await ImportPOST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.dry_run).toBe(false)
    expect(json.data.created).toBe(2)
    expect(json.data.import_log_id).toBe('log-1')
  })

  it('tracks errors on batch upsert failure', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'audio_assets') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
            upsert: vi.fn().mockResolvedValue({ error: { message: 'constraint violation' } }),
          }
        }
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'log-2' }, error: null }),
        }
      }),
    } as never)
    const req = new NextRequest('http://localhost/api/pipeline/audio-library/import', {
      method: 'POST',
      body: JSON.stringify({ schema_version: '6.1.0', music: [{ asset_id: 'M1' }], sfx: [] }),
    })
    const res = await ImportPOST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.errors).toHaveLength(1)
    expect(json.data.created).toBe(0)
  })

  it('returns 400 for missing schema_version', async () => {
    const req = new NextRequest('http://localhost/api/pipeline/audio-library/import', {
      method: 'POST',
      body: JSON.stringify({ music: [{ asset_id: 'M1' }] }),
    })
    const res = await ImportPOST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/pipeline/audio-library/import', {
      method: 'POST',
      body: 'not json',
    })
    const res = await ImportPOST(req)
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthorized', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' } as never)
    const req = new NextRequest('http://localhost/api/pipeline/audio-library/import', {
      method: 'POST',
      body: JSON.stringify({ schema_version: '6.1.0' }),
    })
    const res = await ImportPOST(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 when missing write permission', async () => {
    vi.mocked(requirePermission).mockReturnValue(false)
    const req = new NextRequest('http://localhost/api/pipeline/audio-library/import', {
      method: 'POST',
      body: JSON.stringify({ schema_version: '6.1.0' }),
    })
    const res = await ImportPOST(req)
    expect(res.status).toBe(403)
  })
})

describe('GET /api/pipeline/audio-library/stats', () => {
  it('returns aggregated stats', async () => {
    const assets = [
      { id: 'a1', asset_id: 'M1', track_name: 'Track 1', type: 'music', status: 'downloaded', category: 'cinematic', created_at: new Date().toISOString() },
      { id: 'a2', asset_id: 'S1', track_name: null, type: 'sfx', status: 'pending', category: null, created_at: new Date().toISOString() },
    ]
    const usage = [{ audio_asset_id: 'a1' }]
    const sb = {
      from: vi.fn().mockImplementation((table: string) => {
        const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn() as ReturnType<typeof vi.fn> }
        if (table === 'audio_assets') chain.limit = vi.fn().mockResolvedValue({ data: assets, error: null })
        else chain.limit = vi.fn().mockResolvedValue({ data: usage, error: null })
        return chain
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(sb as never)
    const res = await StatsGET(new NextRequest('http://localhost/api/pipeline/audio-library/stats'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.total).toBe(2)
    expect(json.data.by_type.music).toBe(1)
    expect(json.data.by_type.sfx).toBe(1)
    expect(json.data.by_status.pending).toBe(1)
    expect(json.data.unused).toBe(1)
    expect(json.data.by_category.cinematic).toBe(1)
  })

  it('returns zero stats for empty library', async () => {
    const sb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(sb as never)
    const res = await StatsGET(new NextRequest('http://localhost/api/pipeline/audio-library/stats'))
    const json = await res.json()
    expect(json.data.total).toBe(0)
    expect(json.data.by_type).toEqual({ music: 0, sfx: 0 })
    expect(json.data.most_used).toEqual([])
    expect(json.data.unused).toBe(0)
  })

  it('handles unknown status values gracefully', async () => {
    const assets = [{ id: 'a1', asset_id: 'M1', track_name: null, type: 'music', status: 'archived', category: null, created_at: new Date().toISOString() }]
    const sb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: assets, error: null }),
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(sb as never)
    const res = await StatsGET(new NextRequest('http://localhost/api/pipeline/audio-library/stats'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.by_status.downloaded).toBe(0)
  })

  it('computes most_used correctly', async () => {
    const assets = [
      { id: 'a1', asset_id: 'M1', track_name: 'Track 1', type: 'music', status: 'downloaded', category: null, created_at: new Date().toISOString() },
      { id: 'a2', asset_id: 'M2', track_name: 'Track 2', type: 'music', status: 'downloaded', category: null, created_at: new Date().toISOString() },
    ]
    const usage = [{ audio_asset_id: 'a1' }, { audio_asset_id: 'a1' }, { audio_asset_id: 'a2' }]
    const sb = {
      from: vi.fn().mockImplementation((table: string) => {
        const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn() as ReturnType<typeof vi.fn> }
        if (table === 'audio_assets') chain.limit = vi.fn().mockResolvedValue({ data: assets, error: null })
        else chain.limit = vi.fn().mockResolvedValue({ data: usage, error: null })
        return chain
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(sb as never)
    const res = await StatsGET(new NextRequest('http://localhost/api/pipeline/audio-library/stats'))
    const json = await res.json()
    expect(json.data.most_used[0].asset_id).toBe('M1')
    expect(json.data.most_used[0].usage_count).toBe(2)
  })
})

describe('GET /api/pipeline/audio-library/export', () => {
  it('returns export JSON with Content-Disposition header', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [{ id: 'a1', type: 'music' }], error: null }),
      }),
    } as never)
    const res = await ExportGET(new NextRequest('http://localhost/api/pipeline/audio-library/export'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toContain('audio-library-export.json')
  })

  it('returns 401 when unauthorized', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' } as never)
    const res = await ExportGET(new NextRequest('http://localhost/api/pipeline/audio-library/export'))
    expect(res.status).toBe(401)
  })

  it('returns 500 on DB error', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      }),
    } as never)
    const res = await ExportGET(new NextRequest('http://localhost/api/pipeline/audio-library/export'))
    expect(res.status).toBe(500)
  })
})

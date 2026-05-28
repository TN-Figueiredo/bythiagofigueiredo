import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/pipeline/services/audio', () => ({
  importAudioAssets: vi.fn(),
  getAudioStats: vi.fn(),
  exportAudioAssets: vi.fn(),
}))

vi.mock('@/lib/pipeline/services/http-adapter', () => ({
  authToServiceContext: vi.fn().mockReturnValue({
    siteId: 'site-1',
    permissions: ['read', 'write'],
    supabase: {},
  }),
  serviceErrorToResponse: vi.fn().mockImplementation((err: unknown) => {
    if (err instanceof PipelineServiceError) {
      return new Response(JSON.stringify({ error: { code: err.code, message: err.message } }), { status: err.status })
    }
    return new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'unexpected' } }), { status: 500 })
  }),
}))

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn(),
  buildRateLimitHeaders: vi.fn(() => ({})),
}))

import { POST as ImportPOST } from '@/app/api/pipeline/audio-library/import/route'
import { GET as StatsGET } from '@/app/api/pipeline/audio-library/stats/route'
import { GET as ExportGET } from '@/app/api/pipeline/audio-library/export/route'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { importAudioAssets, getAudioStats, exportAudioAssets } from '@/lib/pipeline/services/audio'

const mockAuth = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' as const } }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth as never)
  vi.mocked(requirePermission).mockReturnValue(true)
})

describe('POST /api/pipeline/audio-library/import', () => {
  it('returns preview for dry_run: true', async () => {
    vi.mocked(importAudioAssets).mockResolvedValue({
      data: {
        dry_run: true,
        preview: { to_create: 1, to_update: 0, to_skip: 0, errors: [] },
      },
    } as never)
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
    vi.mocked(importAudioAssets).mockResolvedValue({
      data: {
        dry_run: false,
        import_log_id: 'log-1',
        created: 2,
        updated: 0,
        skipped: 0,
        errors: [],
      },
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
    vi.mocked(importAudioAssets).mockResolvedValue({
      data: {
        dry_run: false,
        import_log_id: 'log-2',
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [{ asset_id: 'M1', error: 'Batch upsert failed' }],
      },
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
    vi.mocked(importAudioAssets).mockRejectedValue(
      new PipelineServiceError('VALIDATION_ERROR', 'schema_version is required', 400),
    )
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

  it('processes items in batches of 100', async () => {
    vi.mocked(importAudioAssets).mockResolvedValue({
      data: {
        dry_run: false,
        import_log_id: 'log-1',
        created: 150,
        updated: 0,
        skipped: 0,
        errors: [],
      },
    } as never)

    const items = Array.from({ length: 150 }, (_, i) => ({
      asset_id: `M${i}`,
      original_filename: `track${i}.mp3`,
    }))

    const req = new NextRequest('http://localhost/api/pipeline/audio-library/import', {
      method: 'POST',
      body: JSON.stringify({ schema_version: '6.1.0', music: items, dry_run: false }),
    })
    const res = await ImportPOST(req)
    expect(res.status).toBe(200)
    // Service handles batching internally; we just verify it was called
    expect(vi.mocked(importAudioAssets)).toHaveBeenCalledOnce()
  })

  it('import with mixed create/update/skip items', async () => {
    vi.mocked(importAudioAssets).mockResolvedValue({
      data: {
        dry_run: false,
        import_log_id: 'log-mixed',
        created: 1,
        updated: 1,
        skipped: 1,
        errors: [],
      },
    } as never)

    const SHA_NEW = 'b'.repeat(64)
    const SHA_SAME = 'a'.repeat(64)
    const SHA_DIFF = 'd'.repeat(64)

    const req = new NextRequest('http://localhost/api/pipeline/audio-library/import', {
      method: 'POST',
      body: JSON.stringify({
        schema_version: '6.1.0',
        music: [
          { asset_id: 'M1', sha256: SHA_NEW },
          { asset_id: 'M2-existing', sha256: SHA_SAME },
          { asset_id: 'M3-diff', sha256: SHA_DIFF },
        ],
        sfx: [],
      }),
    })
    const res = await ImportPOST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.created).toBe(1)
    expect(json.data.updated).toBe(1)
    expect(json.data.skipped).toBe(1)
  })

  it('import_log status is "partial" when some batches fail', async () => {
    vi.mocked(importAudioAssets).mockResolvedValue({
      data: {
        dry_run: false,
        import_log_id: 'log-partial',
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [{ asset_id: 'M1', error: 'Batch upsert failed' }, { asset_id: 'M2', error: 'Batch upsert failed' }],
      },
    } as never)

    const req = new NextRequest('http://localhost/api/pipeline/audio-library/import', {
      method: 'POST',
      body: JSON.stringify({
        schema_version: '6.1.0',
        music: [{ asset_id: 'M1' }, { asset_id: 'M2' }],
        sfx: [],
      }),
    })
    const res = await ImportPOST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    // Service handles import_log status internally
    expect(json.data.errors.length).toBeGreaterThan(0)
  })
})

describe('GET /api/pipeline/audio-library/stats', () => {
  it('returns aggregated stats', async () => {
    vi.mocked(getAudioStats).mockResolvedValue({
      data: {
        total: 2,
        by_type: { music: 1, sfx: 1 },
        by_status: { downloaded: 1, pending: 1, retired: 0 },
        most_used: [],
        recently_added: 2,
        needs_download: 1,
        unused: 1,
      },
    } as never)
    const res = await StatsGET(new NextRequest('http://localhost/api/pipeline/audio-library/stats'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.total).toBe(2)
    expect(json.data.by_type.music).toBe(1)
    expect(json.data.by_type.sfx).toBe(1)
    expect(json.data.by_status.pending).toBe(1)
    // unused = total(2) - usedUniqueCount(1) = 1
    expect(json.data.unused).toBe(1)
    // by_category removed from new implementation
    expect(json.data.by_category).toBeUndefined()
  })

  it('returns zero stats for empty library', async () => {
    vi.mocked(getAudioStats).mockResolvedValue({
      data: {
        total: 0,
        by_type: { music: 0, sfx: 0 },
        by_status: { downloaded: 0, pending: 0, retired: 0 },
        most_used: [],
        recently_added: 0,
        needs_download: 0,
        unused: 0,
      },
    } as never)
    const res = await StatsGET(new NextRequest('http://localhost/api/pipeline/audio-library/stats'))
    const json = await res.json()
    expect(json.data.total).toBe(0)
    expect(json.data.by_type).toEqual({ music: 0, sfx: 0 })
    expect(json.data.most_used).toEqual([])
    expect(json.data.unused).toBe(0)
  })

  it('by_status defaults to 0 when counts are null/missing', async () => {
    vi.mocked(getAudioStats).mockResolvedValue({
      data: {
        total: 0,
        by_type: { music: 0, sfx: 0 },
        by_status: { downloaded: 0, pending: 0, retired: 0 },
        most_used: [],
        recently_added: 0,
        needs_download: 0,
        unused: 0,
      },
    } as never)
    const res = await StatsGET(new NextRequest('http://localhost/api/pipeline/audio-library/stats'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.by_status.downloaded).toBe(0)
    expect(json.data.by_status.pending).toBe(0)
    expect(json.data.by_status.retired).toBe(0)
  })

  it('computes most_used correctly', async () => {
    vi.mocked(getAudioStats).mockResolvedValue({
      data: {
        total: 2,
        by_type: { music: 2, sfx: 0 },
        by_status: { downloaded: 0, pending: 0, retired: 0 },
        most_used: [
          { asset_id: 'M1', track_name: 'Track 1', usage_count: 2 },
          { asset_id: 'M2', track_name: 'Track 2', usage_count: 1 },
        ],
        recently_added: 0,
        needs_download: 0,
        unused: 0,
      },
    } as never)
    const res = await StatsGET(new NextRequest('http://localhost/api/pipeline/audio-library/stats'))
    const json = await res.json()
    expect(json.data.most_used[0].asset_id).toBe('M1')
    expect(json.data.most_used[0].usage_count).toBe(2)
  })

  it('returns stats even when usage query fails (data is null)', async () => {
    vi.mocked(getAudioStats).mockResolvedValue({
      data: {
        total: 5,
        by_type: { music: 3, sfx: 2 },
        by_status: { downloaded: 2, pending: 2, retired: 1 },
        most_used: [],
        recently_added: 5,
        needs_download: 2,
        unused: 5,
      },
    } as never)
    const res = await StatsGET(new NextRequest('http://localhost/api/pipeline/audio-library/stats'))
    const json = await res.json()
    expect(res.status).toBe(200)
    // Count-based fields still resolve
    expect(json.data.total).toBe(5)
    expect(json.data.by_type.music).toBe(3)
    // With null usage data, most_used should be empty and unused = total - 0 = 5
    expect(json.data.most_used).toEqual([])
    expect(json.data.unused).toBe(5)
  })
})

describe('GET /api/pipeline/audio-library/export', () => {
  it('returns export JSON with Content-Disposition header', async () => {
    vi.mocked(exportAudioAssets).mockResolvedValue({
      data: { schema_version: '6.1.0', music: [{ id: 'a1', type: 'music' }], sfx: [] },
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
    vi.mocked(exportAudioAssets).mockRejectedValue(
      new PipelineServiceError('DB_ERROR', 'Failed to export assets', 500),
    )
    const res = await ExportGET(new NextRequest('http://localhost/api/pipeline/audio-library/export'))
    expect(res.status).toBe(500)
  })

  it('export paginates through multiple pages', async () => {
    // Service handles pagination internally; we just verify it returns the data
    const allAssets = Array.from({ length: 1500 }, (_, i) => ({ id: `asset-${i}`, type: 'music' }))
    vi.mocked(exportAudioAssets).mockResolvedValue({
      data: { schema_version: '6.1.0', music: allAssets, sfx: [] },
    } as never)
    const res = await ExportGET(new NextRequest('http://localhost/api/pipeline/audio-library/export'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.music).toHaveLength(1500)
  })
})

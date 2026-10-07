// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidateTag: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn(() => ({})) }))
vi.mock('@/lib/logger', () => ({
  withCronLock: vi.fn((_sb: unknown, _key: unknown, _runId: unknown, _job: unknown, fn: () => Promise<{ status: string; [k: string]: unknown }>) =>
    fn().then(r => { const { status, ...extra } = r; return Response.json(extra, { status: status === 'error' ? 500 : 200 }) })),
  newRunId: vi.fn(() => 'run-1'),
}))
vi.mock('@/lib/youtube/sync', () => ({ syncChannel: vi.fn(), YouTubeQuotaError: class extends Error {} }))
vi.mock('@/lib/cron-health', () => ({ recordCronSuccess: vi.fn(), recordCronFailure: vi.fn() }))
vi.mock('@/lib/youtube/competitor-sync-batch', () => ({ runCompetitorBatch: vi.fn(), batchHealth: vi.fn(() => ({ ok: true })) }))

import { GET } from '@/app/api/cron/sync-youtube/route'
import { revalidateTag, revalidatePath } from 'next/cache'
import { runCompetitorBatch } from '@/lib/youtube/competitor-sync-batch'

const batch = vi.mocked(runCompetitorBatch), tag = vi.mocked(revalidateTag)
const req = () => new NextRequest('http://localhost/api/cron/sync-youtube?mode=competitors', { headers: { authorization: 'Bearer test-secret' } })
const result = (o: { synced: number; errors: number; siteIds: string[] }) => ({ skipped: 0, remainingDue: 0, stoppedForTime: false, ...o })

describe('cron de competidores invalida o cache do Observatório', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('CRON_SECRET', 'test-secret'); vi.stubEnv('YOUTUBE_API_KEY', 'yt-key') })

  it('nada sincronizado: nenhuma tag invalidada', async () => {
    batch.mockResolvedValue(result({ synced: 0, errors: 0, siteIds: [] }))
    expect((await GET(req())).status).toBe(200)
    expect(tag).not.toHaveBeenCalled()
  })
  it('uma tag por site tocado, com expire 0', async () => {
    batch.mockResolvedValue(result({ synced: 2, errors: 0, siteIds: ['s1', 's2'] }))
    await GET(req())
    expect(tag.mock.calls).toEqual([['observatorio:s1', { expire: 0 }], ['observatorio:s2', { expire: 0 }]])
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/cms/youtube/competitors', 'layout')
  })
  it('só erros (dado parcial gravado): invalida mesmo com synced 0', async () => {
    batch.mockResolvedValue(result({ synced: 0, errors: 1, siteIds: ['s1'] }))
    await GET(req())
    expect(tag.mock.calls).toEqual([['observatorio:s1', { expire: 0 }]])
  })
  it('a resposta do cron não ganha o campo siteIds', async () => {
    batch.mockResolvedValue(result({ synced: 1, errors: 0, siteIds: ['s1'] }))
    const body = await (await GET(req())).json()
    expect(body).toMatchObject({ mode: 'competitors', synced: 1 })
    expect('siteIds' in body).toBe(false)
  })
  it('o lote lançou: erro registrado, nenhuma tag', async () => {
    batch.mockRejectedValue(new Error('competitor batch: timeout'))
    expect((await GET(req())).status).toBe(500)
    expect(tag).not.toHaveBeenCalled()
  })
})

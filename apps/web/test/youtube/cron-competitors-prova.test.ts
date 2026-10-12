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
vi.mock('@/lib/youtube/competitor-sync-batch', () => ({ runCompetitorBatch: vi.fn(), batchHealth: vi.fn(() => ({ ok: true })), BATCH_BUDGET_MS: 200_000 }))
vi.mock('@/lib/youtube/competitor-health', () => ({ schemaReady: vi.fn(), readSiteHealth: vi.fn() }))

import { GET } from '@/app/api/cron/sync-youtube/route'
import { revalidateTag } from 'next/cache'
import { runCompetitorBatch, batchHealth } from '@/lib/youtube/competitor-sync-batch'
import { schemaReady, readSiteHealth } from '@/lib/youtube/competitor-health'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'

void batchHealth; void readSiteHealth // a Tarefa 13 acrescenta testes que usam os dois

const req = () => new NextRequest('http://localhost/api/cron/sync-youtube?mode=competitors', { headers: { authorization: 'Bearer test-secret' } })

describe('cron de concorrentes: guarda de schema', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('CRON_SECRET', 'test-secret'); vi.stubEnv('YOUTUBE_API_KEY', 'yt-key') })
  it('migration ausente: para antes do lote, grava a falha com o texto, não invalida nada', async () => {
    vi.mocked(schemaReady).mockResolvedValue('migration MG1 não aplicada (competitor_videos): column does not exist. Nada foi gravado.')
    const res = await GET(req())
    expect(res.status).toBe(500)
    expect(vi.mocked(runCompetitorBatch)).not.toHaveBeenCalled()
    expect(vi.mocked(recordCronFailure)).toHaveBeenCalledWith('sync-youtube-competitors', 'migration MG1 não aplicada (competitor_videos): column does not exist. Nada foi gravado.')
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
    expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled()
    expect((await res.json()).error).toMatch(/MG1/)
  })
  it('a guarda pergunta pelo que a etapa em produção precisa', async () => {
    vi.mocked(schemaReady).mockResolvedValue('x')
    await GET(req())
    expect(vi.mocked(schemaReady)).toHaveBeenCalledWith(expect.anything(), 'e1e2') // a E2 (Tarefa 10) lê colunas e tabelas da MG2: a guarda confere as duas
  })
  it('MG1 aplicada e MG2 não: o cron fica vermelho com o texto da MG2 e o lote não é chamado', async () => {
    vi.mocked(schemaReady).mockImplementation(async (_sb, need) => (need === 'e1e2' ? 'migration MG2 não aplicada (competitor_videos): column competitor_videos.series_tier does not exist. Nada foi gravado.' : null))
    const res = await GET(req())
    expect(res.status).toBe(500)
    expect(vi.mocked(runCompetitorBatch)).not.toHaveBeenCalled()
    expect(vi.mocked(recordCronFailure)).toHaveBeenCalledWith('sync-youtube-competitors', expect.stringMatching(/MG2/))
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
    expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled()
    expect((await res.json()).error).toMatch(/MG2/)
  })
  it('a guarda que passa (null) deixa o lote rodar', async () => {
    vi.mocked(schemaReady).mockResolvedValue(null)
    vi.mocked(runCompetitorBatch).mockResolvedValue({ synced: 0, siteIds: [] } as never)
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(vi.mocked(runCompetitorBatch)).toHaveBeenCalledTimes(1)
  })
})

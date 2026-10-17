import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockChannelAccountId } = vi.hoisted(() => ({ mockChannelAccountId: vi.fn() }))
vi.mock('@/lib/youtube/channel-account', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/channel-account')>()),
  channelAccountIdForVideo: mockChannelAccountId,
}))
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
const { fanOut } = vi.hoisted(() => ({ fanOut: vi.fn() }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdminsDetailed: fanOut }))
vi.mock('@/lib/youtube/ab-preflight', () => ({ preflightTokenCheck: vi.fn() }))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/lib/youtube/ab-rotation', () => ({ getNextVariantIndex: vi.fn() }))
vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn().mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg' }),
  fetchVariantImageBuffer: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-metadata', () => ({ updateVideoMetadata: vi.fn() }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/cron-health', () => ({
  recordCronSuccess: vi.fn().mockResolvedValue(undefined),
  recordCronFailure: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
// T8: a 3ª falha PEDE settleOnAir(original, falha_api); o contrato dele está em ab-settle.test.ts.
vi.mock('@/lib/youtube/ab-settle', async (orig) => {
  const { settleOnAirFalso } = await import('./helpers/montar-saida-automatica')
  return { ...(await orig<typeof import('@/lib/youtube/ab-settle')>()), settleOnAir: settleOnAirFalso }
})

import { GET } from '@/app/api/cron/ab-rotate/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { preflightTokenCheck } from '@/lib/youtube/ab-preflight'
import { createNotification } from '@/lib/notifications/create'
import { getNextVariantIndex } from '@/lib/youtube/ab-rotation'
import {
  setThumbnail,
  fetchVariantImageBuffer,
} from '@/lib/youtube/ab-youtube'
import { updateVideoMetadata } from '@/lib/youtube/ab-metadata'
import { startAbTestInternal } from '@/lib/youtube/ab-start'
import { recordCronSuccess } from '@/lib/cron-health'
import * as Sentry from '@sentry/nextjs'
import { fakeOwnerClient, rootOrgWithAdmin, OWNER_TABLES } from './helpers/fake-owner-db'
import { cadeiaUpdate } from './helpers/cadeia-update'
import { settleOnAirFalso } from './helpers/montar-saida-automatica'
import { YouTubeApiError } from '@/lib/youtube/youtube-api-error'
import type { FiltroRegistrado } from './helpers/cadeia-update'

function createCronRequest(secret: string) {
  return new NextRequest(new URL('http://localhost:3000/api/cron/ab-rotate'), {
    headers: { authorization: `Bearer ${secret}` },
  })
}

function makeTest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-1',
    name: 'Teste do Lab',
    restore_seq: 0,
    youtube_video_id: 'db-video-1',
    site_id: 'site-1',
    status: 'active',
    test_type: 'thumbnail',
    config: { rotation_pattern: 'abba' },
    original_title: 'Original Title',
    variants: [
      { id: 'v1', sort_order: 0, blob_url: 'https://abc.public.blob.vercel-storage.com/thumb-a.jpg' },
      { id: 'v2', sort_order: 1, blob_url: 'https://abc.public.blob.vercel-storage.com/thumb-b.jpg' },
    ],
    ...overrides,
  }
}

interface BuildMockOpts {
  tests?: unknown[]
  queuedTests?: unknown[]
  video?: { youtube_video_id: string; channel_id?: string } | null
  cycleCount?: number
  alreadyRotatedToday?: boolean
  channel?: { channel_id: string } | null
  /** false = sem org_admin na organização raiz. */
  withOwner?: boolean
  /** Linhas devolvidas pela reivindicação (`[]` = outro escritor ganhou). */
  reivindicadas?: Array<{ restore_seq: number }>
  /** Retorno de ab_rotate_commit (nulo = reivindicação perdida depois da escrita). */
  commit?: string | null
  /** restore_seq que a releitura antes de cada escrita encontra (≠ 1 = alguém reivindicou no meio). */
  seqNaReleitura?: number
}

function buildSupabaseMock(opts: BuildMockOpts = {}) {
  const {
    tests = [],
    queuedTests = [],
    video = { youtube_video_id: 'YT_VIDEO_123', channel_id: 'ch-1' },
    cycleCount = 0,
    alreadyRotatedToday = false,
    channel = { channel_id: 'UCpt' },
    withOwner = true,
    reivindicadas = [{ restore_seq: 1 }],
    commit = 'ciclo-novo',
    seqNaReleitura = 1,
  } = opts
  const owners = fakeOwnerClient(withOwner ? rootOrgWithAdmin('site-1') : {}, { 'owner-1': 'dono@x.com' })

  const updateCalls: { table: string; data: unknown; filters: FiltroRegistrado[] }[] = []
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = []
  const insertCalls: { table: string; data: unknown }[] = []
  let cyclesSelectCallCount = 0

  let abTestsSelectCount = 0
  const fromMock = vi.fn((table: string) => {
    if (table === 'ab_tests') {
      abTestsSelectCount++
      // First select = queued tests query, second = active tests
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn((_col: string, _val: string) => {
            if (_val === 'queued') {
              return { not: vi.fn().mockReturnValue({ lte: vi.fn().mockResolvedValue({ data: queuedTests }) }) }
            }
            // `{ data }` é a leitura dos ativos; `.single()` é a releitura de restore_seq antes de cada escrita.
            return { data: tests, single: vi.fn().mockResolvedValue({ data: { restore_seq: seqNaReleitura, config: (tests[0] as { config?: unknown } | undefined)?.config }, error: null }) }
          }),
        }),
        update: vi.fn((data: unknown) => cadeiaUpdate(data, {
          reivindicadas,
          registrar: (r) => updateCalls.push({ table, data: r.data, filters: r.filtros }),
        })),
      }
    }

    if (table === 'youtube_videos') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: video, error: null }),
          }),
        }),
      }
    }

    if (table === 'youtube_channels') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: channel, error: channel ? null : { message: 'not found' } }),
          }),
        }),
      }
    }

    if (table === 'ab_test_cycles') {
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        select: vi.fn().mockImplementation((cols?: string) => {
          // Leitura do ciclo aberto no fecho (M-2): fora da paridade impar/par abaixo.
          if (cols === 'started_at') return { eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }) }
          cyclesSelectCallCount++
          if (cyclesSelectCallCount % 2 === 1) {
            // Odd calls = idempotency check (select('id').eq.gte.limit.maybeSingle)
            return {
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: alreadyRotatedToday ? { id: 'existing-cycle' } : null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }
          }
          // Even calls = cycle count (select('*', { count }).eq.not)
          return {
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ count: cycleCount, data: null, error: null }),
            }),
          }
        }),
        insert: vi.fn((data: unknown) => {
          insertCalls.push({ table, data })
          return Promise.resolve({ data: null, error: null })
        }),
      }
    }

    if (table === 'ab_test_polls') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }
    }

    if (OWNER_TABLES.has(table)) return owners.from(table)

    // Fallback
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  })

  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === 'ab_rotate_commit') {
      rpcCalls.push({ name, args })
      return { data: commit, error: null }
    }
    return (owners.rpc as (n: string, a: Record<string, unknown>) => Promise<unknown>)(name, args)
  })
  const client = { from: fromMock, rpc, auth: owners.auth }
  ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client)

  return { client, fromMock, updateCalls, insertCalls, rpcCalls }
}

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret')
  vi.stubEnv('LINKS_SHORT_DOMAIN', 'go.test.com')
  vi.clearAllMocks()
  settleOnAirFalso.mockResolvedValue({ resultado: 'feito', campos: {} })
  mockChannelAccountId.mockResolvedValue('UCpt')
  fanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
  ;(preflightTokenCheck as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    accessToken: 'fresh-token-123',
  })
  ;(getNextVariantIndex as ReturnType<typeof vi.fn>).mockReturnValue(1)
  ;(fetchVariantImageBuffer as ReturnType<typeof vi.fn>).mockResolvedValue({
    buffer: Buffer.from('img'),
    contentType: 'image/jpeg',
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/cron/ab-rotate', () => {
  it('returns 401 when no auth header', async () => {
    const req = new NextRequest(
      new URL('http://localhost:3000/api/cron/ab-rotate')
    )
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('returns 401 with wrong secret', async () => {
    const req = createCronRequest('wrong-secret')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('returns { processed: 0 } when no active tests', async () => {
    buildSupabaseMock({ tests: [] })
    const req = createCronRequest('test-secret')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(0)
  })

  it('rotates a thumbnail test', async () => {
    const test = makeTest({ test_type: 'thumbnail' })
    buildSupabaseMock({ tests: [test] })

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.processed).toBe(1)
    expect(fetchVariantImageBuffer).toHaveBeenCalledWith(
      'https://abc.public.blob.vercel-storage.com/thumb-b.jpg'
    )
    expect(setThumbnail).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      expect.any(Buffer),
      'image/jpeg',
      'fresh-token-123'
    )
    expect(updateVideoMetadata).not.toHaveBeenCalled()
  })

  it('rotates a title test', async () => {
    const test = makeTest({
      test_type: 'title',
      variants: [
        { id: 'v1', sort_order: 0, title_text: 'Title A' },
        { id: 'v2', sort_order: 1, title_text: 'Title B' },
      ],
    })
    buildSupabaseMock({ tests: [test] })

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.processed).toBe(1)
    expect(updateVideoMetadata).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      'Title B',
      'fresh-token-123'
    )
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('rotates a combo test', async () => {
    const test = makeTest({
      test_type: 'combo',
      variants: [
        {
          id: 'v1',
          sort_order: 0,
          blob_url: 'https://abc.public.blob.vercel-storage.com/a.jpg',
          title_text: 'Title A',
        },
        {
          id: 'v2',
          sort_order: 1,
          blob_url: 'https://abc.public.blob.vercel-storage.com/b.jpg',
          title_text: 'Title B',
        },
      ],
    })
    buildSupabaseMock({ tests: [test] })

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.processed).toBe(1)
    expect(setThumbnail).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      expect.any(Buffer),
      'image/jpeg',
      'fresh-token-123'
    )
    expect(updateVideoMetadata).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      'Title B',
      'fresh-token-123'
    )
  })

  it('skips rotation and sends notification when preflight fails', async () => {
    const test = makeTest()
    buildSupabaseMock({ tests: [test] })
    ;(preflightTokenCheck as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      reason: 'token_invalid_401',
    })

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.processed).toBe(0)
    expect(body.errors).toBe(0)
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: 'site-1',
        type: 'youtube.token_invalid',
        domain: 'youtube',
        priority: 1,
        title: 'Token YouTube inválido',
        message: expect.stringContaining('token_invalid_401'),
        user_id: 'owner-1',
      })
    )
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()
  })

  it('token inválido sem org_admin na raiz: pula o teste, não notifica e registra sem_destinatario no log', async () => {
    buildSupabaseMock({ tests: [makeTest()], withOwner: false })
    ;(preflightTokenCheck as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, reason: 'token_invalid_401' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const res = await GET(createCronRequest('test-secret'))
    const body = await res.json()

    expect(body.processed).toBe(0)
    expect(createNotification).not.toHaveBeenCalled()
    expect(warn.mock.calls.some((c) => String(c[0]).includes('sem_destinatario'))).toBe(true)
    warn.mockRestore()
  })

  it('canal do vídeo não identificado: erro deste teste, sem preflight/token, e o próximo teste segue', async () => {
    buildSupabaseMock({ tests: [makeTest()] })
    mockChannelAccountId.mockResolvedValue(null)

    const body = await (await GET(createCronRequest('test-secret'))).json()

    expect(body.errors).toBe(1)
    expect(body.processed).toBe(0)
    expect(preflightTokenCheck).not.toHaveBeenCalled()
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('uses rotation_pattern from config', async () => {
    const test = makeTest({
      config: { rotation_pattern: 'round_robin' },
    })
    buildSupabaseMock({ tests: [test], cycleCount: 3 })

    const req = createCronRequest('test-secret')
    await GET(req)

    expect(getNextVariantIndex).toHaveBeenCalledWith('round_robin', 2, 4)
  })

  it('skips test if already rotated today (idempotency)', async () => {
    const test = makeTest()
    buildSupabaseMock({ tests: [test], alreadyRotatedToday: true })

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.processed).toBe(0)
    expect(preflightTokenCheck).not.toHaveBeenCalled()
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()
  })

  it('skips test when getNextVariantIndex returns out-of-bounds index', async () => {
    const test = makeTest()
    buildSupabaseMock({ tests: [test] })
    ;(getNextVariantIndex as ReturnType<typeof vi.fn>).mockReturnValue(99)

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.processed).toBe(0)
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()
  })

  it('marcador velho (queda anterior): registra no Sentry, reivindica aceitando exatamente esse marcador e rotaciona', async () => {
    const test = makeTest({ last_applied_variant_id: 'variant-123' })
    const { updateCalls } = buildSupabaseMock({ tests: [test] })

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.processed).toBe(1)
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining('write-ahead marker'), 'warning')
    const reivindicacao = updateCalls.find((c) => (c.data as Record<string, unknown>).restore_seq === 1)
    expect(reivindicacao?.filters).toContainEqual({ col: 'last_applied_variant_id', op: 'eq', valor: 'variant-123' })
    expect(setThumbnail).toHaveBeenCalled()
  })

  it('reivindicação sem linhas (outro escritor ganhou): não escreve no YouTube, não abre ciclo e não conta erro', async () => {
    const test = makeTest()
    const { rpcCalls } = buildSupabaseMock({ tests: [test], reivindicadas: [] })

    const body = await (await GET(createCronRequest('test-secret'))).json()

    expect(body).toMatchObject({ processed: 0, errors: 0 })
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()
    expect(rpcCalls).toHaveLength(0)
  })

  it('fecho devolve nulo (pausa entre a escrita e o fecho): sem erro de rotação, Sentry e aviso aos admins', async () => {
    const test = makeTest()
    buildSupabaseMock({ tests: [test], commit: null })

    const body = await (await GET(createCronRequest('test-secret'))).json()

    expect(body).toMatchObject({ processed: 0, errors: 0 })
    expect(Sentry.captureMessage).toHaveBeenCalledWith('ab-rotate: reivindicação perdida depois da escrita', expect.anything())
    expect(fanOut).toHaveBeenCalledWith(expect.objectContaining({ siteId: 'site-1', message: expect.stringContaining('a rotação e uma pausa se cruzaram') }))
  })

  it('o fecho vai para ab_rotate_commit com o seq reivindicado, a variante e o número do ciclo de escolha', async () => {
    const test = makeTest()
    const { rpcCalls } = buildSupabaseMock({ tests: [test], cycleCount: 3 })

    await GET(createCronRequest('test-secret'))

    expect(rpcCalls).toEqual([{ name: 'ab_rotate_commit', args: expect.objectContaining({ p_test_id: 'test-1', p_seq: 1, p_variant_id: 'v2', p_cycle_number: 4 }) }])
  })

  it('records cron health even with 0 active tests', async () => {
    buildSupabaseMock({ tests: [] })

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.processed).toBe(0)
    expect(recordCronSuccess).toHaveBeenCalledWith('ab-rotate', 'critical')
  })

  it('YouTube recusa sem escrever nada: limpa o marcador (com a guarda do seq) e soma a falha', async () => {
    const test = makeTest({ test_type: 'thumbnail' })
    const { updateCalls } = buildSupabaseMock({ tests: [test] })
    ;(setThumbnail as ReturnType<typeof vi.fn>).mockRejectedValue(
      new YouTubeApiError(401, 'authError', 'thumbnails.set')
    )

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.errors).toBe(1)
    expect(body.processed).toBe(0)

    // Reivindicou antes de escrever (restore_seq + marcador)
    expect(updateCalls).toContainEqual(
      expect.objectContaining({
        table: 'ab_tests',
        data: expect.objectContaining({ restore_seq: 1, last_applied_variant_id: 'v2' }),
      }),
    )

    // Y-D9: nada foi escrito, o marcador volta a nulo, só se o restore_seq ainda é o reivindicado
    const limpeza = updateCalls.find((c) => JSON.stringify(c.data) === JSON.stringify({ last_applied_variant_id: null }))
    expect(limpeza?.filters).toContainEqual({ col: 'restore_seq', op: 'eq', valor: 1 })

    // consecutive_failures incremented
    expect(updateCalls).toContainEqual(
      expect.objectContaining({
        table: 'ab_tests',
        data: expect.objectContaining({
          config: expect.objectContaining({ consecutive_failures: 1 }),
        }),
      }),
    )
  })

  it('processes queued test when queue_start_after has passed', async () => {
    const queued = {
      id: 'queued-1',
      site_id: 'site-1',
      youtube_video_id: 'db-video-q1',
      name: 'Queued Test',
      queue_start_after: new Date(Date.now() - 60_000).toISOString(),
    }
    const { updateCalls } = buildSupabaseMock({ queuedTests: [queued] })
    ;(startAbTestInternal as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    expect(res.status).toBe(200)

    // Status flipped to draft
    expect(updateCalls).toContainEqual(
      expect.objectContaining({
        table: 'ab_tests',
        data: { status: 'draft', queue_start_after: null },
      }),
    )
    // startAbTestInternal called with correct args
    expect(startAbTestInternal).toHaveBeenCalledWith('queued-1', 'site-1')
  })

  it('reverts queued test to queued status on start failure', async () => {
    const queued = {
      id: 'queued-2',
      site_id: 'site-1',
      youtube_video_id: 'db-video-q2',
      name: 'Queued Fail',
      queue_start_after: new Date(Date.now() - 60_000).toISOString(),
    }
    const { updateCalls } = buildSupabaseMock({ queuedTests: [queued] })
    const startError = new Error('YouTube token expired')
    ;(startAbTestInternal as ReturnType<typeof vi.fn>).mockRejectedValue(startError)

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    expect(res.status).toBe(200)

    // Status reverted to queued
    expect(updateCalls).toContainEqual(
      expect.objectContaining({
        table: 'ab_tests',
        data: { status: 'queued', queue_start_after: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) }, // Y-D5: nunca nulo
      }),
    )
    // Sentry captured the exception
    expect(Sentry.captureException).toHaveBeenCalledWith(
      startError,
      expect.objectContaining({ extra: { testId: 'queued-2', context: 'queue-start' } }),
    )
  })

  it('teste antigo de tipo fora dos três: pausa uma vez com status_note, sem ciclo e sem escrever no YouTube', async () => {
    const test = makeTest({ test_type: 'description' })
    const { updateCalls, insertCalls } = buildSupabaseMock({ tests: [test] })

    const res = await GET(createCronRequest('test-secret'))
    const body = await res.json()

    expect(body.processed).toBe(0)
    expect(insertCalls.filter(c => c.table === 'ab_test_cycles')).toHaveLength(0)
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()
    const pausas = updateCalls.filter(c => c.table === 'ab_tests'
      && (c.data as { status?: string }).status === 'paused')
    expect(pausas).toHaveLength(1)
    expect((pausas[0].data as { status_note: string }).status_note).toContain('fora de uso')
    // sem marcador de escrita antecipada
    expect(updateCalls.some(c => 'last_applied_variant_id' in (c.data as object))).toBe(false)
  })

  it('auto-pauses test after 3 consecutive failures', async () => {
    const test = makeTest({
      test_type: 'thumbnail',
      config: { rotation_pattern: 'abba', consecutive_failures: 2 },
    })
    const { updateCalls } = buildSupabaseMock({ tests: [test] })
    ;(setThumbnail as ReturnType<typeof vi.fn>).mockRejectedValue(
      new YouTubeApiError(401, 'authError', 'thumbnails.set')
    )

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.errors).toBe(1)
    expect(body.processed).toBe(0)

    // Terceira falha: a saída é PEDIDA a settleOnAir (volta ao original e pausa numa só reivindicação); a fase não grava a pausa
    expect(settleOnAirFalso).toHaveBeenCalledTimes(1)
    expect(settleOnAirFalso).toHaveBeenCalledWith('test-1', expect.objectContaining({
      siteId: 'site-1', destino: { tipo: 'original' }, motivo: 'falha_api', consecutiveFailures: 3,
    }))
    expect(updateCalls.some((c) => (c.data as { status?: string }).status === 'paused')).toBe(false)
  })

  it('does not process queued tests with future queue_start_after', async () => {
    // The query uses .lte('queue_start_after', now), so future tests are NOT returned by DB
    buildSupabaseMock({ queuedTests: [], tests: [] })

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.processed).toBe(0)
    expect(startAbTestInternal).not.toHaveBeenCalled()
  })

  it('processes multiple queued tests in one run', async () => {
    const queued1 = {
      id: 'queued-a',
      site_id: 'site-1',
      youtube_video_id: 'db-video-qa',
      name: 'Queued A',
      queue_start_after: new Date(Date.now() - 120_000).toISOString(),
    }
    const queued2 = {
      id: 'queued-b',
      site_id: 'site-1',
      youtube_video_id: 'db-video-qb',
      name: 'Queued B',
      queue_start_after: new Date(Date.now() - 60_000).toISOString(),
    }
    const { updateCalls } = buildSupabaseMock({ queuedTests: [queued1, queued2], tests: [] })
    ;(startAbTestInternal as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    expect(res.status).toBe(200)

    // Both queued tests should be started
    expect(startAbTestInternal).toHaveBeenCalledTimes(2)
    expect(startAbTestInternal).toHaveBeenCalledWith('queued-a', 'site-1')
    expect(startAbTestInternal).toHaveBeenCalledWith('queued-b', 'site-1')

    // Both should have status changed to draft (each update generates 2 eq calls)
    expect(updateCalls.filter(c =>
      c.table === 'ab_tests' &&
      (c.data as Record<string, unknown>).status === 'draft'
    ).length).toBeGreaterThanOrEqual(2)
  })

  it('combo: título falha depois da thumbnail → conta a falha, mantém o marcador e não abre ciclo', async () => {
    const test = makeTest({
      test_type: 'combo',
      variants: [
        {
          id: 'v1',
          sort_order: 0,
          blob_url: 'https://abc.public.blob.vercel-storage.com/a.jpg',
          title_text: 'Title A',
        },
        {
          id: 'v2',
          sort_order: 1,
          blob_url: 'https://abc.public.blob.vercel-storage.com/b.jpg',
          title_text: 'Title B',
        },
      ],
    })
    const { updateCalls } = buildSupabaseMock({ tests: [test] })

    // Thumbnail succeeds, metadata throws
    ;(setThumbnail as ReturnType<typeof vi.fn>).mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg' })
    ;(updateVideoMetadata as ReturnType<typeof vi.fn>).mockRejectedValue(
      new YouTubeApiError(401, 'authError', 'videos.update')
    )

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.errors).toBe(1)
    expect(body.processed).toBe(0)

    // Reivindicou antes de escrever; a escrita foi parcial (thumbnail ok, título não): o marcador FICA
    expect(updateCalls).toContainEqual(
      expect.objectContaining({
        table: 'ab_tests',
        data: expect.objectContaining({ restore_seq: 1, last_applied_variant_id: 'v2' }),
      }),
    )
    expect(updateCalls.some((c) => JSON.stringify(c.data) === JSON.stringify({ last_applied_variant_id: null }))).toBe(false)

    // consecutive_failures incremented
    expect(updateCalls).toContainEqual(
      expect.objectContaining({
        table: 'ab_tests',
        data: expect.objectContaining({
          config: expect.objectContaining({ consecutive_failures: 1 }),
        }),
      }),
    )

    // Thumbnail WAS called (succeeded before metadata failed)
    expect(setThumbnail).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      expect.any(Buffer),
      'image/jpeg',
      'fresh-token-123',
    )
  })
})

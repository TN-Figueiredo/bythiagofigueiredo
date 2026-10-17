import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Degrau "administrar o site": estes testes rodam como quem administra (o dono).
// A recusa da editora e o erro da RPC ficam em test/cms/site-admin-step-*.test.ts.
vi.mock('@/lib/cms/auth-guards', () => ({
  requireSiteAdminScope: async () => ({ ok: true, user: { id: 'user-1' } }),
  denyUnlessSiteAdmin: async () => null,
  siteAdminOnlyMessage: (acao: string) => `Só quem administra o site pode ${acao}.`,
  requireSiteAdminForRow: async () => ({ siteId: 'site-1' }),
}))

const { mockChannelAccountId } = vi.hoisted(() => ({ mockChannelAccountId: vi.fn() }))
vi.mock('@/lib/youtube/channel-account', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/channel-account')>()),
  channelAccountIdForVideo: mockChannelAccountId,
}))

// Mock modules before imports
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/youtube/ab-preflight', () => ({ preflightTokenCheck: vi.fn() }))
vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn().mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg' }),
  fetchVariantImageBuffer: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-metadata', () => ({ updateVideoMetadata: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/ab-rotation', () => ({ getNextVariantIndex: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }),
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('next/cache', () => ({
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))
const { fanOut } = vi.hoisted(() => ({ fanOut: vi.fn() }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdminsDetailed: fanOut }))
vi.mock('@/lib/youtube/ab-types', () => ({
  AB_TEST_CONFIG_DEFAULTS: {},
  VARIANT_LABELS: ['A', 'B', 'C', 'D'],
}))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/links/auto-link', () => ({ ensureTrackedLink: vi.fn() }))
vi.mock('@/lib/youtube/scoring', () => ({ getChannelTier: vi.fn() }))
vi.mock('@/lib/youtube/prompt-scoring', () => ({ scoreForPrompt: vi.fn() }))

import { forceRotate } from '@/app/cms/(authed)/youtube/ab-lab/actions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { preflightTokenCheck } from '@/lib/youtube/ab-preflight'
import * as Sentry from '@sentry/nextjs'
import { getNextVariantIndex } from '@/lib/youtube/ab-rotation'
import {
  setThumbnail,
  fetchVariantImageBuffer,
} from '@/lib/youtube/ab-youtube'
import { updateVideoMetadata } from '@/lib/youtube/ab-metadata'
import { revalidatePath, revalidateTag } from 'next/cache'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { cadeiaUpdate } from './helpers/cadeia-update'
import type { FiltroRegistrado } from './helpers/cadeia-update'

function makeTest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-1',
    name: 'Teste do Lab',
    restore_seq: 0,
    last_applied_variant_id: null,
    youtube_video_id: 'db-video-1',
    site_id: 'site-1',
    status: 'active',
    test_type: 'thumbnail',
    config: { rotation_pattern: 'abba' },
    original_title: 'Original Title',
    variants: [
      { id: 'v1', sort_order: 0, blob_url: 'https://abc.public.blob.vercel-storage.com/thumb-a.jpg', is_original: true, title_text: null },
      { id: 'v2', sort_order: 1, blob_url: 'https://abc.public.blob.vercel-storage.com/thumb-b.jpg', is_original: false, title_text: null },
    ],
    ...overrides,
  }
}

interface BuildMockOpts {
  test?: unknown | null
  video?: { youtube_video_id: string; channel_id: string } | null
  channel?: { channel_id: string } | null
  cycleCount?: number
  /** Linhas devolvidas pela reivindicação (`[]` = outro escritor ganhou). */
  reivindicadas?: Array<{ restore_seq: number }>
  /** Retorno de ab_rotate_commit (nulo = reivindicação perdida depois da escrita). */
  commit?: string | null
  /** restore_seq que a releitura antes de cada escrita encontra. */
  seqNaReleitura?: number
}

function buildSupabaseMock(opts: BuildMockOpts = {}) {
  const {
    test = makeTest(),
    video = { youtube_video_id: 'YT_VIDEO_123', channel_id: 'ch-1' },
    channel = { channel_id: 'UC_CHANNEL_123' },
    cycleCount = 0,
    reivindicadas = [{ restore_seq: 1 }],
    commit = 'ciclo-novo',
    seqNaReleitura = 1,
  } = opts

  const updateCalls: { table: string; data: unknown; filters: FiltroRegistrado[] }[] = []
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = []
  const insertCalls: { table: string; data: unknown }[] = []

  const fromMock = vi.fn((table: string) => {
    if (table === 'ab_tests') {
      return {
        // 3 eq + single = leitura do teste; 1 eq + single = releitura de restore_seq antes de cada escrita
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { restore_seq: seqNaReleitura }, error: null }),
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: test, error: test ? null : { message: 'not found' } }),
              }),
            }),
          }),
        }),
        update: vi.fn((data: unknown) => cadeiaUpdate(data, {
          reivindicadas,
          registrar: (r) => updateCalls.push({ table: 'ab_tests', data: r.data, filters: r.filtros }),
        })),
      }
    }

    if (table === 'youtube_videos') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: video, error: video ? null : { message: 'not found' } }),
          }),
        }),
      }
    }

    if (table === 'youtube_channels') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: channel, error: null }),
          }),
        }),
      }
    }

    if (table === 'ab_test_cycles') {
      return {
        select: vi.fn((cols?: string) => cols === 'started_at' ? { eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }) } : {
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ count: cycleCount, data: null, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        insert: vi.fn((data: unknown) => {
          insertCalls.push({ table: 'ab_test_cycles', data })
          return Promise.resolve({ data: null, error: null })
        }),
      }
    }

    if (table === 'ab_test_polls') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }),
            }),
          }),
        }),
      }
    }

    // Fallback
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  })

  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    rpcCalls.push({ name, args })
    return { data: commit, error: null }
  })
  const client = { from: fromMock, rpc }
  ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client)

  return { client, fromMock, updateCalls, insertCalls, rpcCalls }
}

beforeEach(() => {
  vi.stubEnv('LINKS_SHORT_DOMAIN', 'go.test.com')
  vi.clearAllMocks()
  fanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
  ;(setThumbnail as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg' })
  ;(updateVideoMetadata as ReturnType<typeof vi.fn>).mockReset()
  mockChannelAccountId.mockResolvedValue('UCpt')
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

describe('forceRotate', () => {
  it('happy path: rotates thumbnail test', async () => {
    const test = makeTest({ test_type: 'thumbnail' })
    buildSupabaseMock({ test })

    const result = await forceRotate('test-1')

    expect(result).toMatchObject({ ok: true })
    expect(fetchVariantImageBuffer).toHaveBeenCalledWith('https://abc.public.blob.vercel-storage.com/thumb-b.jpg')
    expect(setThumbnail).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      expect.any(Buffer),
      'image/jpeg',
      'fresh-token-123',
    )
    expect(updateVideoMetadata).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/cms/youtube/ab-lab')
    expect(revalidateTag).toHaveBeenCalledWith('ab-tests', { expire: 0 })
  })

  it('happy path: rotates title test', async () => {
    const test = makeTest({
      test_type: 'title',
      variants: [
        { id: 'v1', sort_order: 0, blob_url: null, is_original: true, title_text: 'Title A' },
        { id: 'v2', sort_order: 1, blob_url: null, is_original: false, title_text: 'Title B' },
      ],
    })
    buildSupabaseMock({ test })

    const result = await forceRotate('test-1')

    expect(result).toMatchObject({ ok: true })
    expect(updateVideoMetadata).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      'Title B',
      'fresh-token-123',
    )
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('happy path: rotates combo test (thumbnail + metadata)', async () => {
    const test = makeTest({
      test_type: 'combo',
      variants: [
        { id: 'v1', sort_order: 0, blob_url: 'https://abc.public.blob.vercel-storage.com/a.jpg', is_original: true, title_text: 'Title A' },
        { id: 'v2', sort_order: 1, blob_url: 'https://abc.public.blob.vercel-storage.com/b.jpg', is_original: false, title_text: 'Title B' },
      ],
    })
    buildSupabaseMock({ test })

    const result = await forceRotate('test-1')

    expect(result).toMatchObject({ ok: true })
    expect(setThumbnail).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      expect.any(Buffer),
      'image/jpeg',
      'fresh-token-123',
    )
    expect(updateVideoMetadata).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      'Title B',
      'fresh-token-123',
    )
  })

  it('teste ativo de tipo antigo (descrição): recusa, sem marcador, sem ciclo e sem escrever no YouTube', async () => {
    const { updateCalls, insertCalls } = buildSupabaseMock({ test: makeTest({ test_type: 'description' }) })

    const result = await forceRotate('test-1')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('A descrição não participa mais do teste A/B')
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()
    expect(updateCalls).toHaveLength(0)
    expect(insertCalls).toHaveLength(0)
  })

  it('returns error when preflight fails', async () => {
    const test = makeTest()
    buildSupabaseMock({ test })
    ;(preflightTokenCheck as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      reason: 'token_invalid_401',
    })

    const result = await forceRotate('test-1')

    expect(result).toMatchObject({ ok: false, error: 'Token inválido: token_invalid_401' })
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()
  })

  it('returns error when test not found', async () => {
    buildSupabaseMock({ test: null })

    const result = await forceRotate('non-existent')

    expect(result).toMatchObject({ ok: false, error: 'Test not found or not active' })
    expect(preflightTokenCheck).not.toHaveBeenCalled()
  })

  it('returns error when test is not active (filtered by status=active query)', async () => {
    // The query filters by status=active, so a paused test returns null
    buildSupabaseMock({ test: null })

    const result = await forceRotate('test-paused')

    expect(result).toMatchObject({ ok: false, error: 'Test not found or not active' })
    expect(preflightTokenCheck).not.toHaveBeenCalled()
  })

  it('reivindica ANTES de escrever (restore_seq + marcador) e fecha por ab_rotate_commit com trigger manual', async () => {
    const test = makeTest({ test_type: 'thumbnail' })
    const { updateCalls, rpcCalls } = buildSupabaseMock({ test })
    ;(setThumbnail as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      // no momento da escrita a reivindicação já foi gravada e o fecho ainda não aconteceu
      expect(updateCalls.filter((c) => c.table === 'ab_tests')).toHaveLength(1)
      expect(rpcCalls).toHaveLength(0)
      return { highUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg' }
    })

    const result = await forceRotate('test-1')

    expect(result).toMatchObject({ ok: true, resultado: 'feito' })
    const abTestUpdates = updateCalls.filter((c) => c.table === 'ab_tests')
    expect(abTestUpdates).toHaveLength(1) // o marcador é limpo pelo ab_rotate_commit, não por update solto
    expect(abTestUpdates[0]!.data).toEqual(expect.objectContaining({ restore_seq: 1, last_applied_variant_id: 'v2' }))
    expect(abTestUpdates[0]!.filters).toEqual(expect.arrayContaining([
      { col: 'status', op: 'eq', valor: 'active' }, { col: 'restore_seq', op: 'eq', valor: 0 }, { col: 'last_applied_variant_id', op: 'is', valor: null },
    ]))
    expect(rpcCalls).toEqual([{ name: 'ab_rotate_commit', args: expect.objectContaining({
      p_test_id: 'test-1', p_seq: 1, p_variant_id: 'v2', p_applied_metadata: expect.objectContaining({ trigger: 'manual' }),
    }) }])
  })

  it('marcador velho (queda anterior): reivindica com marcadorLido = test.last_applied_variant_id e roda', async () => {
    const test = makeTest({ last_applied_variant_id: 'v9' })
    const { updateCalls } = buildSupabaseMock({ test })

    const result = await forceRotate('test-1')

    expect(result).toMatchObject({ ok: true, resultado: 'feito' })
    const reivindicacao = updateCalls.find((c) => (c.data as Record<string, unknown>).restore_seq === 1)!
    expect(reivindicacao.filters).toContainEqual({ col: 'last_applied_variant_id', op: 'eq', valor: 'v9' })
    expect(reivindicacao.filters).not.toContainEqual({ col: 'last_applied_variant_id', op: 'is', valor: null })
  })

  it('R1 DEVE-1: a reivindicação com marcador exige updated_at mais antigo que 360 s (marcador novo = rotação em voo)', async () => {
    const { updateCalls } = buildSupabaseMock({ test: makeTest({ last_applied_variant_id: 'v9' }) })

    await forceRotate('test-1')

    const reivindicacao = updateCalls.find((c) => (c.data as Record<string, unknown>).restore_seq === 1)!
    const corte = reivindicacao.filters.find((f) => f.col === 'updated_at' && f.op === 'lt')
    expect(corte).toBeDefined()
    expect(Date.now() - Date.parse(corte!.valor as string)).toBeGreaterThanOrEqual(359_000)
    expect(Date.now() - Date.parse(corte!.valor as string)).toBeLessThan(362_000)
  })

  it.each([
    ['original com cópia i.ytimg (thumbnail corrente)', 'thumbnail', { id: 'v1', sort_order: 0, blob_url: 'https://i.ytimg.com/vi/x/hqdefault.jpg', is_original: true, title_text: null }, 0],
    ['variante sem blob_url', 'thumbnail', { id: 'v2', sort_order: 1, blob_url: null, is_original: false, title_text: null }, 1],
    ['variante de título sem texto', 'title', { id: 'v2', sort_order: 1, blob_url: null, is_original: false, title_text: '  ' }, 1],
  ])('R1 Phil I-1: %s → não reivindica, não escreve, erro ao dono', async (_nome, tipo, ruim, indiceDaVez) => {
    const base = [
      { id: 'v1', sort_order: 0, blob_url: 'https://abc.public.blob.vercel-storage.com/a.jpg', is_original: true, title_text: 'Title A' },
      { id: 'v2', sort_order: 1, blob_url: 'https://abc.public.blob.vercel-storage.com/b.jpg', is_original: false, title_text: 'Title B' },
    ]
    base[indiceDaVez] = ruim as typeof base[number]
    ;(getNextVariantIndex as ReturnType<typeof vi.fn>).mockReturnValue(indiceDaVez)
    const { updateCalls, rpcCalls } = buildSupabaseMock({ test: makeTest({ test_type: tipo, variants: base }) })

    const result = await forceRotate('test-1')

    expect(result).toMatchObject({ ok: false, resultado: 'erro' })
    expect(updateCalls).toHaveLength(0)
    expect(rpcCalls).toHaveLength(0)
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining('variante sem arquivo/título'), expect.anything())
  })

  it('zero linhas na reivindicação (rotação ou pausa chegou antes): em_andamento, zero escrita', async () => {
    const { rpcCalls } = buildSupabaseMock({ test: makeTest(), reivindicadas: [] })

    const result = await forceRotate('test-1')

    expect(result).toEqual({ ok: false, resultado: 'em_andamento', error: 'Outra tentativa está em andamento. Tente de novo em instantes.' })
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()
    expect(rpcCalls).toHaveLength(0)
  })

  it('teste pausado no meio (restore_seq mudou antes da escrita): não escreve, em_andamento, sem ciclo', async () => {
    const { rpcCalls } = buildSupabaseMock({ test: makeTest(), seqNaReleitura: 7 })

    const result = await forceRotate('test-1')

    expect(result).toMatchObject({ ok: false, resultado: 'em_andamento' })
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(rpcCalls).toHaveLength(0)
  })

  it('pausa entre a escrita e o fecho (rpc devolve nulo): erro com a instrução de conferir o vídeo, aviso aos admins', async () => {
    buildSupabaseMock({ test: makeTest(), commit: null })

    const result = await forceRotate('test-1')

    expect(result).toMatchObject({ ok: false, resultado: 'erro' })
    expect(result.ok === false && result.error).toMatch(/pausa se cruzaram/)
    expect(fanOut).toHaveBeenCalledWith(expect.objectContaining({ siteId: 'site-1', message: expect.stringContaining('a rotação e uma pausa se cruzaram') }))
  })

  it('YouTube recusa sem escrever: limpa o marcador com a guarda do seq e devolve o erro', async () => {
    const { updateCalls, rpcCalls } = buildSupabaseMock({ test: makeTest() })
    ;(setThumbnail as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('YouTube API returned 403: forbidden'))

    const result = await forceRotate('test-1')

    expect(result).toMatchObject({ ok: false, resultado: 'erro', error: expect.stringContaining('403') })
    const limpeza = updateCalls.find((c) => JSON.stringify(c.data) === JSON.stringify({ last_applied_variant_id: null }))!
    expect(limpeza.filters).toContainEqual({ col: 'restore_seq', op: 'eq', valor: 1 })
    expect(rpcCalls).toHaveLength(0)
  })

  it('combo com escrita parcial (thumbnail foi, título recusado): mantém o marcador', async () => {
    const test = makeTest({
      test_type: 'combo',
      variants: [
        { id: 'v1', sort_order: 0, blob_url: 'https://abc.public.blob.vercel-storage.com/a.jpg', is_original: true, title_text: 'Title A' },
        { id: 'v2', sort_order: 1, blob_url: 'https://abc.public.blob.vercel-storage.com/b.jpg', is_original: false, title_text: 'Title B' },
      ],
    })
    const { updateCalls } = buildSupabaseMock({ test })
    ;(updateVideoMetadata as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('YouTube API returned 403: forbidden'))

    const result = await forceRotate('test-1')

    expect(result).toMatchObject({ ok: false, resultado: 'erro' })
    expect(setThumbnail).toHaveBeenCalled()
    expect(updateCalls.some((c) => JSON.stringify(c.data) === JSON.stringify({ last_applied_variant_id: null }))).toBe(false)
  })

  it('applies blob_url even for original variant', async () => {
    const test = makeTest({
      test_type: 'thumbnail',
      variants: [
        { id: 'v1', sort_order: 0, blob_url: 'https://abc.public.blob.vercel-storage.com/original.jpg', is_original: true, title_text: null },
        { id: 'v2', sort_order: 1, blob_url: 'https://abc.public.blob.vercel-storage.com/variant.jpg', is_original: false, title_text: null },
      ],
    })
    buildSupabaseMock({ test })
    // Force rotation to pick the original variant (index 0)
    ;(getNextVariantIndex as ReturnType<typeof vi.fn>).mockReturnValue(0)

    const result = await forceRotate('test-1')

    expect(result).toMatchObject({ ok: true })
    expect(fetchVariantImageBuffer).toHaveBeenCalledWith('https://abc.public.blob.vercel-storage.com/original.jpg')
    expect(setThumbnail).toHaveBeenCalledWith(
      'YT_VIDEO_123',
      expect.any(Buffer),
      'image/jpeg',
      'fresh-token-123',
    )
  })

  it('counts completed cycles BEFORE closing current (nextCycle = count + 1)', async () => {
    const test = makeTest({ test_type: 'thumbnail' })
    // 3 completed cycles already exist
    buildSupabaseMock({ test, cycleCount: 3 })

    await forceRotate('test-1')

    // nextCycle should be 3 + 1 = 4
    expect(getNextVariantIndex).toHaveBeenCalledWith('abba', 2, 4)
  })

  it('returns error when video not found', async () => {
    const test = makeTest()
    buildSupabaseMock({ test, video: null })

    const result = await forceRotate('test-1')

    expect(result).toMatchObject({ ok: false, error: 'Video not found' })
    expect(preflightTokenCheck).not.toHaveBeenCalled()
  })

  it('canal do vídeo não identificado: diz isso, sem "Token inválido" nem chamar o preflight', async () => {
    buildSupabaseMock({ test: makeTest() })
    mockChannelAccountId.mockResolvedValue(null)

    const result = await forceRotate('test-1')

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Could not identify which YouTube channel owns this video/)
    expect(result.error).not.toMatch(/Token inv/)
    expect(preflightTokenCheck).not.toHaveBeenCalled()
  })

  it('returns error when auth check fails', async () => {
    ;(requireSiteScope as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      reason: 'unauthenticated',
    })
    buildSupabaseMock({})

    const result = await forceRotate('test-1')

    expect(result).toMatchObject({ ok: false, error: 'unauthenticated' })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })
})

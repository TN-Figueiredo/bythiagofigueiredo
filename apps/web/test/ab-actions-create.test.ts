import type { TestType } from '@/lib/youtube/ab-types'
import { DESCRICAO_FORA_DO_TESTE } from '@/lib/youtube/ab-schemas'
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import sharp from 'sharp'
import { dhashOf } from '@/lib/youtube/thumb-fingerprint'
import { hqdefaultLike } from '@/lib/youtube/portao-dhash/imagem'

// Mock modules before imports
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/youtube/ab-preflight', () => ({ preflightTokenCheck: vi.fn() }))
vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn().mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg' }),
  fetchVariantImageBuffer: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-metadata', () => ({
  updateVideoMetadata: vi.fn(),
  captureOriginalMetadata: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-rotation', () => ({ getNextVariantIndex: vi.fn(), getVariantForCycle: vi.fn() }))
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
vi.mock('@vercel/blob', () => ({ put: vi.fn(), del: vi.fn() }))
vi.mock('@/lib/youtube/ab-types', async (importActual) => ({
  AB_TEST_CONFIG_DEFAULTS: (await importActual<typeof import('@/lib/youtube/ab-types')>()).AB_TEST_CONFIG_DEFAULTS,
  VARIANT_LABELS: ['A', 'B', 'C', 'D'],
  DRIFT_STATUS_NOTE: 'Thumbnail alterado externamente',
}))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/links/auto-link', () => ({ ensureTrackedLink: vi.fn() }))
vi.mock('@/lib/youtube/scoring', () => ({ getChannelTier: vi.fn() }))
vi.mock('@/lib/youtube/prompt-scoring', () => ({ scoreForPrompt: vi.fn() }))
vi.mock('@/lib/youtube/thumbnail-library', () => ({ autoImportWinner: vi.fn() }))
vi.mock('@/lib/youtube/ab-apply', () => ({ applyVariantToYouTube: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/queries', () => ({
  getVideoTestHistory: vi.fn(),
  getLearnings: vi.fn(),
}))

import { createAbTest } from '@/app/cms/(authed)/youtube/ab-lab/actions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { put, del } from '@vercel/blob'
import { revalidatePath, revalidateTag } from 'next/cache'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import type { AbTestCreateInput } from '@/lib/youtube/ab-types'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { captureOriginalMetadata } from '@/lib/youtube/ab-metadata'

const BLOB_URL = 'https://xxx.blob.vercel-storage.com/ab-originals/uuid/original.jpg'

function makeInput(overrides: Partial<AbTestCreateInput> = {}): AbTestCreateInput {
  return {
    site_id: 'site-1',
    youtube_video_id: 'video-1',
    name: 'Test AB',
    config: {},
    ...overrides,
  } as AbTestCreateInput
}

interface BuildMockOpts {
  /** Canal dono do vídeo (o que `youtube_videos → youtube_channels` devolve). */
  videoOwner?: { channel_id: string } | null
  video?: { id: string; youtube_video_id?: string; duration_seconds: number; thumbnail_hq_url: string | null } | null
  existingTest?: { id: string; status?: string } | null
  /** Resposta da 2ª leitura de teste existente (depois de um 23505 no insert). */
  existingTestDepois?: { id: string; status?: string } | null
  insertTestResult?: { data: { id: string } | null; error: { message: string; code?: string } | null }
  insertVariantResult?: { data: null; error: { message: string } | null }
  /** Resposta da conferência do vídeo de referência (competitor_videos, por chave primária e site). */
  refVideo?: { data: { id: string } | null; error: { code?: string; message: string } | null }
}

function buildSupabaseMock(opts: BuildMockOpts = {}) {
  const {
    video = { id: 'video-1', youtube_video_id: 'abc', duration_seconds: 600, thumbnail_hq_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg' },
    existingTest = null,
    existingTestDepois = null,
    insertTestResult = { data: { id: 'new-test-id' }, error: null },
    insertVariantResult = { data: null, error: null },
    videoOwner = { channel_id: 'UCpt' },
    refVideo = { data: { id: '123e4567-e89b-12d3-a456-426614174000' }, error: null },
  } = opts

  const insertCalls: { table: string; data: unknown }[] = []
  const deleteCalls: { table: string; id: string }[] = []
  const siteFilters: [string, string][] = []
  const statusFiltrados: unknown[] = []
  const selectsDeTeste: Array<{ cols: string; order: unknown }> = []
  let leiturasDeExistente = 0

  const refFiltros: [string, string][] = []
  const fromMock = vi.fn((table: string) => {
    if (table === 'competitor_videos') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn((c: string, v: string) => (refFiltros.push([c, v]), {
            eq: vi.fn((c2: string, v2: string) => (refFiltros.push([c2, v2]), {
              maybeSingle: vi.fn().mockResolvedValue(refVideo),
            })),
          })),
        })),
      }
    }
    if (table === 'youtube_videos') {
      return {
        select: vi.fn((cols: string) => ({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn((c: string, v: string) => (siteFilters.push([c, v]), {
              // Com o site: o vídeo do teste, ou o dono do vídeo (leitura de canal).
              single: vi.fn().mockResolvedValue(
                cols.includes('youtube_channels')
                  ? { data: videoOwner ? { youtube_channels: videoOwner } : null, error: videoOwner ? null : { code: 'PGRST116', message: 'no rows' } }
                  : { data: video, error: video ? null : { message: 'not found' } },
              ),
            })),
            // Leitura só por id: o id do YouTube.
            single: vi.fn().mockResolvedValue({ data: { youtube_video_id: 'YT_VID_PT' }, error: null }),
          }),
        })),
      }
    }

    if (table === 'ab_tests') {
      return {
        select: vi.fn((cols: string) => ({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn((_c: string, v: unknown) => (statusFiltrados.push(v), {
                order: vi.fn((col: string, o: unknown) => (selectsDeTeste.push({ cols, order: [col, o] }), {
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockImplementation(async () => ({
                      data: leiturasDeExistente++ === 0 ? existingTest : existingTestDepois,
                      error: null,
                    })),
                  }),
                })),
              })),
            }),
          }),
        })),
        insert: vi.fn((data: unknown) => {
          insertCalls.push({ table: 'ab_tests', data })
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(insertTestResult),
            }),
          }
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn((col: string, val: string) => {
            deleteCalls.push({ table: 'ab_tests', id: val })
            return Promise.resolve({ data: null, error: null })
          }),
        }),
      }
    }

    if (table === 'ab_test_variants') {
      return {
        insert: vi.fn((data: unknown) => {
          insertCalls.push({ table: 'ab_test_variants', data })
          return Promise.resolve(insertVariantResult)
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

  const client = { from: fromMock }
  ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client)

  return { client, fromMock, insertCalls, deleteCalls, siteFilters, statusFiltrados, refFiltros, selectsDeTeste }
}

let JPEG_1280: Buffer
let JPEG_480: Buffer
let fetchSpy: ReturnType<typeof vi.spyOn>

beforeAll(async () => {
  JPEG_1280 = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#c33' } }).jpeg().toBuffer()
  JPEG_480 = await sharp({ create: { width: 480, height: 360, channels: 3, background: '#39c' } }).jpeg().toBuffer()
})

beforeEach(() => {
  vi.clearAllMocks()

  // Toda variante pública (maxres, sd, hq) responde com um JPEG real 1280x720.
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    new Response(new Uint8Array(JPEG_1280), { status: 200, headers: { 'content-type': 'image/jpeg' } }),
  )
  ;(put as ReturnType<typeof vi.fn>).mockResolvedValue({ url: BLOB_URL })
})

afterEach(() => {
  fetchSpy.mockRestore()
})

describe('createAbTest', () => {
  it('creates test with Blob URL for original thumbnail (not YouTube CDN URL)', async () => {
    const { insertCalls } = buildSupabaseMock({
      video: {
        id: 'video-1',
        youtube_video_id: 'abc',
        duration_seconds: 600,
        thumbnail_hq_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
      },
    })

    const result = await createAbTest(makeInput())

    expect(result).toEqual({ ok: true, id: 'new-test-id' })

    // A cópia guardada vem da maior resolução (maxres), não da hqdefault
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://i.ytimg.com/vi/abc/maxresdefault.jpg',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )

    // Should have uploaded to Vercel Blob
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^ab-originals\/.+\.jpg$/),
      expect.any(Buffer),
      { access: 'public', contentType: 'image/jpeg', addRandomSuffix: true },
    )

    // ab_tests insert should have the blob URL, not the YouTube CDN URL
    const testInsert = insertCalls.find(c => c.table === 'ab_tests')
    expect(testInsert).toBeDefined()
    expect((testInsert!.data as Record<string, unknown>).original_thumbnail_url).toBe(BLOB_URL)
    // A/B Lab P2: o config gravado na criação não carrega mais auto_apply_winner
    expect((testInsert!.data as { config: Record<string, unknown> }).config).not.toHaveProperty('auto_apply_winner')

    // Revalidation
    expect(revalidateTag).toHaveBeenCalledWith('youtube', { expire: 0 })
    expect(revalidatePath).toHaveBeenCalledWith('/cms/youtube/ab-lab')
  })

  it('S8-F4 C-12: insere regra_duracao v2 e teto_explicito false quando o assistente não mexeu no teto', async () => {
    const { insertCalls } = buildSupabaseMock()
    expect((await createAbTest(makeInput({ config: { confidence_threshold: 0.9 } }))).ok).toBe(true)
    const dados = insertCalls.find(c => c.table === 'ab_tests')!.data as { regra_duracao: string; config: Record<string, unknown> }
    expect(dados.regra_duracao).toBe('v2')
    expect(dados.config.teto_explicito).toBe(false)
  })
  it('S8-F4: teto mexido (teto_explicito true + max_duration_days) é preservado; teto sem a flag não vira explícito', async () => {
    const a = buildSupabaseMock()
    await createAbTest(makeInput({ config: { max_duration_days: 12, teto_explicito: true } }))
    expect((a.insertCalls.find(c => c.table === 'ab_tests')!.data as { config: unknown }).config).toMatchObject({ max_duration_days: 12, teto_explicito: true })
    const b = buildSupabaseMock()
    await createAbTest(makeInput({ config: { max_duration_days: 12 } }))
    expect((b.insertCalls.find(c => c.table === 'ab_tests')!.data as { config: unknown }).config).toMatchObject({ teto_explicito: false })
  })
  it('preserves original when URL is ggpht.com', async () => {
    buildSupabaseMock({
      video: {
        id: 'video-1',
        youtube_video_id: 'abc',
        duration_seconds: 600,
        thumbnail_hq_url: 'https://yt3.ggpht.com/thumb',
      },
    })

    const result = await createAbTest(makeInput())

    expect(result).toEqual({ ok: true, id: 'new-test-id' })
    // Should have uploaded to blob
    expect(put).toHaveBeenCalled()
  })

  describe('referência do concorrente (aviso A5 3)', () => {
    const REF_ID = '123e4567-e89b-12d3-a456-426614174000'
    const configGravado = (calls: { table: string; data: unknown }[]) =>
      (calls.find(c => c.table === 'ab_tests')!.data as { config: Record<string, unknown> }).config

    it('referencia válida grava config.referencia com os três campos', async () => {
      const { insertCalls } = buildSupabaseMock()
      const r = await createAbTest(makeInput({ referencia: { refVideoId: REF_ID, refTroca: 'abc:1', tipo: 'title' } }))
      expect(r.ok).toBe(true)
      expect(configGravado(insertCalls).referencia).toEqual({ refVideoId: REF_ID, refTroca: 'abc:1', tipo: 'title' })
    })

    it('campo extra é gravado sem ele; uuid inválido descarta a referência; teste criado nos dois', async () => {
      const a = buildSupabaseMock()
      const extra = { refVideoId: REF_ID, refTroca: null, tipo: 'thumbnail', titulo: 'x', url: 'https://i.ytimg.com/a.jpg' }
      expect((await createAbTest(makeInput({ referencia: extra as never }))).ok).toBe(true)
      expect(configGravado(a.insertCalls).referencia).toEqual({ refVideoId: REF_ID, refTroca: null, tipo: 'thumbnail' })

      const b = buildSupabaseMock()
      expect((await createAbTest(makeInput({ referencia: { refVideoId: 'nao-e-uuid', refTroca: null, tipo: 'title' } }))).ok).toBe(true)
      expect(configGravado(b.insertCalls)).not.toHaveProperty('referencia')
    })

    it('config vindo do cliente não leva `referencia` por fora do Zod', async () => {
      const a = buildSupabaseMock()
      await createAbTest(makeInput({ config: { referencia: { titulo: 'x', url: 'https://i.ytimg.com/a.jpg' } } as never }))
      expect(configGravado(a.insertCalls)).not.toHaveProperty('referencia')

      const b = buildSupabaseMock()
      await createAbTest(makeInput({
        config: { referencia: { titulo: 'x' } } as never,
        referencia: { refVideoId: 'nao-e-uuid', refTroca: null, tipo: 'title' },
      }))
      expect(configGravado(b.insertCalls)).not.toHaveProperty('referencia')

      const c = buildSupabaseMock()
      await createAbTest(makeInput({
        config: { referencia: { titulo: 'x' } } as never,
        referencia: { refVideoId: REF_ID, refTroca: null, tipo: 'title' },
      }))
      expect(configGravado(c.insertCalls).referencia).toEqual({ refVideoId: REF_ID, refTroca: null, tipo: 'title' })
    })

    it('refVideoId inexistente no site: grava nulo (e a troca), mantém o tipo; confere por id e site', async () => {
      const m = buildSupabaseMock({ refVideo: { data: null, error: null } })
      const r = await createAbTest(makeInput({ referencia: { refVideoId: REF_ID, refTroca: 'abc:1', tipo: 'title' } }))
      expect(r.ok).toBe(true)
      expect(configGravado(m.insertCalls).referencia).toEqual({ refVideoId: null, refTroca: null, tipo: 'title' })
      expect(m.refFiltros).toEqual([['id', REF_ID], ['competitor_channels.site_id', 'site-1']])
    })

    it('erro na leitura do vídeo de referência: mantém a referência como veio', async () => {
      const m = buildSupabaseMock({ refVideo: { data: null, error: { code: '57014', message: 'timeout' } } })
      const r = await createAbTest(makeInput({ referencia: { refVideoId: REF_ID, refTroca: 'abc:1', tipo: 'title' } }))
      expect(r.ok).toBe(true)
      expect(configGravado(m.insertCalls).referencia).toEqual({ refVideoId: REF_ID, refTroca: 'abc:1', tipo: 'title' })
    })

    it('referência sem refVideoId não lê competitor_videos', async () => {
      const m = buildSupabaseMock()
      await createAbTest(makeInput({ referencia: { refVideoId: null, refTroca: null, tipo: 'title' } }))
      expect(m.refFiltros).toEqual([])
    })

    it('sem referencia o config não tem a chave', async () => {
      const { insertCalls } = buildSupabaseMock()
      await createAbTest(makeInput())
      expect(configGravado(insertCalls)).not.toHaveProperty('referencia')
    })
  })

  it('rejects Shorts (≤60s)', async () => {
    buildSupabaseMock({
      video: {
        id: 'video-1',
        duration_seconds: 30,
        thumbnail_hq_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
      },
    })

    const result = await createAbTest(makeInput())

    expect(result).toEqual({ ok: false, codigo: 'short', error: 'O A/B Lab não testa Shorts (vídeos de até 60 s). Escolha outro vídeo.' })
    // Should NOT have attempted to preserve thumbnail or insert
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  it('rejects when existing active/draft/paused test for same video', async () => {
    buildSupabaseMock({
      existingTest: { id: 'existing-test-id', status: 'draft' },
    })

    const result = await createAbTest(makeInput())

    expect(result).toEqual({
      ok: false,
      codigo: 'ja_existe',
      existente: { id: 'existing-test-id', status: 'draft' },
      error: 'Este vídeo já tem um teste (em andamento, pausado, na fila ou em rascunho). Termine ou cancele esse antes de criar outro.',
    })
    expect(put).not.toHaveBeenCalled()
  })

  it('ja_existe: um `select id, status` com order created_at desc (sem consulta nova)', async () => {
    const { selectsDeTeste } = buildSupabaseMock({ existingTest: { id: 'd9', status: 'draft' } })
    const r = await createAbTest(makeInput())
    expect(r.codigo).toBe('ja_existe')
    expect(r.existente).toEqual({ id: 'd9', status: 'draft' })
    expect(selectsDeTeste).toEqual([{ cols: 'id, status', order: ['created_at', { ascending: false }] }])
  })

  it('vídeo não achado: codigo video_nao_achado', async () => {
    buildSupabaseMock({ video: null })
    const r = await createAbTest(makeInput())
    expect(r).toMatchObject({ ok: false, codigo: 'video_nao_achado' })
  })

  it('insert com 23505 (duplo disparo): refaz a leitura e devolve ja_existe, nunca a mensagem crua', async () => {
    buildSupabaseMock({ insertTestResult: { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }, existingTestDepois: { id: 'd2', status: 'queued' } })
    const r = await createAbTest(makeInput())
    expect(r).toMatchObject({ ok: false, codigo: 'ja_existe', existente: { id: 'd2', status: 'queued' } })
    expect(r.error).not.toContain('duplicate')
  })

  it('falha de insert depois de preserveOriginalThumbnail: o blob guardado é apagado (best effort)', async () => {
    vi.mocked(put).mockResolvedValue({ url: BLOB_URL, pathname: 'ab-originals/uuid/original.jpg' } as never)
    buildSupabaseMock({ insertTestResult: { data: null, error: { message: 'boom' } } })
    const r = await createAbTest(makeInput({ test_type: 'thumbnail' } as never))
    expect(r.ok).toBe(false)
    expect(del).toHaveBeenCalledWith(BLOB_URL)
  })

  it('falha ao inserir a variante original: apaga o teste e o blob guardado', async () => {
    vi.mocked(put).mockResolvedValue({ url: BLOB_URL, pathname: 'ab-originals/uuid/original.jpg' } as never)
    buildSupabaseMock({ insertVariantResult: { data: null, error: { message: 'boom' } } })
    const r = await createAbTest(makeInput({ test_type: 'thumbnail' } as never))
    expect(r.ok).toBe(false)
    expect(del).toHaveBeenCalledWith(BLOB_URL)
  })

  it('teste queued no mesmo vídeo: a busca inclui queued, recusa com a frase nova e nada é criado', async () => {
    const { insertCalls, statusFiltrados } = buildSupabaseMock({ existingTest: { id: 'fila-1', status: 'queued' } })
    const result = await createAbTest(makeInput())
    expect(statusFiltrados[0]).toEqual(expect.arrayContaining(['draft', 'active', 'paused', 'queued']))
    expect(result).toEqual({ ok: false, codigo: 'ja_existe', existente: { id: 'fila-1', status: 'queued' }, error: 'Este vídeo já tem um teste (em andamento, pausado, na fila ou em rascunho). Termine ou cancele esse antes de criar outro.' })
    expect(insertCalls).toHaveLength(0)
    expect(put).not.toHaveBeenCalled()
  })

  it('vídeo sem thumbnail: frase em português', async () => {
    buildSupabaseMock({ video: { id: 'video-1', duration_seconds: 600, thumbnail_hq_url: null } })
    const result = await createAbTest(makeInput())
    expect(result).toEqual({ ok: false, codigo: 'sem_thumb_hq', error: 'O Lab ainda não tem a thumbnail deste vídeo. Vá em Vídeos, use "Sincronizar agora" e tente de novo.' })
  })

  it('creates original variant with blob_url matching test original_thumbnail_url', async () => {
    const { insertCalls } = buildSupabaseMock()

    const result = await createAbTest(makeInput())

    expect(result).toEqual({ ok: true, id: 'new-test-id' })

    const variantInsert = insertCalls.find(c => c.table === 'ab_test_variants')
    expect(variantInsert).toBeDefined()

    const variantData = variantInsert!.data as Record<string, unknown>
    expect(variantData).toMatchObject({
      test_id: 'new-test-id',
      label: 'original',
      is_original: true,
      blob_url: BLOB_URL,
      blob_key: null,
      sort_order: 0,
    })
  })

  it('createAbTest guarda a maior cópia (maxres) e grava dimensions e thumbnail_dhash da original', async () => {
    const { insertCalls } = buildSupabaseMock()
    const result = await createAbTest(makeInput())
    expect(result).toEqual({ ok: true, id: 'new-test-id' })

    const enviados = (put as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Buffer
    expect(Buffer.compare(enviados, JPEG_1280)).toBe(0) // os bytes enviados ao put = os da maxres
    const v = insertCalls.find(c => c.table === 'ab_test_variants')!.data as Record<string, unknown>
    expect(v.dimensions).toBe('1280x720')
    expect(v.thumbnail_dhash).toMatch(/^[0-9a-f]{16}$/)
    expect(v.thumbnail_dhash).toBe(await dhashOf(await hqdefaultLike(JPEG_1280)))
  })

  it('sem maxres nem sd: guarda a hqdefault e dimensions 480x360 (o diálogo avisará baixa resolução)', async () => {
    const { insertCalls } = buildSupabaseMock()
    fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('maxresdefault') || url.includes('sddefault')) return new Response('', { status: 404 })
      return new Response(new Uint8Array(JPEG_480), { status: 200, headers: { 'content-type': 'image/jpeg' } })
    })
    const result = await createAbTest(makeInput())
    expect(result).toEqual({ ok: true, id: 'new-test-id' })

    const enviados = (put as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Buffer
    expect(Buffer.compare(enviados, JPEG_480)).toBe(0)
    const v = insertCalls.find(c => c.table === 'ab_test_variants')!.data as Record<string, unknown>
    expect(v.dimensions).toBe('480x360')
    expect(v.thumbnail_dhash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('sem nenhuma cópia pública: falha com a mensagem de hoje e nada é criado', async () => {
    const { insertCalls } = buildSupabaseMock()
    fetchSpy.mockImplementation(async () => new Response('', { status: 404 }))
    const result = await createAbTest(makeInput())
    expect(result).toEqual({ ok: false, error: 'Falha ao salvar thumbnail original. Tente novamente.' })
    expect(insertCalls).toHaveLength(0)
    expect(put).not.toHaveBeenCalled()
  })

  it('returns error when video not found', async () => {
    buildSupabaseMock({ video: null })

    const result = await createAbTest(makeInput())

    expect(result).toEqual({ ok: false, codigo: 'video_nao_achado', error: 'Não achamos este vídeo. Recarregue a página e tente de novo.' })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  it('returns error when preserveOriginalThumbnail fails', async () => {
    buildSupabaseMock({
      video: {
        id: 'video-1',
        youtube_video_id: 'abc',
        duration_seconds: 600,
        thumbnail_hq_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
      },
    })

    fetchSpy.mockRejectedValue(new Error('Network error'))

    const result = await createAbTest(makeInput())

    expect(result).toEqual({
      ok: false,
      error: 'Falha ao salvar thumbnail original. Tente novamente.',
    })
  })

  // -------------------------------------------------------------------------
  // Site com dois canais conectados (PT `UCpt`, EN `UCen`): o título e a
  // descrição originais têm de ser lidos com o token do canal DONO do vídeo.
  // -------------------------------------------------------------------------
  describe('teste de título: token do canal dono do vídeo', () => {
    it('lê os originais com o token do canal do vídeo (UCpt), não com "a conexão mais recente"', async () => {
      const { insertCalls, siteFilters } = buildSupabaseMock()
      ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({ accessToken: 'tok-pt', connectionId: 'c-pt' })
      ;(captureOriginalMetadata as ReturnType<typeof vi.fn>).mockResolvedValue({
        title: 'Título original',
        description: 'Descrição original',
      })

      const result = await createAbTest(makeInput({ test_type: 'title' }))

      expect(result).toEqual({ ok: true, id: 'new-test-id' })
      expect(ensureFreshToken).toHaveBeenCalledTimes(1)
      expect(ensureFreshToken).toHaveBeenCalledWith('site-1', 'youtube', 'UCpt')
      // O resolvedor do canal filtrou o vídeo pelo site da sessão.
      expect(siteFilters).toContainEqual(['site_id', 'site-1'])
      expect(captureOriginalMetadata).toHaveBeenCalledWith('YT_VID_PT', 'tok-pt')
      const testInsert = insertCalls.find(c => c.table === 'ab_tests')!.data as Record<string, unknown>
      expect(testInsert.original_title).toBe('Título original')
      expect(testInsert).not.toHaveProperty('original_description')
    })

    const REFUSAL =
      "Could not read the video's current title. Reconnect this channel's YouTube access and try again."

    it('test_type description: recusa com a mensagem do 422, sem ler o YouTube nem criar linha', async () => {
      const { insertCalls } = buildSupabaseMock()
      const result = await createAbTest(makeInput({ test_type: 'description' as TestType }))
      expect(result).toEqual({ ok: false, error: DESCRICAO_FORA_DO_TESTE.message })
      expect(ensureFreshToken).not.toHaveBeenCalled()
      expect(captureOriginalMetadata).not.toHaveBeenCalled()
      expect(insertCalls).toEqual([])
    })

    it('vídeo sem canal: não pede token nenhum e RECUSA criar o teste (sem linha nenhuma)', async () => {
      const { insertCalls } = buildSupabaseMock({ videoOwner: null })

      const result = await createAbTest(makeInput({ test_type: 'title' }))

      expect(ensureFreshToken).not.toHaveBeenCalled()
      expect(captureOriginalMetadata).not.toHaveBeenCalled()
      expect(result).toEqual({ ok: false, error: REFUSAL })
      expect(insertCalls).toEqual([])
    })

    it.each(['title', 'combo'] as const)(
      'teste de %s com token que falha (canal sem OAuth): recusa, sem criar linha',
      async (testType) => {
        const { insertCalls } = buildSupabaseMock()
        ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('No active youtube connection found'))

        const result = await createAbTest(makeInput({ test_type: testType }))

        expect(result).toEqual({ ok: false, error: REFUSAL })
        expect(insertCalls).toEqual([])
        expect(put).not.toHaveBeenCalled()
      },
    )

    it('YouTube fora do ar (captura volta vazia): recusa, sem criar linha', async () => {
      const { insertCalls } = buildSupabaseMock()
      ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({ accessToken: 'tok-pt', connectionId: 'c-pt' })
      ;(captureOriginalMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await createAbTest(makeInput({ test_type: 'combo' }))

      expect(result).toEqual({ ok: false, error: REFUSAL })
      expect(insertCalls).toEqual([])
    })

    it('teste de thumbnail não pede token', async () => {
      const { insertCalls } = buildSupabaseMock()
      const result = await createAbTest(makeInput())
      expect(ensureFreshToken).not.toHaveBeenCalled()
      // O original da thumbnail vem de youtube_videos: o teste nasce mesmo sem OAuth.
      expect(result).toEqual({ ok: true, id: 'new-test-id' })
      expect(insertCalls.some(c => c.table === 'ab_tests')).toBe(true)
    })
  })
})

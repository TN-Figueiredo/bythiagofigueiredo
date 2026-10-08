import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const CRON_SECRET = 'test-cron-secret'
process.env.CRON_SECRET = CRON_SECRET

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockFrom = vi.fn()
const mockRpc = vi.fn()

// A linha da execução (yt_own_collection_runs) é do cliente falso, não de cada teste: `runsInseridos` guarda os
// payloads do insert, `runsErro` (quando setado) é o `error` que o insert devolve.
const runsInseridos: Array<Record<string, unknown>> = []
let runsErro: { code: string; message: string } | null = null
const runsDeletes: string[] = []
function runsQuery() {
  return {
    insert: (payload: Record<string, unknown>) => {
      runsInseridos.push(payload)
      return Promise.resolve({ error: runsErro })
    },
    delete: () => ({
      lt: (_col: string, val: string) => {
        runsDeletes.push(val)
        return Promise.resolve({ error: null })
      },
    }),
  }
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => (table === 'yt_own_collection_runs' ? runsQuery() : mockFrom(table)),
    rpc: mockRpc,
  }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setTag: vi.fn(),
}))

const mockEnsureFreshToken = vi.fn()
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: (...args: unknown[]) => mockEnsureFreshToken(...args),
}))

vi.mock('@/lib/youtube/coleta/autorizacao', () => ({
  classificarErroDeToken: vi.fn(async () => 'sem_conexao'),
  marcarAutorizado: vi.fn(async () => undefined),
  marcarReautorizar: vi.fn(async () => undefined),
}))

vi.mock('@/lib/youtube/analytics-sync', () => ({
  detectViral: vi.fn(() => false),
  getIsoWeek: vi.fn(() => '2026-W21'),
}))

vi.mock('@/lib/youtube/notification-service', () => ({
  buildNotification: vi.fn(() => ({
    type: 'trending_viral',
    priority: 2,
    title: 'Viral!',
    message: 'Test',
    dedup_key: 'test-key',
    video_id: 'v-1',
    suggested_action: null,
    action_href: null,
  })),
}))

vi.mock('@/lib/notifications/fan-out-to-admins', () => ({
  fanOutToSiteAdmins: vi.fn().mockResolvedValue(1),
}))

// Pre-existing gap (unrelated to this file's own coverage focus): this suite
// never mocked @/lib/cron-health, so recordCronSuccess/recordCronFailure hit
// the real module against `mockFrom`, which has no 'cron_health' handler —
// `.from('cron_health').upsert(...)` threw `TypeError: ... is not a
// function`, unhandled (the route calls these bare, without .catch), failing
// every test whose code path reaches a cron_health write.
vi.mock('@/lib/cron-health', () => ({
  recordCronSuccess: vi.fn(),
  recordCronFailure: vi.fn(),
}))

// Os passos novos têm testes próprios (test/youtube/coleta/); aqui a rota roda só com a parte antiga.
// Função simples, não vi.fn: este arquivo chama vi.restoreAllMocks().
const mockRodarColeta = vi.fn(async (..._a: unknown[]): Promise<{ falhas: string[]; resumo: Record<string, unknown> }> => ({ falhas: [], resumo: {} }))
vi.mock('@/lib/youtube/coleta', () => ({
  rodarColeta: (...args: unknown[]) => mockRodarColeta(...args),
  // A rota importa o guarda; com resumo vazio não há metadados a repassar.
  ehMetadadosAntes: () => false,
}))

// ── Import after mocks ──────────────────────────────────────────────────────
import { GET } from '../../../src/app/api/cron/sync-analytics-metrics/route'
import { NoActiveConnectionError, TokenRevokedError } from '@/lib/social/token-refresh'
import { classificarErroDeToken, marcarAutorizado, marcarReautorizar } from '@/lib/youtube/coleta/autorizacao'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { recordCronFailure, recordCronSuccess } from '@/lib/cron-health'

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(auth?: string): NextRequest {
  const headers = new Headers()
  if (auth !== undefined) {
    headers.set('authorization', auth)
  } else {
    headers.set('authorization', `Bearer ${CRON_SECRET}`)
  }
  return { headers } as unknown as NextRequest
}

function noAuthRequest(): NextRequest {
  return { headers: new Headers() } as unknown as NextRequest
}

function channelsQuery(data: unknown[] | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  }
}

// Leitura de youtube_videos: `select().eq()` (laço por canal) e `select().eq().not()` (fadiga).
// O resultado do eq é aguardável E tem .not, como o builder de verdade.
function videosRead(data: unknown[] | null) {
  const res = { data, error: null }
  return Object.assign(Promise.resolve(res), { not: vi.fn().mockResolvedValue(res) })
}

// Fadiga: `from('ab_tests').select().eq().in()` — nenhum teste A/B ativo.
function abTestsQuery() {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }),
    }),
  }
}

function videosQuery(data: unknown[] | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockImplementation(() => videosRead(data)),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('GET /api/cron/sync-analytics-metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset global fetch mock
    vi.restoreAllMocks()
  })

  it('returns 401 without Authorization header', async () => {
    const res = await GET(noAuthRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 with wrong CRON_SECRET', async () => {
    const res = await GET(makeRequest('Bearer wrong'))
    expect(res.status).toBe(401)
  })

  it('returns 500 and records a failure when the channels query itself errors (Importante 3, 2026-09-02-falhas-silenciosas)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'connection reset' } }),
          }),
        }
      }
      return {}
    })
    const { recordCronFailure, recordCronSuccess } = await import('@/lib/cron-health')

    const res = await GET(makeRequest())

    // A dropped query error used to fall through to `channels === null` ->
    // "no_channels" -> recordCronSuccess + HTTP 200 — asserting health over
    // an error the route never looked at. It must now surface as a failure.
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('channels query failed')
    expect(JSON.stringify(body)).not.toContain('connection reset')
    expect(recordCronFailure).toHaveBeenCalledWith('sync-analytics-metrics', 'database error listing the YouTube channels')
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('returns no_channels when no channels configured', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') return channelsQuery([])
      return {}
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('no_channels')
  })

  it('happy path: syncs analytics for channels with videos', async () => {
    const fakeChannel = {
      id: 'ch-1',
      channel_id: 'UC123',
      site_id: 'site-1',
      subscriber_count: 1000,
    }
    const fakeVideo = {
      id: 'v-1',
      youtube_video_id: 'vid-abc',
      title: 'Test Video',
      view_count: 100,
      view_count_yesterday: 10,
      view_count_delta_today: 5,
    }

    mockEnsureFreshToken.mockResolvedValue({ accessToken: 'yt-token' })

    // Mock fetch for YouTube Analytics API
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          rows: [['vid-abc', 50, 100, 120, 5, 2, 1, 3]],
        }),
        { status: 200 },
      ),
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') return channelsQuery([fakeChannel])
      if (table === 'youtube_videos') return videosQuery([fakeVideo])
      if (table === 'youtube_video_analytics') return { upsert: vi.fn().mockResolvedValue({ error: null }) }
      if (table === 'ab_tests') return abTestsQuery()
      return {}
    })
    mockRpc.mockResolvedValue({ error: null })
    const { recordCronFailure, recordCronSuccess } = await import('@/lib/cron-health')
    const Sentry = await import('@sentry/nextjs')

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.synced).toBe(1)
    expect(body.errors).toBe(0)
    // O caminho feliz tem de terminar verde de verdade: nenhum bloco (fadiga inclusive) lançou.
    expect(body.falhas).toBeUndefined()
    expect(Sentry.captureException).not.toHaveBeenCalled()
    expect(recordCronSuccess).toHaveBeenCalledTimes(1)
    expect(recordCronFailure).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
  })

  it('increments errors when fetch returns non-ok status', async () => {
    const fakeChannel = {
      id: 'ch-1',
      channel_id: 'UC123',
      site_id: 'site-1',
      subscriber_count: 500,
    }

    mockEnsureFreshToken.mockResolvedValue({ accessToken: 'yt-token' })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('quota exceeded', { status: 403 }),
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') return channelsQuery([fakeChannel])
      // A fadiga roda mesmo com o canal em erro: os mocks dela devolvem vazio em vez de lançar.
      if (table === 'youtube_videos') return videosQuery([])
      if (table === 'ab_tests') return abTestsQuery()
      return {}
    })

    const Sentry = await import('@sentry/nextjs')
    const { recordCronFailure } = await import('@/lib/cron-health')
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.synced).toBe(0)
    expect(body.errors).toBe(1)
    expect(body.errorDetails).toBeDefined()
    expect(Sentry.captureMessage).toHaveBeenCalled()
    // A única falha é a do canal (403); nada da fadiga.
    expect(Sentry.captureException).not.toHaveBeenCalled()
    expect(body.falhas).toEqual(body.errorDetails)
    expect(recordCronFailure).toHaveBeenCalledTimes(1)

    fetchSpy.mockRestore()
  })
})

describe('autorização e linha da execução (L1b)', () => {
  const video = {
    id: 'v-1', youtube_video_id: 'vid-abc', title: 'Test Video',
    view_count: 100, view_count_yesterday: 10, view_count_delta_today: 5,
  }
  const AVISO_ANTIGO = 'youtube.channel_skipped_no_connection'
  const avisosAntigos = () => vi.mocked(fanOutToSiteAdmins).mock.calls.filter(c => c[0].type === AVISO_ANTIGO)

  /** Um canal cadastrado (e as tabelas que a rota lê dele). */
  function umCanal(extra: Record<string, unknown> = {}) {
    const canal = { id: 'ch-1', channel_id: 'UC123', site_id: 'site-1', subscriber_count: 1000, name: null, collection_status: 'ok', ...extra }
    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') return channelsQuery([canal])
      if (table === 'youtube_videos') return videosQuery([video])
      if (table === 'youtube_video_analytics') return { upsert: vi.fn().mockResolvedValue({ error: null }) }
      if (table === 'ab_tests') return abTestsQuery()
      return {}
    })
  }

  /** A Analytics API responde com este status e corpo (uma Response nova a cada chamada: o corpo só lê uma vez). */
  function analyticsResponde(status: number, corpo: unknown) {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(corpo), { status }))
  }

  const pedir = () => GET(makeRequest())

  beforeEach(() => {
    // O beforeEach do describe acima não vale aqui (este é irmão dele): mesma limpeza.
    vi.clearAllMocks()
    vi.restoreAllMocks()
    runsInseridos.length = 0
    runsDeletes.length = 0
    runsErro = null
    mockRodarColeta.mockReset()
    mockRodarColeta.mockResolvedValue({ falhas: [], resumo: {} })
    mockEnsureFreshToken.mockReset()
    mockEnsureFreshToken.mockResolvedValue({ accessToken: 'yt-token' })
    vi.mocked(classificarErroDeToken).mockReset()
    vi.mocked(classificarErroDeToken).mockResolvedValue('sem_conexao')
    vi.mocked(marcarReautorizar).mockClear()
    vi.mocked(marcarAutorizado).mockClear()
    mockRpc.mockResolvedValue({ error: null })
  })

  it('Analytics API 401: canal marcado reautorizar, sem erro, sem falha, sem aviso de "sem conexão"', async () => {
    umCanal({ id: 'ch-1', collection_status: 'ok' })
    analyticsResponde(401, { error: { errors: [{ reason: 'authError' }] } })
    const corpo = await (await pedir()).json()
    expect(marcarReautorizar).toHaveBeenCalledTimes(1)
    expect(vi.mocked(marcarReautorizar).mock.calls[0]![1]).toMatchObject({ id: 'ch-1' })
    expect(corpo).toMatchObject({ errors: 0, sem_autorizacao: 1, skipped_no_connection: 0 })
    expect(corpo.falhas).toBeUndefined()
    expect(recordCronSuccess).toHaveBeenCalledTimes(1)
    expect(avisosAntigos()).toEqual([])
  })

  it('Analytics API 403 por permissão insuficiente → reautorizar; 403 por cota → erro, como antes', async () => {
    umCanal({ id: 'ch-1' })
    analyticsResponde(403, { error: { errors: [{ reason: 'insufficientPermissions' }] } })
    expect(await (await pedir()).json()).toMatchObject({ errors: 0, sem_autorizacao: 1 })

    vi.mocked(marcarReautorizar).mockClear()
    analyticsResponde(403, { error: { errors: [{ reason: 'quotaExceeded' }] } })
    const corpo = await (await pedir()).json()
    expect(corpo).toMatchObject({ errors: 1, sem_autorizacao: 0 })
    expect(marcarReautorizar).not.toHaveBeenCalled()
    expect(recordCronFailure).toHaveBeenCalled()
  })

  it('TokenRevokedError na parte antiga → reautorizar, não erro', async () => {
    umCanal({ id: 'ch-1' })
    mockEnsureFreshToken.mockRejectedValue(new TokenRevokedError('youtube', 'c1'))
    const corpo = await (await pedir()).json()
    expect(corpo).toMatchObject({ errors: 0, sem_autorizacao: 1 })
    expect(marcarReautorizar).toHaveBeenCalledTimes(1)
  })

  it('canal que a fase "antes" já devolveu em reautorizar: pulado sem aviso antigo e sem marcar de novo', async () => {
    umCanal({ id: 'ch-1' })
    mockRodarColeta
      .mockResolvedValueOnce({ falhas: [], resumo: { reautorizar: ['ch-1'], ms: { metadados: 10, jobs: 5 } } })
      .mockResolvedValueOnce({ falhas: [], resumo: { ms: { relatorios: 7 } } })
    mockEnsureFreshToken.mockRejectedValue(new NoActiveConnectionError('youtube', 'site-1'))
    const corpo = await (await pedir()).json()
    expect(corpo).toMatchObject({ sem_autorizacao: 1, skipped_no_connection: 0 })
    expect(classificarErroDeToken).not.toHaveBeenCalled()
    expect(marcarReautorizar).not.toHaveBeenCalled()
    expect(avisosAntigos()).toEqual([])
    expect(corpo.coleta.ms).toEqual({ metadados: 10, jobs: 5, relatorios: 7 })
  })

  it('canal que a fase "antes" já devolveu em reautorizar e a Analytics API nega: não marca de novo, mas a negação chega à fase "depois"', async () => {
    umCanal({ id: 'ch-1', collection_status: 'reautorizar' })
    mockRodarColeta
      .mockResolvedValueOnce({ falhas: [], resumo: { reautorizar: ['ch-1'], autorizados: ['ch-1'], negados: [] } })
      .mockResolvedValueOnce({ falhas: [], resumo: {} })
    analyticsResponde(403, { error: { errors: [{ reason: 'insufficientPermissions' }] } })
    const corpo = await (await pedir()).json()
    expect(corpo).toMatchObject({ sem_autorizacao: 1 })
    expect(marcarReautorizar).not.toHaveBeenCalled()
    expect(mockRodarColeta.mock.calls[1]![0]).toMatchObject({ fase: 'depois', autorizadosAntes: ['ch-1'], negadosAntes: ['ch-1'] })
  })

  it('NoActiveConnectionError de canal nunca conectado: pulo legítimo com o aviso antigo, como hoje', async () => {
    umCanal({ id: 'ch-1' })
    mockEnsureFreshToken.mockRejectedValue(new NoActiveConnectionError('youtube', 'site-1'))
    vi.mocked(classificarErroDeToken).mockResolvedValue('sem_conexao')
    const corpo = await (await pedir()).json()
    expect(corpo).toMatchObject({ skipped_no_connection: 1, sem_autorizacao: 0 })
    expect(avisosAntigos()).toHaveLength(1)
  })

  it('NoActiveConnectionError que o classificador lê como reautorizar (conexão revogada): marca e conta, sem aviso antigo', async () => {
    umCanal({ id: 'ch-1' })
    mockEnsureFreshToken.mockRejectedValue(new NoActiveConnectionError('youtube', 'site-1'))
    vi.mocked(classificarErroDeToken).mockResolvedValue('reautorizar')
    const corpo = await (await pedir()).json()
    expect(corpo).toMatchObject({ errors: 0, sem_autorizacao: 1, skipped_no_connection: 0 })
    expect(marcarReautorizar).toHaveBeenCalledTimes(1)
    expect(avisosAntigos()).toEqual([])
  })

  it('NoActiveConnectionError classe "outro" (leitura das conexões falhou): cai no erro genérico', async () => {
    umCanal({ id: 'ch-1' })
    mockEnsureFreshToken.mockRejectedValue(new NoActiveConnectionError('youtube', 'site-1'))
    vi.mocked(classificarErroDeToken).mockResolvedValue('outro')
    const corpo = await (await pedir()).json()
    expect(corpo).toMatchObject({ errors: 1, sem_autorizacao: 0, skipped_no_connection: 0 })
    expect(marcarReautorizar).not.toHaveBeenCalled()
    expect(recordCronFailure).toHaveBeenCalled()
  })

  it('chamada da Analytics API que passa carimba a autorização do canal', async () => {
    umCanal({ id: 'ch-1' })
    analyticsResponde(200, { rows: [] })
    await pedir()
    expect(vi.mocked(marcarAutorizado).mock.calls[0]![1]).toMatchObject({ id: 'ch-1' })
  })

  /** Canal A (UCA) revogado ao lado do canal B (UCB): só o B chega à Analytics API. */
  function canalRevogadoEUmCanalB() {
    const base = { site_id: 'site-1', subscriber_count: 1000, name: null, collection_status: 'ok' }
    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') {
        return channelsQuery([{ id: 'ch-a', channel_id: 'UCA', ...base }, { id: 'ch-b', channel_id: 'UCB', ...base }])
      }
      if (table === 'youtube_videos') return videosQuery([video])
      if (table === 'youtube_video_analytics') return { upsert: vi.fn().mockResolvedValue({ error: null }) }
      if (table === 'ab_tests') return abTestsQuery()
      return {}
    })
    mockEnsureFreshToken.mockImplementation(async (siteId: string, _p: string, acc?: string) => {
      if (acc === 'UCA') throw new TokenRevokedError('youtube', 'c-a')
      return { accessToken: 'yt-token' }
    })
  }

  it('canal em reautorizar não conta como "com conexão": o outro canal vazio é "todos vazios" (regra 5)', async () => {
    canalRevogadoEUmCanalB()
    analyticsResponde(200, { rows: [] })
    const corpo = await (await pedir()).json()
    expect(corpo).toMatchObject({ sem_autorizacao: 1, emptyReports: 1 })
    expect(corpo.falhas).toEqual(expect.arrayContaining([expect.stringContaining('all 1 channel(s) returned an empty analytics report')]))
    expect(recordCronFailure).toHaveBeenCalled()
  })

  it('canal em reautorizar ao lado de um canal com dados: nenhuma nota de "todos vazios" e o cron fica verde', async () => {
    canalRevogadoEUmCanalB()
    analyticsResponde(200, { rows: [['vid-abc', 50, 100, 120, 5, 2, 1, 3]] })
    const corpo = await (await pedir()).json()
    expect(corpo).toMatchObject({ sem_autorizacao: 1, synced: 1 })
    expect(JSON.stringify(corpo.falhas ?? [])).not.toContain('returned an empty analytics report')
    expect(recordCronSuccess).toHaveBeenCalledTimes(1)
  })

  it('grava uma linha da execução com tempos, falhas e ação do dono, ANTES do veredito', async () => {
    umCanal({ id: 'ch-1' })
    analyticsResponde(200, { rows: [['vid-abc', 50, 100, 120, 5, 2, 1, 3]] })
    mockRodarColeta
      .mockResolvedValueOnce({ falhas: ['metadados: x'], resumo: { ms: { metadados: 10, jobs: 5 }, acao_do_dono: ['Canal: reautorizar'] } })
      .mockResolvedValueOnce({ falhas: [], resumo: { ms: { relatorios: 7 } } })
    await pedir()
    expect(runsInseridos).toHaveLength(1)
    expect(runsInseridos[0]).toMatchObject({
      ms_passos: { metadados: 10, jobs: 5, relatorios: 7 },
      acao_do_dono: ['Canal: reautorizar'],
    })
    expect(runsInseridos[0]!.falhas).toContain('metadados: x')
    expect(typeof runsInseridos[0]!.ms_total).toBe('number')
    expect(typeof runsInseridos[0]!.ms_existente).toBe('number')
    // A limpeza dos de mais de 90 dias roda depois do insert que deu certo.
    expect(runsDeletes).toHaveLength(1)
    expect(new Date(runsDeletes[0]!).getTime()).toBeLessThan(Date.now() - 89 * 86_400_000)
  })

  it('coluna collection_status ausente (código no ar sem a migration): relê os canais sem ela, a parte antiga e as duas fases rodam, e o veredito é schema_ausente', async () => {
    const canal = { id: 'ch-1', channel_id: 'UC123', site_id: 'site-1', subscriber_count: 1000, name: null }
    const selects: string[] = []
    mockFrom.mockImplementation((table: string) => {
      if (table === 'youtube_channels') {
        return {
          select: (cols: string) => {
            selects.push(cols)
            return {
              eq: async () => (cols.includes('collection_status')
                ? { data: null, error: { code: '42703', message: 'column youtube_channels.collection_status does not exist' } }
                : { data: [canal], error: null }),
            }
          },
        }
      }
      if (table === 'youtube_videos') return videosQuery([video])
      if (table === 'youtube_video_analytics') return { upsert: vi.fn().mockResolvedValue({ error: null }) }
      if (table === 'ab_tests') return abTestsQuery()
      return {}
    })
    analyticsResponde(200, { rows: [['vid-abc', 50, 100, 120, 5, 2, 1, 3]] })
    const res = await pedir()
    expect(res.status).toBe(200)
    const corpo = await res.json()
    expect(selects).toHaveLength(2)
    expect(selects[1]).not.toContain('collection_status')
    // A parte antiga rodou: a Analytics API foi chamada e o canal sincronizou.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(corpo).toMatchObject({ synced: 1, errors: 0, sem_autorizacao: 0 })
    expect(mockRodarColeta.mock.calls.map(c => (c[0] as { fase: string }).fase)).toEqual(['antes', 'depois'])
    expect(corpo.falhas).toEqual(['schema_ausente: youtube_channels'])
    expect(vi.mocked(recordCronFailure).mock.calls[0]![1]).toContain('schema_ausente: youtube_channels')
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('coluna ausente e a segunda leitura também falha: 500, como qualquer erro ao listar os canais', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table !== 'youtube_channels') return {}
      return {
        select: (cols: string) => ({
          eq: async () => ({ data: null, error: cols.includes('collection_status') ? { code: '42703', message: 'x' } : { code: '57014', message: 'statement timeout' } }),
        }),
      }
    })
    const res = await pedir()
    expect(res.status).toBe(500)
    expect(mockRodarColeta).not.toHaveBeenCalled()
    expect(recordCronFailure).toHaveBeenCalledWith('sync-analytics-metrics', 'database error listing the YouTube channels')
  })

  it('tabela yt_own_collection_runs ausente (migration não aplicada): schema_ausente no veredito e a resposta sai 200 (Review Focus 5)', async () => {
    umCanal({ id: 'ch-1' })
    analyticsResponde(200, { rows: [['vid-abc', 50, 100, 120, 5, 2, 1, 3]] })
    runsErro = { code: 'PGRST205', message: 'tabela' }
    const res = await pedir()
    expect(res.status).toBe(200)
    const corpo = await res.json()
    expect(vi.mocked(recordCronFailure).mock.calls[0]![1]).toContain('schema_ausente: yt_own_collection_runs')
    expect(recordCronSuccess).not.toHaveBeenCalled()
    // Montagem da resposta depois da gravação: a falha da própria gravação aparece no corpo.
    expect(corpo.falhas).toContain('schema_ausente: yt_own_collection_runs')
    // Sem tabela, não há o que limpar.
    expect(runsDeletes).toEqual([])
  })
})

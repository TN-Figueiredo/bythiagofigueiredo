// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { listOwnChannels, getIntelligenceSnapshot } from '@/lib/pipeline/services/youtube'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import { fakePostgrest, type FakePostgrestOptions } from '../../../helpers/fake-postgrest'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn() }))

const SITE = 'site-1'
const OTHER = 'site-2'

function ctxOf(sb: { client: unknown }, siteId = SITE): ServiceContext {
  return { siteId, permissions: ['read'], supabase: sb.client as ServiceContext['supabase'], source: 'api_key' }
}

function channel(over: Record<string, unknown>) {
  return {
    id: 'ch', site_id: SITE, channel_id: 'UCx', slug: 'canal', name: 'Canal', handle: '@canal', locale: 'pt',
    niche: 'viagem', subscriber_count: 0, video_count: 0, sync_enabled: true, last_synced_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

const NICHES = [
  { site_id: SITE, slug: 'viagem', label: 'Viagem', color_dark: '#5BBF8A', color_light: '#11692F', sort_order: 10 },
  { site_id: SITE, slug: 'jogos', label: 'Jogos e Consoles', color_dark: '#111111', color_light: '#222222', sort_order: 30 },
]

// ---------------------------------------------------------------------------
// listOwnChannels
// ---------------------------------------------------------------------------

describe('listOwnChannels', () => {
  it('devolve só os canais do site do contexto, na ordem de cadastro (created_at, depois id)', async () => {
    const sb = fakePostgrest({
      tables: {
        youtube_channels: [
          channel({ id: 'c-novo', slug: 'novo', name: 'Novo', created_at: '2026-10-01T00:00:00Z' }),
          channel({ id: 'c-outro-site', site_id: OTHER, slug: 'alheio', name: 'Alheio', created_at: '2020-01-01T00:00:00Z' }),
          // dois canais cadastrados no mesmo instante: o id desempata
          channel({ id: 'c-b', slug: 'b', name: 'B', created_at: '2026-03-01T00:00:00Z' }),
          channel({ id: 'c-a', slug: 'a', name: 'A', created_at: '2026-03-01T00:00:00Z' }),
        ],
        youtube_niches: NICHES,
      },
    })

    const { data } = await listOwnChannels(ctxOf(sb))

    expect(data.map(c => c.id)).toEqual(['c-a', 'c-b', 'c-novo'])
    const q = sb.on('youtube_channels')[0]!
    expect(q.filters).toContainEqual({ op: 'eq', col: 'site_id', value: SITE })
    expect(q.orders).toEqual([{ col: 'created_at', ascending: true }, { col: 'id', ascending: true }])
  })

  it('devolve exatamente os doze campos do contrato, com o rótulo do nicho', async () => {
    const sb = fakePostgrest({
      tables: {
        youtube_channels: [channel({
          id: 'c1', channel_id: 'UCabc', slug: 'tnfigueiredotv', name: 'tnFigueiredo', handle: '@tnfigueiredotv', locale: 'pt',
          niche: 'jogos', subscriber_count: 1160, video_count: 42, sync_enabled: false, last_synced_at: '2026-10-03T12:00:00Z',
        })],
        youtube_niches: NICHES,
      },
    })

    const { data } = await listOwnChannels(ctxOf(sb))

    expect(data).toEqual([{
      id: 'c1', channel_id: 'UCabc', slug: 'tnfigueiredotv', name: 'tnFigueiredo', handle: '@tnfigueiredotv', locale: 'pt',
      niche: 'jogos', niche_label: 'Jogos e Consoles', subscriber_count: 1160, video_count: 42, sync_enabled: false,
      last_synced_at: '2026-10-03T12:00:00Z',
    }])
  })

  it('não seleciona nenhuma coluna que a tabela não tem (total_views, channel_name, tier)', async () => {
    const sb = fakePostgrest({ tables: { youtube_channels: [channel({ id: 'c1' })], youtube_niches: NICHES } })
    await listOwnChannels(ctxOf(sb))
    for (const q of sb.on('youtube_channels')) {
      expect(q.select).not.toMatch(/total_views|channel_name|\btier\b/)
    }
  })

  it('site sem canal → lista vazia, e nem lê os nichos', async () => {
    const sb = fakePostgrest({
      tables: { youtube_channels: [channel({ id: 'c-outro', site_id: OTHER })], youtube_niches: NICHES },
    })
    const { data } = await listOwnChannels(ctxOf(sb))
    expect(data).toEqual([])
    expect(sb.on('youtube_niches')).toHaveLength(0)
  })

  it('canal sem nicho → niche e niche_label null, e nem lê os nichos', async () => {
    const sb = fakePostgrest({ tables: { youtube_channels: [channel({ id: 'c1', niche: null })], youtube_niches: NICHES } })
    const { data } = await listOwnChannels(ctxOf(sb))
    expect(data[0]).toMatchObject({ niche: null, niche_label: null })
    expect(sb.on('youtube_niches')).toHaveLength(0)
  })

  it('nicho fora da lista do site → o rótulo é o próprio slug (regra de nicheLabel), nunca lança', async () => {
    const sb = fakePostgrest({ tables: { youtube_channels: [channel({ id: 'c1', niche: 'culinaria' })], youtube_niches: NICHES } })
    const { data } = await listOwnChannels(ctxOf(sb))
    expect(data[0]).toMatchObject({ niche: 'culinaria', niche_label: 'culinaria' })
  })

  it('site sem nenhuma linha em youtube_niches → valem os de fábrica (Viagem)', async () => {
    const sb = fakePostgrest({ tables: { youtube_channels: [channel({ id: 'c1', niche: 'viagem' })], youtube_niches: [] }, columns: { youtube_niches: ['site_id', 'slug', 'label', 'color_dark', 'color_light', 'sort_order'] } })
    const { data } = await listOwnChannels(ctxOf(sb))
    expect(data[0]).toMatchObject({ niche: 'viagem', niche_label: 'Viagem' })
  })

  it.each(['42P01', 'PGRST205'])('tabela youtube_niches ausente (%s) → niche_label null, o resto intacto', async (code) => {
    const sb = fakePostgrest({
      tables: { youtube_channels: [channel({ id: 'c1', niche: 'viagem' })] },
      fail: q => (q.table === 'youtube_niches' ? { code, message: 'no table' } : null),
    })
    const { data } = await listOwnChannels(ctxOf(sb))
    expect(data).toHaveLength(1)
    expect(data[0]).toMatchObject({ id: 'c1', niche: 'viagem', niche_label: null })
  })

  it.each(['42703', 'PGRST204'])('coluna slug ausente (%s) → relê sem a coluna e devolve slug null', async (code) => {
    const sb = fakePostgrest({
      tables: { youtube_channels: [channel({ id: 'c1', name: 'A' })], youtube_niches: NICHES },
      fail: q => (q.table === 'youtube_channels' && /\bslug\b/.test(q.select) ? { code, message: 'column youtube_channels.slug does not exist' } : null),
    })

    const { data } = await listOwnChannels(ctxOf(sb))

    expect(data).toHaveLength(1)
    expect(data[0]).toMatchObject({ id: 'c1', name: 'A', slug: null })
    const reads = sb.on('youtube_channels')
    expect(reads).toHaveLength(2)
    expect(reads[1]!.select).not.toMatch(/\bslug\b/)
    // a releitura mantém o filtro de site e a ordem
    expect(reads[1]!.filters).toContainEqual({ op: 'eq', col: 'site_id', value: SITE })
    expect(reads[1]!.orders).toEqual([{ col: 'created_at', ascending: true }, { col: 'id', ascending: true }])
  })

  it('outro erro na leitura dos canais → INTERNAL_ERROR 500, nunca lista vazia', async () => {
    const sb = fakePostgrest({
      tables: { youtube_channels: [channel({ id: 'c1' })], youtube_niches: NICHES },
      fail: q => (q.table === 'youtube_channels' ? { code: '57014', message: 'statement timeout' } : null),
    })
    await expect(listOwnChannels(ctxOf(sb))).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
    // não é coluna ausente: não há segunda tentativa
    expect(sb.on('youtube_channels')).toHaveLength(1)
  })

  it('a releitura sem slug também falha → INTERNAL_ERROR 500', async () => {
    const sb = fakePostgrest({
      tables: { youtube_channels: [channel({ id: 'c1' })], youtube_niches: NICHES },
      fail: q => (q.table === 'youtube_channels' ? { code: '42703', message: 'column does not exist' } : null),
    })
    await expect(listOwnChannels(ctxOf(sb))).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
  })

  it('outro erro na leitura dos nichos → INTERNAL_ERROR 500 (não some com o rótulo em silêncio)', async () => {
    const sb = fakePostgrest({
      tables: { youtube_channels: [channel({ id: 'c1' })], youtube_niches: NICHES },
      fail: q => (q.table === 'youtube_niches' ? { code: '57014', message: 'statement timeout' } : null),
    })
    await expect(listOwnChannels(ctxOf(sb))).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
  })
})

// ---------------------------------------------------------------------------
// getIntelligenceSnapshot — notas, ciclos e testes A/B só do canal pedido
// ---------------------------------------------------------------------------

function video(id: string, channelId: string, over: Record<string, unknown> = {}) {
  return {
    id, site_id: SITE, channel_id: channelId, youtube_video_id: 'yt-' + id, title: id, thumbnail_url: null,
    published_at: '2026-01-01T00:00:00Z', view_count: 1, ctr: null, impressions: null, avg_view_percentage: null,
    avg_view_duration_seconds: null, retention_curve: null, traffic_sources: null, is_hidden: false,
    ...over,
  }
}
const grade = (videoId: string, week: string, siteId = SITE) => ({
  site_id: siteId, youtube_video_id: videoId, grade: 'B', score: 70, ctr: 1, retention: 1, reach: 1, engagement: 1, growth: 1, sub_impact: 1, week_iso: week,
})
const cycle = (id: string, videoId: string, state = 'flagged') => ({ id, site_id: SITE, youtube_video_id: videoId, state })
const abTest = (id: string, videoId: string, createdAt: string) => ({
  id, site_id: SITE, youtube_video_id: videoId, name: id, status: 'active', test_type: 'thumbnail', winner_variant_id: null,
  completed_reason: null, config: {}, created_at: createdAt,
})

/** Site com os canais A e B, cada um com vídeos, notas, um ciclo e um teste A/B. */
function twoChannels(over: Partial<FakePostgrestOptions['tables']> = {}): FakePostgrestOptions['tables'] {
  return {
    youtube_channels: [
      channel({ id: 'ch-a', name: 'Canal A', channel_id: 'UCa', subscriber_count: 100 }),
      channel({ id: 'ch-b', name: 'Canal B', channel_id: 'UCb', subscriber_count: 200 }),
    ],
    youtube_videos: [video('va1', 'ch-a'), video('va2', 'ch-a'), video('vb1', 'ch-b')],
    video_grade_history: [grade('va1', '2026-W38'), grade('va2', '2026-W39'), grade('vb1', '2026-W40'), grade('vb1', '2026-W39')],
    optimization_cycles: [cycle('cy-a', 'va1'), cycle('cy-b', 'vb1'), cycle('cy-a-fechado', 'va2', 'resolved')],
    ab_tests: [abTest('ab-a', 'va2', '2026-09-01T00:00:00Z'), abTest('ab-b', 'vb1', '2026-09-20T00:00:00Z')],
    youtube_intelligence: [],
    youtube_video_analytics: [],
    ...over,
  } as FakePostgrestOptions['tables']
}
const COLUMNS = {
  youtube_intelligence: ['channel_id', 'site_id', 'source', 'generated_at'],
  youtube_video_analytics: ['date', 'site_id', 'youtube_video_id', 'views', 'subscribers_gained'],
  video_grade_history: ['site_id', 'youtube_video_id', 'grade', 'score', 'ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact', 'week_iso'],
  optimization_cycles: ['id', 'site_id', 'youtube_video_id', 'state'],
  ab_tests: ['id', 'site_id', 'youtube_video_id', 'name', 'status', 'test_type', 'winner_variant_id', 'completed_reason', 'config', 'created_at'],
}

describe('getIntelligenceSnapshot — notas, ciclos e testes A/B são do canal pedido', () => {
  it('o snapshot de A traz grade_history, optimization_cycles e ab_tests só dos vídeos de A', async () => {
    const sb = fakePostgrest({ tables: twoChannels(), columns: COLUMNS })

    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-a')

    expect(data.channel.id).toBe('ch-a')
    expect(data.grade_history.map(g => g.youtube_video_id).sort()).toEqual(['va1', 'va2'])
    // a ordem de hoje se mantém: semana mais recente primeiro
    expect(data.grade_history.map(g => g.week_iso)).toEqual(['2026-W39', '2026-W38'])
    // ciclos: só os abertos, e só os de A
    expect(data.optimization_cycles.map(c => c.id)).toEqual(['cy-a'])
    expect(data.ab_tests.map(t => t.id)).toEqual(['ab-a'])
  })

  it('e o de B só traz os de B', async () => {
    const sb = fakePostgrest({ tables: twoChannels(), columns: COLUMNS })
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-b')
    expect(data.grade_history.map(g => g.youtube_video_id)).toEqual(['vb1', 'vb1'])
    expect(data.optimization_cycles.map(c => c.id)).toEqual(['cy-b'])
    expect(data.ab_tests.map(t => t.id)).toEqual(['ab-b'])
  })

  it('a forma de cada item não muda: ab_tests continua com as mesmas oito chaves', async () => {
    const sb = fakePostgrest({ tables: twoChannels(), columns: COLUMNS })
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-a')
    expect(Object.keys(data.ab_tests[0]!).sort()).toEqual(
      ['completed_reason', 'config', 'id', 'name', 'status', 'test_type', 'winner_variant_id', 'youtube_video_id'],
    )
    expect(Object.keys(data.grade_history[0]!).sort()).toEqual(
      ['ctr', 'engagement', 'grade', 'growth', 'reach', 'retention', 'score', 'sub_impact', 'week_iso', 'youtube_video_id'],
    )
    expect(Object.keys(data).sort()).toEqual(
      ['ab_tests', 'channel', 'grade_history', 'intelligence', 'optimization_cycles', 'recent_window', 'videos'],
    )
  })

  it('as três consultas mantêm o filtro de site, os limites e as ordens, e ganham o filtro de vídeo', async () => {
    const sb = fakePostgrest({ tables: twoChannels(), columns: COLUMNS })
    await getIntelligenceSnapshot(ctxOf(sb), 'ch-a')

    const grades = sb.on('video_grade_history')
    expect(grades).toHaveLength(1)
    expect(grades[0]!.filters).toContainEqual({ op: 'eq', col: 'site_id', value: SITE })
    expect(grades[0]!.filters).toContainEqual({ op: 'in', col: 'youtube_video_id', value: ['va1', 'va2'] })
    expect(grades[0]!.orders).toEqual([{ col: 'week_iso', ascending: false }])
    expect(grades[0]!.limit).toBe(200)

    const cycles = sb.on('optimization_cycles')
    expect(cycles).toHaveLength(1)
    expect(cycles[0]!.select).toBe('*')
    expect(cycles[0]!.filters).toContainEqual({ op: 'eq', col: 'site_id', value: SITE })
    expect(cycles[0]!.filters).toContainEqual({ op: 'in', col: 'youtube_video_id', value: ['va1', 'va2'] })
    expect(cycles[0]!.filters).toContainEqual({ op: 'not.in', col: 'state', value: ['resolved', 'exhausted'] })

    const tests = sb.on('ab_tests')
    expect(tests).toHaveLength(1)
    expect(tests[0]!.filters).toContainEqual({ op: 'eq', col: 'site_id', value: SITE })
    expect(tests[0]!.filters).toContainEqual({ op: 'in', col: 'youtube_video_id', value: ['va1', 'va2'] })
    expect(tests[0]!.orders).toEqual([{ col: 'created_at', ascending: false }])
    expect(tests[0]!.limit).toBe(20)
  })

  it('as 200 notas mais recentes do SITE são todas de B: o canal A continua com o histórico dele', async () => {
    const muitasDeB = Array.from({ length: 230 }, (_, i) => grade('vb1', `2027-W${String(i).padStart(3, '0')}`))
    const sb = fakePostgrest({
      tables: twoChannels({ video_grade_history: [grade('va1', '2026-W38'), ...muitasDeB] }),
      columns: COLUMNS,
    })
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-a')
    expect(data.grade_history).toHaveLength(1)
    expect(data.grade_history[0]).toMatchObject({ youtube_video_id: 'va1', week_iso: '2026-W38' })
  })

  it('o filtro usa TODOS os vídeos do canal, não só os 50 mais recentes da lista de vídeos', async () => {
    const videos = Array.from({ length: 60 }, (_, i) =>
      video(`v${String(i).padStart(2, '0')}`, 'ch-a', { published_at: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z` }))
    // v00 é dos mais antigos: fica fora dos 50 da lista, mas a nota dele é do canal
    const sb = fakePostgrest({
      tables: twoChannels({ youtube_videos: [...videos, video('vb1', 'ch-b')], video_grade_history: [grade('v00', '2026-W10')], optimization_cycles: [], ab_tests: [] }),
      columns: COLUMNS,
    })
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-a')
    expect(data.videos).toHaveLength(50)
    expect(data.grade_history.map(g => g.youtube_video_id)).toEqual(['v00'])
    const inFilter = sb.on('video_grade_history')[0]!.filters.find(f => f.op === 'in')!
    expect(inFilter.value).toHaveLength(60)
  })

  it('canal sem vídeos → as três listas vazias, SEM rodar as três consultas (nunca .in(col, []))', async () => {
    const sb = fakePostgrest({
      tables: twoChannels({ youtube_videos: [video('vb1', 'ch-b')] }),
      columns: COLUMNS,
    })
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-a')

    expect(data.videos).toEqual([])
    expect(data.grade_history).toEqual([])
    expect(data.optimization_cycles).toEqual([])
    expect(data.ab_tests).toEqual([])
    expect(data.recent_window).toBeNull()
    for (const t of ['video_grade_history', 'optimization_cycles', 'ab_tests', 'youtube_video_analytics']) {
      expect(sb.on(t)).toHaveLength(0)
    }
    expect(sb.queries.some(q => q.filters.some(f => f.op === 'in' && (f.value as unknown[]).length === 0))).toBe(false)
  })

  it('canal com vídeos e nenhum histórico → listas vazias (o dado não existe), sem erro', async () => {
    const sb = fakePostgrest({
      tables: twoChannels({ video_grade_history: [], optimization_cycles: [], ab_tests: [] }),
      columns: COLUMNS,
    })
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-a')
    expect(data.videos).toHaveLength(2)
    expect(data.grade_history).toEqual([])
    expect(data.optimization_cycles).toEqual([])
    expect(data.ab_tests).toEqual([])
  })

  it('a leitura dos ids dos vídeos é do canal E do site, e pagina (o teto de 1000 linhas do PostgREST)', async () => {
    const videos = Array.from({ length: 1005 }, (_, i) => video(`v${String(i).padStart(4, '0')}`, 'ch-a'))
    const sb = fakePostgrest({
      tables: twoChannels({ youtube_videos: videos, video_grade_history: [grade('v1004', '2026-W10')], optimization_cycles: [], ab_tests: [] }),
      columns: COLUMNS,
    })
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-a')

    const idReads = sb.on('youtube_videos').filter(q => q.select === 'id')
    expect(idReads.map(q => q.range)).toEqual([[0, 999], [1000, 1999]])
    for (const q of idReads) {
      expect(q.filters).toContainEqual({ op: 'eq', col: 'channel_id', value: 'ch-a' })
      expect(q.filters).toContainEqual({ op: 'eq', col: 'site_id', value: SITE })
      expect(q.orders).toEqual([{ col: 'id', ascending: true }])
    }
    // o vídeo 1005 entra no filtro: a nota dele aparece
    expect(data.grade_history.map(g => g.youtube_video_id)).toEqual(['v1004'])
  })

  it('com mais ids do que cabem numa URL, lê em blocos e junta respeitando ordem e limite', async () => {
    const videos = Array.from({ length: 320 }, (_, i) => video(`v${String(i).padStart(3, '0')}`, 'ch-a'))
    // uma nota por vídeo; semanas crescentes com o índice → as 200 mais recentes são v120..v319
    const grades = videos.map((v, i) => grade(v.id, `2026-W${String(i).padStart(3, '0')}`))
    const tests = videos.slice(0, 30).map((v, i) => abTest(`ab-${String(i).padStart(2, '0')}`, v.id, `2026-09-${String(i + 1).padStart(2, '0')}T00:00:00Z`))
    const cycles = [cycle('cy-0', 'v000'), cycle('cy-319', 'v319')]
    const sb = fakePostgrest({
      tables: twoChannels({ youtube_videos: videos, video_grade_history: grades, optimization_cycles: cycles, ab_tests: tests }),
      columns: COLUMNS,
    })

    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-a')

    const blocos = sb.on('video_grade_history').map(q => (q.filters.find(f => f.op === 'in')!.value as unknown[]).length)
    expect(blocos.length).toBeGreaterThan(1)
    expect(Math.max(...blocos)).toBeLessThanOrEqual(300)
    expect(blocos.reduce((a, b) => a + b, 0)).toBe(320)

    expect(data.grade_history).toHaveLength(200)
    expect(data.grade_history[0]!.week_iso).toBe('2026-W319')
    expect(data.grade_history[199]!.week_iso).toBe('2026-W120')
    expect(data.ab_tests).toHaveLength(20)
    expect(data.ab_tests[0]!.id).toBe('ab-29')
    expect(data.ab_tests[19]!.id).toBe('ab-10')
    expect(Object.keys(data.ab_tests[0]!)).not.toContain('created_at')
    expect(data.optimization_cycles.map(c => c.id).sort()).toEqual(['cy-0', 'cy-319'])
  })

  it.each([
    ['video_grade_history', 'Failed to read the grade history'],
    ['optimization_cycles', 'Failed to read the optimization cycles'],
    ['ab_tests', 'Failed to read the A/B tests'],
  ])('erro em %s → INTERNAL_ERROR 500, como hoje', async (table, message) => {
    const sb = fakePostgrest({
      tables: twoChannels(),
      columns: COLUMNS,
      fail: q => (q.table === table ? { code: '57014', message: 'statement timeout' } : null),
    })
    await expect(getIntelligenceSnapshot(ctxOf(sb), 'ch-a')).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500, message })
  })

  it('erro na leitura dos ids dos vídeos → INTERNAL_ERROR 500, nunca um snapshot sem histórico', async () => {
    const sb = fakePostgrest({
      tables: twoChannels(),
      columns: COLUMNS,
      fail: q => (q.table === 'youtube_videos' && q.select === 'id' ? { code: '57014', message: 'statement timeout' } : null),
    })
    await expect(getIntelligenceSnapshot(ctxOf(sb), 'ch-a')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR', status: 500, message: 'Failed to read the channel videos',
    })
  })

  it('canal de outro site → 404, e nada do canal é lido', async () => {
    const sb = fakePostgrest({ tables: twoChannels(), columns: COLUMNS })
    await expect(getIntelligenceSnapshot(ctxOf(sb, OTHER), 'ch-a')).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 })
    expect(sb.on('youtube_videos')).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// getIntelligenceSnapshot — o canal diz slug, idioma e nicho (só acrescenta)
// ---------------------------------------------------------------------------

describe('getIntelligenceSnapshot — channel.slug, locale, niche e niche_label', () => {
  const tablesWith = (ch: Record<string, unknown>) => twoChannels({ youtube_channels: [channel(ch)] as never, youtube_niches: NICHES as never })

  it('o canal traz slug, locale, niche e niche_label, mantendo as quatro chaves de hoje', async () => {
    const sb = fakePostgrest({ tables: tablesWith({ id: 'ch-a', name: 'Canal A', channel_id: 'UCa', subscriber_count: 100, slug: 'tnfigueiredotv', locale: 'pt', niche: 'viagem' }), columns: COLUMNS })
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-a')
    expect(data.channel).toEqual({
      id: 'ch-a', channel_id: 'UCa', name: 'Canal A', subscriber_count: 100,
      slug: 'tnfigueiredotv', locale: 'pt', niche: 'viagem', niche_label: 'Viagem',
    })
  })

  it('canal sem nicho → niche e niche_label null, e nem lê os nichos', async () => {
    const sb = fakePostgrest({ tables: tablesWith({ id: 'ch-a', niche: null }), columns: COLUMNS })
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-a')
    expect(data.channel).toMatchObject({ niche: null, niche_label: null })
    expect(sb.on('youtube_niches')).toHaveLength(0)
  })

  it('coluna slug ausente (42703) → slug null, em vez de 500', async () => {
    const tables = tablesWith({ id: 'ch-a' })
    tables.youtube_channels = tables.youtube_channels!.map(({ slug: _s, ...rest }) => rest)
    const sb = fakePostgrest({ tables, columns: COLUMNS })
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-a')
    expect(data.channel).toMatchObject({ slug: null, locale: 'pt', niche: 'viagem', niche_label: 'Viagem' })
  })

  it('tabela youtube_niches ausente → niche_label null, o resto intacto', async () => {
    const tables = tablesWith({ id: 'ch-a' })
    delete tables.youtube_niches
    const sb = fakePostgrest({ tables, columns: COLUMNS })
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-a')
    expect(data.channel).toMatchObject({ niche: 'viagem', niche_label: null })
  })
})

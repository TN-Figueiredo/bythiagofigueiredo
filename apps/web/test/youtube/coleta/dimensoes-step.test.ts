// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(),
}))
vi.mock('@/lib/youtube/coleta/alerts', () => ({ avisarEntrada: vi.fn(), avisarSaida: vi.fn() }))

// O teto de consultas (400) é uma constante; o teste o baixa por um getter, sem editar o módulo.
const lim = vi.hoisted(() => ({ max: 400 }))
vi.mock('@/lib/youtube/coleta/e11-config', async (orig) => {
  const m = await orig<typeof import('@/lib/youtube/coleta/e11-config')>()
  const { MAX_CONSULTAS_DIMENSOES: _fixo, ...resto } = m
  void _fixo
  return Object.defineProperty({ ...resto }, 'MAX_CONSULTAS_DIMENSOES', { get: () => lim.max, enumerable: true })
})

import { passoDimensoes, type DimensoesCtx } from '@/lib/youtube/coleta/dimensoes-step'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { avisarEntrada } from '@/lib/youtube/coleta/alerts'
import type { Familia } from '@/lib/youtube/coleta/analytics-dimensoes'
import { fakeSupabase, type FakeDb, type Row } from './fake-supabase'

const AGORA = new Date('2026-10-13T12:05:00.000Z') // 05:05 no Pacífico: hoje = 2026-10-13
const HOJE = '2026-10-13'
const E11 = { desde: '2026-09-20', ligadoEm: '2026-10-10' }
// Com a cobertura em dia (até 12/10), a janela de cada conjunto é [hoje − 10, 12/10] = [03/10, 12/10].
const DE = '2026-10-03'
const ATE = '2026-10-12'

const canal = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true, collection_status: 'ok' as const, video_count: 3 }

const cobBase = (yt: string, to = ATE): Row => ({ youtube_video_id: yt, metric_set: 'base', covered_from: '2026-09-20', covered_to: to, site_id: 'site-1', video_id: `vid-${yt}`, channel_id: 'ch-1' })
const cobSet = (yt: string, set: string, to = ATE): Row => ({ ...cobBase(yt, to), metric_set: set })
const SETS = ['trafego', 'dispositivo', 'pais', 'inscrito']
const completa = (yt: string, to = ATE): Row[] => [cobBase(yt), ...SETS.map(s => cobSet(yt, s, to))]
const view = (yt: string, day: string, views = 10): Row => ({ youtube_video_id: yt, day_pt: day, channel_id: 'ch-1', site_id: 'site-1', views })

const PROVA = {
  faltando_cobertura: 0, videos_com_base: 1, videos_base_antes_do_inicio: 0, videos_sem_base: 0, base_ate: ATE,
  dias_dois_relatorios_detalhe: 0, dias_dois_relatorios_alcance: 0, pendentes_normalizar: 0,
}

// ── Banco falso com as funções da MG7 ──────────────────────────────────────
function montar(cobertura: Row[], diario: Row[] = []): FakeDb {
  const db = fakeSupabase({ youtube_channels: [{ ...canal }], yt_own_video_coverage: cobertura, yt_own_video_daily: diario })
  db.rpcHandlers.yt_own_dim_prova = () => ({ data: PROVA, error: null })
  db.rpcHandlers.yt_own_dim_cover_idle = () => ({ data: { videos_com_base: 1, conjuntos_cobertos: 0, videos_com_view: 0 }, error: null })
  db.rpcHandlers.yt_own_dim_apply = (a) => ({
    data: { status: 'gravado', base_ate: ATE, coberto_ate: a.p_to, gravadas: (a.p_rows as unknown[]).length, apagadas: 0, fora_do_teto: 0, dias_mantidos: 0, dias_em_revisao: 0 },
    error: null,
  })
  return db
}

// ── fetch falso que registra as consultas ──────────────────────────────────
interface Consulta { familia: Familia; inicio: string; fim: string; video: string; metrics: string; comDia: boolean }
const FAMILIA_DA_DIMENSAO: Record<string, Familia> = {
  'day,insightTrafficSourceType': 'traffic_source',
  'day,deviceType,operatingSystem': 'device_os',
  country: 'country',
  'day,subscribedStatus': 'subscribed_status',
}
const COLUNAS: Record<Familia, string[]> = {
  traffic_source: ['day', 'insightTrafficSourceType'],
  device_os: ['day', 'deviceType', 'operatingSystem'],
  country: ['country'],
  subscribed_status: ['day', 'subscribedStatus'],
}
const PREFIXO: Record<Familia, (inicio: string) => unknown[]> = {
  traffic_source: d => [d, 'YT_SEARCH'],
  device_os: d => [d, 'MOBILE', 'ANDROID'],
  country: () => ['BR'],
  subscribed_status: d => [d, 'SUBSCRIBED'],
}
const corpo = (q: Consulta, rows?: unknown[][]) => {
  const comEng = q.metrics.includes('engagedViews')
  return {
    columnHeaders: [...COLUNAS[q.familia], 'views', 'estimatedMinutesWatched', ...(comEng ? ['engagedViews'] : [])].map(name => ({ name })),
    rows: rows ?? [[...PREFIXO[q.familia](q.inicio), 5, 2, ...(comEng ? [4] : [])]],
  }
}
const erroGoogle = (reason?: string) => ({ error: { errors: reason ? [{ reason }] : [] } })

type Resp = { status?: number; body?: unknown } | undefined
let consultas: Consulta[]
let responder: (q: Consulta) => Resp
const urlsVistas = () => consultas.length

function instalarFetch(): void {
  consultas = []
  responder = () => undefined
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = new URL(url)
    const dims = u.searchParams.get('dimensions') ?? ''
    const q: Consulta = {
      familia: FAMILIA_DA_DIMENSAO[dims]!, inicio: u.searchParams.get('startDate')!, fim: u.searchParams.get('endDate')!,
      video: (u.searchParams.get('filters') ?? '').replace('video==', ''), metrics: u.searchParams.get('metrics') ?? '', comDia: dims.startsWith('day,'),
    }
    consultas.push(q)
    const r = responder(q)
    return new Response(JSON.stringify(r?.body ?? ((r?.status ?? 200) >= 400 ? erroGoogle() : corpo(q))), { status: r?.status ?? 200 })
  }))
}

// ── Execução ───────────────────────────────────────────────────────────────
function ctxDe(db: FakeDb, o: { prazoMs?: number; e11?: unknown; semToken?: boolean } = {}): DimensoesCtx {
  return {
    supabase: db.client, channels: [{ ...canal }], deadline: Date.now() + (o.prazoMs ?? 60_000), falhas: [], tentativas: [],
    autorizados: new Set(), negados: new Set(), e11: (o.e11 ?? E11) as typeof E11,
    ...(o.semToken ? {} : { token: async () => 'tok' }),
  }
}
const rodar = async (db: FakeDb, o: Parameters<typeof ctxDe>[1] = {}) => {
  const ctx = ctxDe(db, o)
  const r = await passoDimensoes(ctx)
  return { r, ctx }
}
const applies = (db: FakeDb, kind?: string) => db.rpcCalls.filter(c => c.name === 'yt_own_dim_apply' && (!kind || c.args.p_kind === kind))
const chamadas = (db: FakeDb, nome: string) => db.rpcCalls.filter(c => c.name === nome)
const tent = (db: FakeDb, scope: string, id: string) =>
  db.tables.yt_own_collection_attempts?.find(r => r.scope_type === scope && r.scope_id === id && r.kind === 'dimensoes')

beforeEach(() => {
  vi.clearAllMocks()
  lim.max = 400
  delete process.env.YT_OWN_STEPS_OFF
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
  vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c1' } as never)
  instalarFetch()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  delete process.env.YT_OWN_STEPS_OFF
})

describe('passoDimensoes: o que não gera chamada', () => {
  it('nenhum vídeo: nada a consultar, uma função de cobertura por canal, canal ok', async () => {
    const db = montar([])
    const { r, ctx } = await rodar(db)
    expect(urlsVistas()).toBe(0)
    expect(chamadas(db, 'yt_own_dim_cover_idle')).toHaveLength(1)
    expect(applies(db)).toHaveLength(0)
    expect(r.videos_com_view).toBe(0)
    expect(ctx.falhas).toEqual([])
    expect(tent(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'ok' })
  })

  it('vídeo sem view não gera chamada (item 91): 3 vídeos, 0 consultas, 1 cover_idle', async () => {
    const db = montar([...completa('a'), ...completa('b'), ...completa('c')])
    db.rpcHandlers.yt_own_dim_cover_idle = () => ({ data: { videos_com_base: 3, conjuntos_cobertos: 12, videos_com_view: 0 }, error: null })
    const { r } = await rodar(db)
    expect(urlsVistas()).toBe(0)
    expect(chamadas(db, 'yt_own_dim_cover_idle')).toHaveLength(1)
    expect(chamadas(db, 'yt_own_dim_cover_idle')[0]!.args).toEqual({ p_channel: 'ch-1', p_inicio: E11.desde, p_janela: DE, p_to: HOJE })
    expect(applies(db)).toHaveLength(0)
    expect(r.conjuntos_cobertos_sem_api).toBe(12)
  })

  it('o diário só vale dentro da janela: view há 30 dias não conta', async () => {
    const db = montar(completa('a'), [view('a', '2026-09-13')])
    await rodar(db)
    expect(urlsVistas()).toBe(0)
  })
})

describe('passoDimensoes: LIDO é diferente de "não li"', () => {
  it('vídeo com view cuja resposta vem vazia: grava as 4 famílias com lista vazia (lido) e a tentativa é sem_dado_na_janela', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    responder = q => ({ body: corpo(q, []) })
    const { r, ctx } = await rodar(db)
    expect(applies(db)).toHaveLength(4)
    for (const a of applies(db)) expect(a.args.p_rows).toEqual([])
    const pais = applies(db, 'country')[0]!.args
    expect(pais).toMatchObject({ p_video: 'a', p_from: DE, p_to: ATE, p_site: 'site-1', p_video_id: 'vid-a', p_channel: 'ch-1' })
    expect(tent(db, 'video', 'a')).toMatchObject({ outcome: 'sem_dado_na_janela', error: null })
    expect(ctx.falhas).toEqual([])
    expect(r.gravados).toBe(0)
  })

  it('API que não respondeu ao dia: NADA é gravado para aquela família (não lido não vira zero)', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-03')]) // view no 1º dia da janela
    responder = q => (q.familia === 'country' ? { status: 500 } : undefined)
    const { ctx } = await rodar(db)
    expect(applies(db, 'country')).toHaveLength(0)
    expect(applies(db)).toHaveLength(3)
    expect(tent(db, 'video', 'a')).toMatchObject({ outcome: 'erro_http', error: 'http_500', http_status: 500 })
    // O canal herda o erro do vídeo: nunca "ok" com um vídeo que falhou.
    expect(tent(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'erro_http', error: 'http_500' })
    expect(ctx.falhas.join('\n')).toContain('1 de 1 vídeos com erro')
  })
})

describe('passoDimensoes: gravação única da família por_dia', () => {
  it('2 dias com view → 5 consultas e 4 gravações; o país vai de uma vez, com a janela inteira', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05'), view('a', '2026-10-08')])
    const { r } = await rodar(db)
    expect(urlsVistas()).toBe(5)
    expect(applies(db)).toHaveLength(4)
    const pais = applies(db, 'country')
    expect(pais).toHaveLength(1)
    expect(pais[0]!.args.p_from).toBe(DE)
    expect(pais[0]!.args.p_to).toBe(ATE)
    expect((pais[0]!.args.p_rows as Array<{ day_pt: string; dim_value: string }>).map(l => l.day_pt)).toEqual(['2026-10-05', '2026-10-08'])
    expect(consultas.filter(q => q.familia === 'country').map(q => [q.inicio, q.fim])).toEqual([['2026-10-05', '2026-10-05'], ['2026-10-08', '2026-10-08']])
    expect(r.consultas).toBe(5)
    expect(tent(db, 'video', 'a')).toMatchObject({ outcome: 'ok' })
  })

  it('cada linha leva a versão de métrica do dia e deixa de fora a métrica que não veio', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    responder = q => ({ body: { columnHeaders: [...COLUNAS[q.familia], 'views', 'estimatedMinutesWatched'].map(name => ({ name })), rows: [[...PREFIXO[q.familia]('2026-10-05'), 7, 3]] } })
    await rodar(db)
    const linha = (applies(db, 'country')[0]!.args.p_rows as Array<Record<string, unknown>>)[0]!
    expect(linha).toEqual({ day_pt: '2026-10-05', dim_value: 'BR', views: 7, watch_time_minutes: 3, metric_version: 'views_desde_2026-08-27' })
    expect('engaged_views' in JSON.parse(JSON.stringify(linha))).toBe(false)
  })

  it('o dia com view que falhou corta a cobertura no dia anterior; o seguinte não é consultado (dados I-5)', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-04'), view('a', '2026-10-06'), view('a', '2026-10-08')])
    responder = q => (q.familia === 'country' && q.inicio === '2026-10-06' ? { status: 500 } : undefined)
    await rodar(db)
    expect(consultas.filter(q => q.familia === 'country').map(q => q.inicio)).toEqual(['2026-10-04', '2026-10-06'])
    const pais = applies(db, 'country')
    expect(pais).toHaveLength(1)
    expect(pais[0]!.args.p_from).toBe(DE)
    expect(pais[0]!.args.p_to).toBe('2026-10-05')
    expect((pais[0]!.args.p_rows as Array<{ day_pt: string }>).map(l => l.day_pt)).toEqual(['2026-10-04'])
    expect(tent(db, 'video', 'a')).toMatchObject({ outcome: 'erro_http', error: 'http_500' })
  })

  it('o primeiro dia com view falha: cobre os dias sem view antes dele, com lista vazia', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')]) // o 3º dia da janela
    responder = q => (q.familia === 'country' ? { status: 500 } : undefined)
    await rodar(db)
    const pais = applies(db, 'country')
    expect(pais).toHaveLength(1)
    expect(pais[0]!.args.p_to).toBe('2026-10-04')
    expect(pais[0]!.args.p_rows).toEqual([])
  })

  it('o primeiro dia com view é o 1º da janela e falha: nenhuma chamada de gravação do país', async () => {
    const db = montar(completa('a'), [view('a', DE)])
    responder = q => (q.familia === 'country' ? { status: 500 } : undefined)
    await rodar(db)
    expect(applies(db, 'country')).toHaveLength(0)
  })

  it('sem tempo no meio dos dias: grava até o dia anterior ao 2º, nao_alcancado_orcamento, pendentes 1', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-04'), view('a', '2026-10-06')])
    // A 1ª consulta de país leva o relógio a menos de 3 s do fim do prazo.
    responder = q => {
      if (q.familia === 'country') vi.setSystemTime(Date.now() + 8_000)
      return undefined
    }
    const { r } = await rodar(db, { prazoMs: 10_000 })
    expect(consultas.filter(q => q.familia === 'country')).toHaveLength(1)
    const pais = applies(db, 'country')
    expect(pais).toHaveLength(1)
    expect(pais[0]!.args.p_to).toBe('2026-10-05')
    expect(tent(db, 'video', 'a')).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
    expect(r.pendentes).toBe(1)
  })
})

describe('passoDimensoes: janela', () => {
  it('nenhuma chamada antes da data de partida (item 228)', async () => {
    const db = montar([cobBase('a')], [view('a', '2026-09-13'), view('a', '2026-10-05')])
    await rodar(db, { e11: { desde: DE, ligadoEm: '2026-10-10' } })
    expect(urlsVistas()).toBeGreaterThan(0)
    for (const q of consultas) expect(q.inicio >= DE).toBe(true)
  })

  it('parado há 20 dias: a janela volta até o último dia coberto', async () => {
    const db = montar(completa('a', '2026-09-23').map(l => (l.metric_set === 'base' ? { ...l, covered_to: ATE } : l)), [view('a', '2026-10-05')])
    await rodar(db, { e11: { desde: '2026-09-03', ligadoEm: '2026-10-10' } })
    const comDia = consultas.filter(q => q.comDia)
    expect(comDia).toHaveLength(3)
    for (const q of comDia) expect(q.inicio).toBe('2026-09-23')
  })

  it('o diário é lido a partir do menor começo de janela, nunca da data de partida (dados I-3)', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    const gtes: Array<[string, unknown]> = []
    const original = db.client.from.bind(db.client)
    db.client.from = ((t: string) => {
      const q = original(t)
      if (t === 'yt_own_video_daily') {
        const g = q.gte.bind(q)
        q.gte = ((c: string, v: unknown) => { gtes.push([c, v]); return g(c, v) }) as typeof q.gte
      }
      return q
    }) as typeof db.client.from
    await rodar(db, { e11: { desde: '2023-01-01', ligadoEm: '2026-10-10' } })
    expect(gtes).toEqual([['day_pt', DE]])
  })

  it('quem ficou para trás entra primeiro: B (nunca coberto) antes de A (coberto ontem)', async () => {
    const db = montar([...completa('a'), cobBase('b')], [view('a', '2026-10-05'), view('b', '2026-10-05')])
    await rodar(db)
    expect(consultas[0]!.video).toBe('b')
  })
})

describe('passoDimensoes: orçamento', () => {
  it('menos de 3 s de prazo: nada é chamado (nem função de banco), canal nao_alcancado_orcamento', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    const { r } = await rodar(db, { prazoMs: 2_000 })
    expect(db.rpcCalls.filter(c => c.name !== 'yt_own_attempt_record')).toHaveLength(0)
    expect(urlsVistas()).toBe(0)
    expect(tent(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
    expect(r.pendentes).toBe(1)
  })

  it('sem tempo não começa vídeo novo: os que sobram ficam nao_alcancado_orcamento e contam em pendentes', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const db = montar(ids.flatMap(id => completa(id)), ids.map(id => view(id, '2026-10-05')))
    let primeira = true
    responder = () => {
      if (primeira) { primeira = false; vi.setSystemTime(Date.now() + 8_000) }
      return undefined
    }
    const { r } = await rodar(db, { prazoMs: 10_000 })
    const naoAlcancados = ids.filter(id => tent(db, 'video', id)?.outcome === 'nao_alcancado_orcamento')
    expect(naoAlcancados.length).toBeGreaterThanOrEqual(2)
    expect(r.pendentes).toBe(naoAlcancados.length)
    expect(urlsVistas()).toBeLessThan(ids.length * 4)
    // O que não começou não vira "ok": nenhuma tentativa ok para vídeo sem gravação.
    for (const id of ids) {
      if (tent(db, 'video', id)?.outcome === 'ok') expect(applies(db).some(a => a.args.p_video === id)).toBe(true)
    }
  })

  it('função de banco que não responde vira pendente, sem exceção', async () => {
    vi.useRealTimers()
    vi.useFakeTimers({ now: AGORA })
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    db.rpcHandlers.yt_own_dim_apply = () => new Promise(() => {})
    const ctx = ctxDe(db)
    let terminou = false
    const p = passoDimensoes(ctx).finally(() => { terminou = true })
    // Avança o relógio aos poucos: o prazo da função só é armado depois de várias esperas encadeadas.
    for (let i = 0; i < 60 && !terminou; i++) await vi.advanceTimersByTimeAsync(1_000)
    const r = await p
    expect(r.pendentes).toBeGreaterThanOrEqual(1)
    expect(tent(db, 'video', 'a')).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
  })

  it('teto de consultas: o que passa do teto é cortado, contado e anotado', async () => {
    lim.max = 4
    const db = montar([...completa('a'), ...completa('b')], [view('a', '2026-10-05'), view('b', '2026-10-05')])
    const { r, ctx } = await rodar(db)
    expect(r.consultas).toBeLessThanOrEqual(4)
    expect(urlsVistas()).toBeLessThanOrEqual(4)
    expect(r.consultas_cortadas).toBeGreaterThan(0)
    expect(r.pendentes).toBeGreaterThan(0)
    expect(ctx.falhas.join('\n')).toContain('teto de 4 consultas por execução atingido')
  })

  it('métrica estendida recusada: repete sem ela, conta as duas chamadas e anota', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    responder = q => (q.metrics.includes('engagedViews') ? { status: 400 } : undefined)
    const { r, ctx } = await rodar(db)
    expect(r.consultas).toBe(8)
    expect(r.estendidas_recusadas).toBe(4)
    expect(applies(db)).toHaveLength(4)
    expect(ctx.falhas.join('\n')).toContain('recusou as métricas estendidas')
  })
})

describe('passoDimensoes: erros da API', () => {
  it('200 sem cabeçalho é erro, não vazio: nenhuma gravação daquela família', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    responder = q => (q.familia === 'device_os' ? { body: {} } : undefined)
    const { ctx } = await rodar(db)
    expect(applies(db, 'device_os')).toHaveLength(0)
    expect(applies(db)).toHaveLength(3)
    expect(tent(db, 'video', 'a')).toMatchObject({ outcome: 'erro_http', error: 'forma_inesperada' })
    expect(JSON.stringify(ctx.falhas)).not.toContain('http_200')
  })

  it('erro depois da repetição sem métrica estendida: as duas chamadas entram na conta (400 e depois 500)', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    responder = q => (q.metrics.includes('engagedViews') ? { status: 400 } : { status: 500 })
    const { r } = await rodar(db)
    // 4 famílias, 2 chamadas cada: o contador acompanha o que de fato foi à API.
    expect(urlsVistas()).toBe(8)
    expect(r.consultas).toBe(8)
    expect(tent(db, 'video', 'a')).toMatchObject({ outcome: 'erro_http', error: 'http_500' })
  })

  it.each([
    ['cota esgotada (403 quotaExceeded)', { status: 403, body: erroGoogle('quotaExceeded') }, 'erro_http'],
    ['perda de autorização (401)', { status: 401 }, 'sem_autorizacao'],
  ] as const)('%s num vídeo não remarca o vídeo que já terminou bem', async (_nome, falha, esperadoCanal) => {
    // A tem 1 dia de país; B tem 2. O 2º dia de B falha depois de A já ter gravado tudo.
    const db = montar([...completa('a'), ...completa('b')], [view('a', '2026-10-04'), view('b', '2026-10-04'), view('b', '2026-10-06')])
    responder = q => (q.video === 'b' && q.familia === 'country' && q.inicio === '2026-10-06' ? falha : undefined)
    const { ctx } = await rodar(db)
    expect(applies(db).filter(a => a.args.p_video === 'a')).toHaveLength(4)
    expect(tent(db, 'video', 'a')).toMatchObject({ outcome: 'ok' })
    expect(tent(db, 'video', 'b')?.outcome).not.toBe('ok')
    expect(tent(db, 'canal', 'ch-1')).toMatchObject({ outcome: esperadoCanal })
    if (esperadoCanal === 'erro_http') expect(ctx.falhas.join('\n')).toContain('1 de 2 vídeos com erro')
  })

  it('401 marca reautorizar uma vez e para o canal', async () => {
    const db = montar([...completa('a'), ...completa('b')], [view('a', '2026-10-05'), view('b', '2026-10-05')])
    responder = () => ({ status: 401 })
    await rodar(db)
    expect(avisarEntrada).toHaveBeenCalledTimes(1)
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'reautorizar' })
    expect(applies(db)).toHaveLength(0)
    expect(tent(db, 'video', 'a')).toMatchObject({ outcome: 'sem_autorizacao', http_status: 401 })
    expect(tent(db, 'video', 'b')).toMatchObject({ outcome: 'sem_autorizacao' })
    expect(tent(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'sem_autorizacao' })
  })

  it('cota esgotada não marca reautorizar: nota de cota e error = http_403_quotaExceeded', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    responder = () => ({ status: 403, body: erroGoogle('quotaExceeded') })
    const { ctx } = await rodar(db)
    expect(avisarEntrada).not.toHaveBeenCalled()
    expect(db.tables.youtube_channels![0]).toMatchObject({ collection_status: 'ok' })
    expect(ctx.falhas).toContain('dimensões: cota da Analytics API esgotada')
    expect(tent(db, 'video', 'a')).toMatchObject({ outcome: 'erro_http', error: 'http_403_quotaExceeded' })
  })

  it('reason livre do Google não vai à coluna nem à nota (R3)', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    const livre = 'Texto livre do Google com dado privado'
    responder = () => ({ status: 403, body: erroGoogle(livre) })
    const { ctx } = await rodar(db)
    expect(tent(db, 'video', 'a')).toMatchObject({ outcome: 'erro_http', error: 'http_403' })
    expect(JSON.stringify(db.tables.yt_own_collection_attempts)).not.toContain('privado')
    expect(JSON.stringify(ctx.falhas)).not.toContain('privado')
  })

  it('400 numa família com_dia não troca de modo: nota da família e as outras gravam', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    responder = q => (q.familia === 'device_os' ? { status: 400, body: erroGoogle('badRequest') } : undefined)
    const { ctx } = await rodar(db)
    expect(ctx.falhas).toContain('dimensões: a API recusou a consulta de aparelho e sistema (HTTP 400)')
    expect(applies(db).map(a => a.args.p_kind).sort()).toEqual(['country', 'subscribed_status', 'traffic_source'])
    expect(consultas.filter(q => q.familia === 'device_os').every(q => q.comDia)).toBe(true)
  })

  it('valor de dimensão fora do formato é descartado, contado e anotado', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    responder = q => (q.familia === 'country' ? { body: corpo(q, [['br', 5, 2, 4], ['BR', 6, 2, 4]]) } : undefined)
    const { r, ctx } = await rodar(db)
    expect(r.valores_invalidos).toBe(1)
    expect(ctx.falhas.join('\n')).toContain('1 valor(es) de dimensão em formato inesperado')
    expect((applies(db, 'country')[0]!.args.p_rows as unknown[]).length).toBe(1)
  })
})

describe('passoDimensoes: banco', () => {
  it('schema ausente na guarda não chama a API', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    delete db.rpcHandlers.yt_own_dim_prova // o falso responde PGRST202
    const { ctx } = await rodar(db)
    expect(urlsVistas()).toBe(0)
    expect(ctx.falhas).toContain('schema_ausente: MG7 não aplicada (yt_own_dim_prova)')
    expect(tent(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'schema_ausente' })
  })

  it('função de gravação ausente (PGRST202) é schema_ausente em falhas, nunca "ok com zero"', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    delete db.rpcHandlers.yt_own_dim_apply
    const { r, ctx } = await rodar(db)
    expect(ctx.falhas).toContain('schema_ausente: yt_own_dim_apply')
    expect(tent(db, 'video', 'a')).toMatchObject({ outcome: 'schema_ausente' })
    expect(tent(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'schema_ausente' })
    expect(r.gravados).toBe(0)
    expect(r.tentativas.ok).toBeUndefined()
  })

  it('erro de banco na função: erro_de_banco, sem message nem details em nenhum lugar; o passo segue', async () => {
    const db = montar([...completa('a'), ...completa('b')], [view('a', '2026-10-05'), view('b', '2026-10-05')])
    db.errors['rpc:yt_own_dim_apply'] = { code: 'XX000', message: 'SEGREDO-DA-MENSAGEM', details: 'SEGREDO-DOS-DETALHES' } as never
    const { ctx } = await rodar(db)
    expect(tent(db, 'video', 'a')).toMatchObject({ outcome: 'erro_http', error: 'erro_de_banco' })
    expect(tent(db, 'video', 'b')).toMatchObject({ outcome: 'erro_http', error: 'erro_de_banco' })
    const tudo = JSON.stringify([db.tables.yt_own_collection_attempts, ctx.falhas, ctx.tentativas])
    expect(tudo).not.toContain('SEGREDO')
    expect(ctx.falhas.join('\n')).toContain('2 de 2 vídeos com erro')
  })

  it('resposta da função em forma estranha não vira ok', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    db.rpcHandlers.yt_own_dim_apply = () => ({ data: { status: 'gravado' }, error: null })
    await rodar(db)
    expect(tent(db, 'video', 'a')).toMatchObject({ outcome: 'erro_http', error: 'forma_inesperada' })
  })

  it('status desconhecido na resposta da função, mesmo com os cinco números válidos, não vira ok', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    db.rpcHandlers.yt_own_dim_apply = () => ({
      data: { status: 'qualquer', gravadas: 0, apagadas: 0, fora_do_teto: 0, dias_mantidos: 0, dias_em_revisao: 0 }, error: null,
    })
    const { r } = await rodar(db)
    expect(tent(db, 'video', 'a')).toMatchObject({ outcome: 'erro_http', error: 'forma_inesperada' })
    expect(r.gravados).toBe(0)
  })

  it('base_sem_cobertura não conta como gravado: fica pendente', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    db.rpcHandlers.yt_own_dim_apply = () => ({
      data: { status: 'base_sem_cobertura', base_ate: null, coberto_ate: null, gravadas: 0, apagadas: 0, fora_do_teto: 2, dias_mantidos: 0, dias_em_revisao: 0 }, error: null,
    })
    const { r } = await rodar(db)
    expect(tent(db, 'video', 'a')).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
    expect(r.pendentes).toBe(1)
    expect(r.fora_do_teto).toBe(8)
  })

  it('soma os contadores das funções', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    db.rpcHandlers.yt_own_dim_apply = () => ({
      data: { status: 'gravado', base_ate: ATE, coberto_ate: ATE, gravadas: 5, apagadas: 0, fora_do_teto: 3, dias_mantidos: 1, dias_em_revisao: 2 }, error: null,
    })
    const { r } = await rodar(db)
    expect(r).toMatchObject({ gravados: 20, dias_mantidos: 4, dias_em_revisao: 8, fora_do_teto: 12 })
  })

  it('leitura truncada falha: 20.001 linhas de cobertura, nota com o número, canal pulado', async () => {
    const muitas: Row[] = Array.from({ length: 20_001 }, (_, i) => cobBase(`v${String(i).padStart(6, '0')}`))
    const db = montar(muitas, [view('v000000', '2026-10-05')])
    const { ctx } = await rodar(db)
    expect(ctx.falhas.join('\n')).toContain('20001')
    expect(urlsVistas()).toBe(0)
    expect(applies(db)).toHaveLength(0)
    expect(tent(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'erro_http' })
  }, 30_000)

  it('função de cobertura dos parados com forma estranha: canal em erro, nada consultado', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    db.rpcHandlers.yt_own_dim_cover_idle = () => ({ data: { videos_com_base: 1 }, error: null })
    const { ctx } = await rodar(db)
    expect(urlsVistas()).toBe(0)
    expect(tent(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'erro_http', error: 'forma_inesperada' })
    expect(ctx.falhas.join('\n')).toContain('forma inesperada')
  })
})

describe('passoDimensoes: configuração, interruptor e token', () => {
  it('configuração inválida: nota e nenhuma chamada', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    const { ctx } = await rodar(db, { e11: { desde: '', ligadoEm: '' } })
    expect(ctx.falhas).toEqual(['dimensões: data de partida inválida (e11-config.ts)'])
    expect(urlsVistas()).toBe(0)
    expect(db.rpcCalls).toHaveLength(0)
  })

  it('passo desligado: resumo diz desligado, nenhuma chamada nem tentativa (nunca "ok")', async () => {
    process.env.YT_OWN_STEPS_OFF = 'dimensoes'
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    const { r, ctx } = await rodar(db)
    expect(r.desligado).toBe(true)
    expect(urlsVistas()).toBe(0)
    expect(db.rpcCalls).toHaveLength(0)
    expect(ctx.tentativas).toEqual([])
    expect(r.tentativas).toEqual({})
  })

  it('sem a variável o passo roda (apaga a variável e afirma o padrão)', async () => {
    delete process.env.YT_OWN_STEPS_OFF
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    const { r } = await rodar(db)
    expect(r.desligado).toBeUndefined()
    expect(urlsVistas()).toBe(4)
  })

  it('outro passo desligado não desliga este', async () => {
    process.env.YT_OWN_STEPS_OFF = 'retencao,normalizadores'
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    const { r } = await rodar(db)
    expect(r.desligado).toBeUndefined()
    expect(urlsVistas()).toBe(4)
  })

  it('com token injetado, obterToken não é chamado e nada é gravado em social_connections (R6)', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    await rodar(db)
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(db.writes.filter(w => w.table === 'social_connections')).toEqual([])
  })

  it('sem injeção, o token vem de obterToken', async () => {
    const db = montar(completa('a'), [view('a', '2026-10-05')])
    await rodar(db, { semToken: true })
    expect(ensureFreshToken).toHaveBeenCalledTimes(1)
    expect(urlsVistas()).toBe(4)
  })

  it('canal sem vídeo com view não pede token', async () => {
    const db = montar(completa('a'))
    await rodar(db, { semToken: true })
    expect(ensureFreshToken).not.toHaveBeenCalled()
  })
})

// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { AnalyticsApiError } from '@/lib/youtube/coleta/analytics-diario'
import {
  DIMENSOES_DA_FAMILIA,
  MODO_DA_FAMILIA,
  dimensaoDoVideo,
  type Familia,
} from '@/lib/youtube/coleta/analytics-dimensoes'

const resp = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status })
const cab = (...nomes: string[]) => nomes.map(name => ({ name }))

// Forma das fixtures da conferência C0.2 (c02-pais-um-dia.json e c02-day-country.json), embutida.
const PAIS_UM_DIA = {
  columnHeaders: cab('country', 'views', 'estimatedMinutesWatched'),
  rows: [['BR', 191, 1466], ['CA', 13, 52]],
}
const DAY_COUNTRY_400 = {
  error: {
    code: 400,
    message: 'The query is not supported.',
    errors: [{ message: 'The query is not supported.', domain: 'global', reason: 'badRequest' }],
  },
}

type Entrada = Parameters<typeof dimensaoDoVideo>[0]
const base = (f: ReturnType<typeof vi.fn>, extra: Partial<Entrada> = {}): Entrada => ({
  token: 'tok',
  canalUc: 'UCabc',
  videoId: 'vid12345678',
  familia: 'traffic_source',
  inicio: '2026-10-01',
  fim: '2026-10-07',
  f: f as unknown as typeof fetch,
  ...extra,
})

describe('catálogo da família', () => {
  it('modo e dimensões de cada família', () => {
    expect(MODO_DA_FAMILIA).toEqual({
      traffic_source: 'com_dia',
      device_os: 'com_dia',
      subscribed_status: 'com_dia',
      country: 'por_dia',
    })
    expect(DIMENSOES_DA_FAMILIA).toEqual({
      traffic_source: 'insightTrafficSourceType',
      device_os: 'deviceType,operatingSystem',
      country: 'country',
      subscribed_status: 'subscribedStatus',
    })
  })
})

describe('dimensaoDoVideo', () => {
  it('país de um dia', async () => {
    const f = vi.fn().mockResolvedValue(resp(PAIS_UM_DIA))
    const r = await dimensaoDoVideo(base(f, { familia: 'country', inicio: '2026-10-05', fim: '2026-10-05' }))
    expect(r.estendidas).toBe('ok')
    expect(r.invalidas).toBe(0)
    expect(r.linhas).toEqual([
      { day: '2026-10-05', valor: 'BR', views: 191, watch_time_minutes: 1466 },
      { day: '2026-10-05', valor: 'CA', views: 13, watch_time_minutes: 52 },
    ])
  })

  it('dia sem view', async () => {
    const f = vi.fn().mockResolvedValue(resp({ columnHeaders: cab('country', 'views'), rows: [] }))
    const r = await dimensaoDoVideo(base(f, { familia: 'country', inicio: '2026-10-05', fim: '2026-10-05' }))
    expect(r.linhas).toEqual([])
    const g = vi.fn().mockResolvedValue(resp({ columnHeaders: cab('country', 'views') }))
    expect((await dimensaoDoVideo(base(g, { familia: 'country', inicio: '2026-10-05', fim: '2026-10-05' }))).linhas).toEqual([])
  })

  it('200 sem cabeçalho', async () => {
    const f = vi.fn().mockResolvedValue(resp({}))
    await expect(dimensaoDoVideo(base(f))).rejects.toMatchObject({ status: 200, reason: 'corpo_sem_cabecalho' })
    await expect(dimensaoDoVideo(base(f))).rejects.toBeInstanceOf(AnalyticsApiError)
  })

  it('corpo ilegível', async () => {
    const f = vi.fn().mockResolvedValue(new Response('<html>', { status: 200 }))
    await expect(dimensaoDoVideo(base(f))).rejects.toMatchObject({ status: 200, reason: 'corpo_invalido' })
  })

  it('day,country recusado', async () => {
    const f = vi.fn().mockImplementation(async () => resp(DAY_COUNTRY_400, 400))
    const e = await dimensaoDoVideo(base(f, { familia: 'country', inicio: '2026-10-05', fim: '2026-10-05' })).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(AnalyticsApiError)
    expect(e).toMatchObject({ status: 400, reason: 'badRequest' })
    expect(JSON.stringify(e)).not.toContain('not supported')
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('erro que não é 400 não repete e não guarda o corpo', async () => {
    const f = vi.fn().mockResolvedValue(resp({ error: { message: 'segredo', errors: [{ reason: 'quotaExceeded' }] } }, 403))
    const e = await dimensaoDoVideo(base(f)).catch((x: unknown) => x)
    expect(e).toMatchObject({ status: 403, reason: 'quotaExceeded' })
    expect(String((e as Error).message)).not.toContain('segredo')
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('métrica ausente não vira zero', async () => {
    const f = vi.fn().mockResolvedValue(resp({
      columnHeaders: cab('day', 'insightTrafficSourceType', 'views'),
      rows: [['2026-10-02', 'YT_SEARCH', 7]],
    }))
    const r = await dimensaoDoVideo(base(f))
    expect(r.linhas).toEqual([{ day: '2026-10-02', valor: 'YT_SEARCH', views: 7 }])
    expect('watch_time_minutes' in r.linhas[0]!).toBe(false)
    expect('engaged_views' in r.linhas[0]!).toBe(false)
  })

  it('valor numérico nulo na linha não vira zero', async () => {
    const f = vi.fn().mockResolvedValue(resp({
      columnHeaders: cab('day', 'subscribedStatus', 'views', 'estimatedMinutesWatched', 'engagedViews'),
      rows: [['2026-10-02', 'SUBSCRIBED', 4, null, 2]],
    }))
    const r = await dimensaoDoVideo(base(f, { familia: 'subscribed_status' }))
    expect(r.linhas).toEqual([{ day: '2026-10-02', valor: 'SUBSCRIBED', views: 4, engaged_views: 2 }])
  })

  it('engagedViews recusada', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(resp(DAY_COUNTRY_400, 400))
      .mockResolvedValueOnce(resp({
        columnHeaders: cab('day', 'insightTrafficSourceType', 'views', 'estimatedMinutesWatched'),
        rows: [['2026-10-02', 'YT_SEARCH', 7, 20]],
      }))
    const r = await dimensaoDoVideo(base(f))
    expect(r.estendidas).toBe('recusadas')
    expect(f).toHaveBeenCalledTimes(2)
    const m1 = new URL(String(f.mock.calls[0]![0])).searchParams.get('metrics')
    const m2 = new URL(String(f.mock.calls[1]![0])).searchParams.get('metrics')
    expect(m1).toBe('views,estimatedMinutesWatched,engagedViews')
    expect(m2).toBe('views,estimatedMinutesWatched')
    expect(r.linhas).toEqual([{ day: '2026-10-02', valor: 'YT_SEARCH', views: 7, watch_time_minutes: 20 }])
  })

  it('aparelho e sistema viram um valor', async () => {
    const f = vi.fn().mockResolvedValue(resp({
      columnHeaders: cab('day', 'deviceType', 'operatingSystem', 'views', 'estimatedMinutesWatched'),
      rows: [['2026-10-05', 'MOBILE', 'ANDROID', 3, 1]],
    }))
    const r = await dimensaoDoVideo(base(f, { familia: 'device_os' }))
    expect(r.linhas).toEqual([{ day: '2026-10-05', valor: 'MOBILE|ANDROID', views: 3, watch_time_minutes: 1 }])
  })

  it('valor inválido sai e é contado', async () => {
    const f = vi.fn().mockResolvedValue(resp({
      columnHeaders: cab('country', 'views'),
      rows: [['br', 3], ['BR', 5], ['USA', 1]],
    }))
    const r = await dimensaoDoVideo(base(f, { familia: 'country', inicio: '2026-10-05', fim: '2026-10-05' }))
    expect(r.linhas).toEqual([{ day: '2026-10-05', valor: 'BR', views: 5 }])
    expect(r.invalidas).toBe(2)

    const g = vi.fn().mockResolvedValue(resp({
      columnHeaders: cab('day', 'insightTrafficSourceType', 'views'),
      rows: [['2026-10-02', 'YT SEARCH', 3], ['2026-10-02', 'EXT_URL', 4], ['2026-10-02', null, 1]],
    }))
    const r2 = await dimensaoDoVideo(base(g))
    expect(r2.linhas).toHaveLength(1)
    expect(r2.invalidas).toBe(2)
  })

  it('dia fora da janela ou mal formado sai e é contado', async () => {
    const f = vi.fn().mockResolvedValue(resp({
      columnHeaders: cab('day', 'insightTrafficSourceType', 'views'),
      rows: [['2026-09-30', 'A', 1], ['2026-10-08', 'A', 1], ['2026-10-1', 'A', 1], ['2026-10-01', 'A', 1], ['2026-10-07', 'A', 2]],
    }))
    const r = await dimensaoDoVideo(base(f))
    expect(r.linhas.map(l => l.day)).toEqual(['2026-10-01', '2026-10-07'])
    expect(r.invalidas).toBe(3)
  })

  it('por_dia com inicio diferente de fim lança antes de chamar', async () => {
    const f = vi.fn()
    await expect(dimensaoDoVideo(base(f, { familia: 'country', inicio: '2026-10-05', fim: '2026-10-06' }))).rejects.toThrow()
    expect(f).not.toHaveBeenCalled()
  })

  it('falta a coluna da dimensão, o dia ou as views', async () => {
    const semDim = vi.fn().mockResolvedValue(resp({ columnHeaders: cab('day', 'views'), rows: [['2026-10-02', 1]] }))
    await expect(dimensaoDoVideo(base(semDim))).rejects.toMatchObject({ status: 200, reason: 'sem_coluna_insightTrafficSourceType' })
    const semDia = vi.fn().mockResolvedValue(resp({ columnHeaders: cab('insightTrafficSourceType', 'views'), rows: [['A', 1]] }))
    await expect(dimensaoDoVideo(base(semDia))).rejects.toMatchObject({ reason: 'sem_coluna_day' })
    const semViews = vi.fn().mockResolvedValue(resp({ columnHeaders: cab('country', 'estimatedMinutesWatched'), rows: [['BR', 1]] }))
    await expect(dimensaoDoVideo(base(semViews, { familia: 'country', inicio: '2026-10-05', fim: '2026-10-05' })))
      .rejects.toMatchObject({ reason: 'sem_coluna_views' })
    const semSo = vi.fn().mockResolvedValue(resp({ columnHeaders: cab('day', 'deviceType', 'views'), rows: [['2026-10-02', 'MOBILE', 1]] }))
    await expect(dimensaoDoVideo(base(semSo, { familia: 'device_os' }))).rejects.toMatchObject({ reason: 'sem_coluna_operatingSystem' })
  })

  it('lê por nome de coluna, não por posição', async () => {
    const f = vi.fn().mockResolvedValue(resp({
      columnHeaders: cab('views', 'insightTrafficSourceType', 'estimatedMinutesWatched', 'day'),
      rows: [[9, 'EXT_URL', 40, '2026-10-03']],
    }))
    const r = await dimensaoDoVideo(base(f))
    expect(r.linhas).toEqual([{ day: '2026-10-03', valor: 'EXT_URL', views: 9, watch_time_minutes: 40 }])
  })

  it.each<[Familia, string]>([
    ['traffic_source', 'day,insightTrafficSourceType'],
    ['device_os', 'day,deviceType,operatingSystem'],
    ['subscribed_status', 'day,subscribedStatus'],
    ['country', 'country'],
  ])('a URL (%s)', async (familia, dimensions) => {
    const f = vi.fn().mockResolvedValue(resp({ columnHeaders: cab('day'), rows: [] }))
    const porDia = familia === 'country'
    await dimensaoDoVideo(base(f, { familia, ...(porDia ? { inicio: '2026-10-05', fim: '2026-10-05' } : {}) }))
    const [url, init] = f.mock.calls[0]!
    const u = new URL(String(url))
    expect(u.origin + u.pathname).toBe('https://youtubeanalytics.googleapis.com/v2/reports')
    expect(u.searchParams.get('ids')).toBe('channel==UCabc')
    expect(u.searchParams.get('filters')).toBe('video==vid12345678')
    expect(u.searchParams.get('startDate')).toBe(porDia ? '2026-10-05' : '2026-10-01')
    expect(u.searchParams.get('endDate')).toBe(porDia ? '2026-10-05' : '2026-10-07')
    expect(u.searchParams.get('dimensions')).toBe(dimensions)
    expect(u.searchParams.get('metrics')).toBe('views,estimatedMinutesWatched,engagedViews')
    expect(u.searchParams.has('maxResults')).toBe(false)
    expect((init as RequestInit).headers).toEqual({ Authorization: 'Bearer tok' })
  })
})

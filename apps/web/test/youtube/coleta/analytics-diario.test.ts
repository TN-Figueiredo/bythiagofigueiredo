// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { AnalyticsApiError, METRICAS_BASE, METRICAS_ESTENDIDAS, diarioDoVideo } from '@/lib/youtube/coleta/analytics-diario'
import { SemTempoError } from '@/lib/youtube/coleta/clock'

const resp = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status })
const cab = (...nomes: string[]) => nomes.map(name => ({ name, columnType: 'METRIC', dataType: 'INTEGER' }))
const chamar = (f: ReturnType<typeof vi.fn>) =>
  diarioDoVideo({ token: 'tok', canalUc: 'UCabc', videoId: 'vid12345678', inicio: '2026-10-01', fim: '2026-10-07', f: f as unknown as typeof fetch })

describe('diarioDoVideo', () => {
  it('monta a URL e o cabeçalho certos, com as 12 métricas e sem maxResults', async () => {
    const f = vi.fn().mockResolvedValue(resp({ columnHeaders: cab('day'), rows: [] }))
    await chamar(f)
    const [url, init] = f.mock.calls[0]!
    const u = new URL(String(url))
    expect(u.origin + u.pathname).toBe('https://youtubeanalytics.googleapis.com/v2/reports')
    expect(u.searchParams.get('ids')).toBe('channel==UCabc')
    expect(u.searchParams.get('startDate')).toBe('2026-10-01')
    expect(u.searchParams.get('endDate')).toBe('2026-10-07')
    expect(u.searchParams.get('dimensions')).toBe('day')
    expect(u.searchParams.get('filters')).toBe('video==vid12345678')
    expect(u.searchParams.get('sort')).toBe('day')
    const metricas = u.searchParams.get('metrics')!.split(',')
    expect(metricas).toEqual([...METRICAS_BASE, ...METRICAS_ESTENDIDAS])
    expect(metricas).toHaveLength(12)
    expect(u.searchParams.has('maxResults')).toBe(false)
    expect((init as RequestInit).headers).toEqual({ Authorization: 'Bearer tok' })
  })

  it('colunas em outra ordem gravam cada valor na coluna certa', async () => {
    const f = vi.fn().mockResolvedValue(resp({
      columnHeaders: cab('likes', 'day', 'views', 'averageViewPercentage'),
      rows: [[2, '2026-10-01', 40, 51.5]],
    }))
    const r = await chamar(f)
    expect(r.dias).toEqual([{ day: '2026-10-01', valores: { likes: 2, views: 40, avg_view_percentage: 51.5 } }])
  })

  it('mapeia todos os nomes da API para as colunas', async () => {
    const nomes = ['day', ...METRICAS_BASE, ...METRICAS_ESTENDIDAS]
    const f = vi.fn().mockResolvedValue(resp({ columnHeaders: cab(...nomes), rows: [['2026-10-01', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]] }))
    const r = await chamar(f)
    expect(r.dias[0]!.valores).toEqual({
      views: 1, watch_time_minutes: 2, avg_view_duration_seconds: 3, avg_view_percentage: 4, likes: 5, comments: 6,
      shares: 7, subscribers_gained: 8, subscribers_lost: 9, engaged_views: 10, card_impressions: 11, card_click_rate: 12,
    })
  })

  it('sem averageViewPercentage no cabeçalho: chave ausente, nunca 0', async () => {
    const f = vi.fn().mockResolvedValue(resp({ columnHeaders: cab('day', 'views'), rows: [['2026-10-01', 5]] }))
    const { dias } = await chamar(f)
    expect('avg_view_percentage' in dias[0]!.valores).toBe(false)
    expect(dias[0]!.valores).toEqual({ views: 5 })
  })

  it('null, vazio e NaN numa coluna presente: chave ausente; 0 legítimo entra; texto numérico é lido', async () => {
    const f = vi.fn().mockResolvedValue(resp({
      columnHeaders: cab('day', 'views', 'likes', 'comments', 'shares', 'subscribersGained', 'desconhecida'),
      rows: [['2026-10-01', null, 0, '', 'abc', '7', 99]],
    }))
    const { dias } = await chamar(f)
    expect(dias[0]!.valores).toEqual({ likes: 0, subscribers_gained: 7 })
    expect('views' in dias[0]!.valores).toBe(false)
    expect('comments' in dias[0]!.valores).toBe(false)
    expect('shares' in dias[0]!.valores).toBe(false)
  })

  it('texto só de espaços (ou de quebras de linha) não vira 0: chave ausente; "0" e " 7 " continuam sendo lidos', async () => {
    const f = vi.fn().mockResolvedValue(resp({
      columnHeaders: cab('day', 'views', 'likes', 'comments', 'shares', 'subscribersGained'),
      rows: [['2026-10-01', ' ', '\t\n', '0', ' 7 ', '   ']],
    }))
    const { dias } = await chamar(f)
    expect(dias[0]!.valores).toEqual({ comments: 0, shares: 7 })
    expect('views' in dias[0]!.valores).toBe(false)
    expect('likes' in dias[0]!.valores).toBe(false)
    expect('subscribers_gained' in dias[0]!.valores).toBe(false)
  })

  it.each([
    ['rows vazio', { columnHeaders: cab('day', 'views'), rows: [] }],
    ['sem rows', { columnHeaders: cab('day', 'views') }],
    ['sem rows e sem cabeçalho', {}],
    ['rows vazio sem day no cabeçalho', { columnHeaders: cab('views'), rows: [] }],
  ])('sem linhas (%s): dias vazio e estendidas ok', async (_n, corpo) => {
    const f = vi.fn().mockResolvedValue(resp(corpo))
    expect(await chamar(f)).toEqual({ dias: [], estendidas: 'ok' })
  })

  it('400 na lista estendida: segunda chamada só com as 9 de base e estendidas recusadas', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(resp({ error: { errors: [{ reason: 'badRequest' }] } }, 400))
      .mockResolvedValueOnce(resp({ columnHeaders: cab('day', 'views'), rows: [['2026-10-01', 3]] }))
    const r = await chamar(f)
    expect(f).toHaveBeenCalledTimes(2)
    expect(new URL(String(f.mock.calls[1]![0])).searchParams.get('metrics')).toBe(METRICAS_BASE.join(','))
    expect(r.estendidas).toBe('recusadas')
    expect(r.dias).toEqual([{ day: '2026-10-01', valores: { views: 3 } }])
  })

  it('400 nas duas chamadas lança AnalyticsApiError 400', async () => {
    const f = vi.fn().mockImplementation(async () => resp({}, 400))
    const e = await chamar(f).catch(x => x)
    expect(e).toBeInstanceOf(AnalyticsApiError)
    expect(e).toMatchObject({ status: 400 })
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('401 lança com uma chamada só; 500 idem', async () => {
    const f401 = vi.fn().mockResolvedValue(resp({}, 401))
    expect(await chamar(f401).catch(x => x)).toMatchObject({ status: 401 })
    expect(f401).toHaveBeenCalledTimes(1)
    const f500 = vi.fn().mockResolvedValue(resp({}, 500))
    expect(await chamar(f500).catch(x => x)).toMatchObject({ status: 500 })
    expect(f500).toHaveBeenCalledTimes(1)
  })

  it('403 leva o reason do Google e a mensagem não leva o corpo', async () => {
    const corpo = { error: { message: 'segredo no corpo', errors: [{ reason: 'insufficientPermissions' }] } }
    const f = vi.fn().mockResolvedValue(resp(corpo, 403))
    const e = await chamar(f).catch(x => x)
    expect(e).toBeInstanceOf(AnalyticsApiError)
    expect(e).toMatchObject({ status: 403, reason: 'insufficientPermissions' })
    expect(String(e.message)).not.toContain('segredo')
  })

  it('200 com corpo que não é JSON: corpo_invalido', async () => {
    const f = vi.fn().mockResolvedValue(new Response('<html>segredo</html>', { status: 200 }))
    const e = await chamar(f).catch(x => x)
    expect(e).toBeInstanceOf(AnalyticsApiError)
    expect(e).toMatchObject({ status: 200, reason: 'corpo_invalido' })
    expect(String(e.message)).not.toContain('segredo')
  })

  it('cabeçalho sem day, ou linhas sem cabeçalho, com linhas: sem_coluna_day', async () => {
    const a = vi.fn().mockResolvedValue(resp({ columnHeaders: cab('views'), rows: [[1]] }))
    expect(await chamar(a).catch(x => x)).toMatchObject({ status: 200, reason: 'sem_coluna_day' })
    const b = vi.fn().mockResolvedValue(resp({ rows: [['2026-10-01', 1]] }))
    expect(await chamar(b).catch(x => x)).toMatchObject({ status: 200, reason: 'sem_coluna_day' })
  })

  it('dia fora de AAAA-MM-DD: dia_invalido, e nada é devolvido pela metade', async () => {
    const f = vi.fn().mockResolvedValue(resp({
      columnHeaders: cab('day', 'views'),
      rows: [['2026-10-01', 1], ['20261001', 2]],
    }))
    expect(await chamar(f).catch(x => x)).toMatchObject({ status: 200, reason: 'dia_invalido' })
  })

  it('erro do fetch (SemTempoError) sobe sem ser embrulhado', async () => {
    const f = vi.fn().mockRejectedValue(new SemTempoError())
    await expect(chamar(f)).rejects.toBeInstanceOf(SemTempoError)
  })
})

// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(),
}))
vi.mock('@/lib/youtube/coleta/alerts', () => ({ avisarEntrada: vi.fn(), avisarSaida: vi.fn() }))
vi.mock('@/lib/youtube/coleta/analytics-diario', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/coleta/analytics-diario')>()),
  diarioDoVideo: vi.fn(),
}))

import { passoDiario } from '@/lib/youtube/coleta/diario-step'
import { diarioDoVideo, AnalyticsApiError, type DiaDoVideo } from '@/lib/youtube/coleta/analytics-diario'
import { ensureFreshToken, NoActiveConnectionError, TokenRevokedError } from '@/lib/social/token-refresh'
import { SemTempoError } from '@/lib/youtube/coleta/clock'
import type { StepCtx } from '@/lib/youtube/coleta/types'
import { fakeSupabase, type FakeDb, type Row } from './fake-supabase'

const AGORA = new Date('2026-10-09T12:05:00.000Z')
const DIA_MS = 86_400_000
const ha = (dias: number) => new Date(AGORA.getTime() - dias * DIA_MS).toISOString()
const diaDe = (dias: number) => ha(dias).slice(0, 10)

const canal = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true, collection_status: 'ok' as const, video_count: 3 }
const v = (n: number, publicadoEm: string | null = '2024-12-10T15:00:00.000Z'): Row => ({
  id: `vid-${n}`, youtube_video_id: `yt${n}`, channel_id: 'ch-1', site_id: 'site-1', published_at: publicadoEm,
})
const dia = (day: string, valores: DiaDoVideo['valores'] = { views: 10 }): DiaDoVideo => ({ day, valores })
const resposta = (dias: DiaDoVideo[], estendidas: 'ok' | 'recusadas' = 'ok') => ({ dias, estendidas })
const ctxDe = (db: FakeDb, prazoMs = 50_000): StepCtx => ({
  // Cópia: o passo muda `collection_status` do canal em memória e isso não pode vazar para outro teste.
  supabase: db.client, channels: [{ ...canal }], deadline: Date.now() + prazoMs, falhas: [], tentativas: [],
  autorizados: new Set(), negados: new Set(),
})
const bd = (videos: Row[], daily: Row[] = []): FakeDb =>
  fakeSupabase({ youtube_channels: [{ ...canal }], youtube_videos: videos, yt_own_video_daily: daily })
const ultima = (n: number, day: string, extra: Row = {}): Row => ({
  youtube_video_id: `yt${n}`, day_pt: day, site_id: 'site-1', channel_id: 'ch-1', collected_at: ha(1), ...extra,
})
const linhas = (db: FakeDb) => db.tables.yt_own_video_daily ?? []
const tentativa = (db: FakeDb, scope: string, scopeId: string) =>
  db.tables.yt_own_collection_attempts?.find(r => r.scope_type === scope && r.scope_id === scopeId && r.kind === 'diario')

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
  vi.mocked(ensureFreshToken).mockResolvedValue({ accessToken: 'tok', connectionId: 'c1' } as never)
  vi.mocked(diarioDoVideo).mockReset()
  vi.mocked(diarioDoVideo).mockResolvedValue(resposta([dia('2026-10-07')]))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('passoDiario: janela', () => {
  it('primeira vez: começa no dia de publicação (Pacífico) e vai até hoje', async () => {
    const db = bd([v(1)])
    await passoDiario(ctxDe(db))
    expect(diarioDoVideo).toHaveBeenCalledWith(expect.objectContaining({
      inicio: '2024-12-10', fim: '2026-10-09', canalUc: 'UC1', videoId: 'yt1', token: 'tok',
    }))
  })

  it('depois: 10 dias para trás de hoje', async () => {
    const db = bd([v(1)], [ultima(1, '2026-10-08')])
    await passoDiario(ctxDe(db))
    expect(diarioDoVideo).toHaveBeenCalledWith(expect.objectContaining({ inicio: '2026-09-29' }))
  })

  it('vídeo parado há 20 dias: a janela volta até o último dia gravado (aceite 9)', async () => {
    const db = bd([v(1)], [ultima(1, '2026-09-19')])
    await passoDiario(ctxDe(db))
    expect(diarioDoVideo).toHaveBeenCalledWith(expect.objectContaining({ inicio: '2026-09-19' }))
  })

  it('vídeo publicado "amanhã" no Pacífico: início preso a hoje', async () => {
    const db = bd([v(1, new Date(AGORA.getTime() + 2 * DIA_MS).toISOString())])
    await passoDiario(ctxDe(db))
    expect(diarioDoVideo).toHaveBeenCalledWith(expect.objectContaining({ inicio: '2026-10-09', fim: '2026-10-09' }))
  })
})

describe('passoDiario: gravação', () => {
  it('grava o que vier, com a versão de métrica de cada dia', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([dia('2025-03-30'), dia('2026-10-07')]))
    const db = bd([v(1)])
    const resumo = await passoDiario(ctxDe(db))
    expect(linhas(db)).toHaveLength(2)
    expect(linhas(db).find(r => r.day_pt === '2025-03-30')).toMatchObject({
      youtube_video_id: 'yt1', video_id: 'vid-1', channel_id: 'ch-1', site_id: 'site-1', source: 'analytics_api',
      collected_at: AGORA.toISOString(), metric_version: 'views_ate_2025-03-30', views: 10,
    })
    expect(linhas(db).find(r => r.day_pt === '2026-10-07')).toMatchObject({ metric_version: 'views_desde_2026-08-27' })
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'ok' })
    expect(resumo.gravados).toBe(2)
    expect(resumo.ate).toBe('2026-10-09')
  })

  it('dia da janela sem linha na resposta não é gravado', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([dia('2026-10-01')]))
    const db = bd([v(1)], [ultima(1, '2026-10-08', { views: 1 })])
    await passoDiario(ctxDe(db))
    expect(linhas(db).map(r => r.day_pt).sort()).toEqual(['2026-10-01', '2026-10-08'])
  })

  it('sem linhas: vídeo antigo é sem_dado_na_janela, vídeo de 2 dias é video_novo, sem falha', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([]))
    const db = bd([v(1), v(2, ha(2))])
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(linhas(db)).toHaveLength(0)
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'sem_dado_na_janela' })
    expect(tentativa(db, 'video', 'yt2')).toMatchObject({ outcome: 'video_novo' })
    expect(ctx.falhas).toEqual([])
  })

  it('duas execuções no mesmo dia: mesmas linhas, mesmos valores, attempts 2 (aceite 9)', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([dia('2026-10-06', { views: 4 }), dia('2026-10-07', { views: 5 })]))
    const db = bd([v(1)])
    await passoDiario(ctxDe(db))
    const antes = structuredClone(linhas(db))
    await passoDiario(ctxDe(db))
    expect(linhas(db)).toEqual(antes)
    expect(linhas(db)).toHaveLength(2)
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'ok', attempts: 2 })
  })

  it('nunca de não nulo a nulo: coluna que não veio fica intacta', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([dia('2026-10-07', { views: 6 })]))
    const db = bd([v(1)], [ultima(1, '2026-10-07', { views: 5, avg_view_percentage: 41.5 })])
    await passoDiario(ctxDe(db))
    expect(linhas(db)).toHaveLength(1)
    expect(linhas(db)[0]).toMatchObject({ views: 6, avg_view_percentage: 41.5 })
  })

  it('dias com conjuntos de colunas diferentes: cada linha leva só o que veio, em dois upserts', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([dia('2026-10-06', { views: 1, likes: 2 }), dia('2026-10-07', { views: 3 })]))
    const db = bd([v(1)])
    await passoDiario(ctxDe(db))
    const l1 = linhas(db).find(r => r.day_pt === '2026-10-06')!
    const l2 = linhas(db).find(r => r.day_pt === '2026-10-07')!
    expect(l1.likes).toBe(2)
    expect('likes' in l2).toBe(false)
    expect(db.writes.filter(w => w.table === 'yt_own_video_daily' && w.op === 'upsert')).toHaveLength(2)
  })

  it('vídeo sem published_at não entra; canal sem vídeos não gera tentativa', async () => {
    const db = bd([v(1, null)])
    await passoDiario(ctxDe(db))
    expect(diarioDoVideo).not.toHaveBeenCalled()
    expect(db.tables.yt_own_collection_attempts ?? []).toHaveLength(0)
  })

  it('canal com sync desligado é ignorado', async () => {
    const db = bd([v(1)])
    const ctx = { ...ctxDe(db), channels: [{ ...canal, sync_enabled: false }] }
    await passoDiario(ctx)
    expect(diarioDoVideo).not.toHaveBeenCalled()
    expect(ensureFreshToken).not.toHaveBeenCalled()
    expect(db.tables.yt_own_collection_attempts ?? []).toHaveLength(0)
  })
})

describe('passoDiario: ordem', () => {
  it('nunca coletado primeiro, depois collected_at crescente', async () => {
    const db = bd(
      [v(1), v(2), v(3)],
      [ultima(1, '2026-10-08', { collected_at: ha(1) }), ultima(2, '2026-10-08', { collected_at: ha(2) })],
    )
    await passoDiario(ctxDe(db))
    const ordem = vi.mocked(diarioDoVideo).mock.calls.map(c => c[0].videoId)
    expect(ordem).toEqual(['yt3', 'yt2', 'yt1'])
  })
})

describe('passoDiario: erros da Analytics API', () => {
  it('401: canal vira reautorizar, o resto do canal não chama a API, falhas vazia', async () => {
    vi.mocked(diarioDoVideo).mockRejectedValue(new AnalyticsApiError(401, null))
    const db = bd([v(1), v(2), v(3), v(4), v(5), v(6)])
    const ctx = ctxDe(db)
    const resumo = await passoDiario(ctx)
    expect(db.tables.youtube_channels![0]!.collection_status).toBe('reautorizar')
    expect(ctx.negados!.has('ch-1')).toBe(true)
    expect(vi.mocked(diarioDoVideo).mock.calls.length).toBeLessThanOrEqual(4)
    expect(tentativa(db, 'video', 'yt3')).toMatchObject({ outcome: 'sem_autorizacao', http_status: 401 })
    expect(tentativa(db, 'video', 'yt6')).toMatchObject({ outcome: 'sem_autorizacao' })
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'sem_autorizacao' })
    expect(ctx.falhas).toEqual([])
    expect(resumo.gravados).toBe(0)
  })

  it('403 insufficientPermissions: igual ao 401', async () => {
    vi.mocked(diarioDoVideo).mockRejectedValue(new AnalyticsApiError(403, 'insufficientPermissions'))
    const db = bd([v(1)])
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(db.tables.youtube_channels![0]!.collection_status).toBe('reautorizar')
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'sem_autorizacao', http_status: 403 })
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'sem_autorizacao' })
    expect(ctx.falhas).toEqual([])
  })

  it('403 quotaExceeded: erro_http, canal continua ok, falha registrada', async () => {
    vi.mocked(diarioDoVideo).mockRejectedValue(new AnalyticsApiError(403, 'quotaExceeded'))
    const db = bd([v(1)])
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'erro_http', http_status: 403, error: 'HTTP 403 quotaExceeded' })
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'ok' })
    expect(db.tables.youtube_channels![0]!.collection_status).toBe('ok')
    expect(ctx.falhas).toContain('diário: Canal Um: 1 de 1 vídeos com erro (HTTP 403 quotaExceeded)')
  })

  it('500 em 2 de 3 vídeos: o terceiro é gravado', async () => {
    vi.mocked(diarioDoVideo).mockImplementation(async (i) => {
      if (i.videoId === 'yt3') return resposta([dia('2026-10-07')])
      throw new AnalyticsApiError(500, null)
    })
    const db = bd([v(1), v(2), v(3)])
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(linhas(db).map(r => r.youtube_video_id)).toEqual(['yt3'])
    expect(ctx.falhas).toEqual(['diário: Canal Um: 2 de 3 vídeos com erro (HTTP 500)'])
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'ok' })
  })

  it('exceção inesperada: erro_http com a causa e Sentry', async () => {
    vi.mocked(diarioDoVideo).mockRejectedValue(new TypeError('boom'))
    const db = bd([v(1)])
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'erro_http', error: 'unexpected error (TypeError)' })
    expect(ctx.falhas).toHaveLength(1)
  })

  it('sucesso carimba a autorização uma vez só (4 vídeos em paralelo)', async () => {
    const db = bd([v(1), v(2), v(3), v(4)])
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(ctx.autorizados!.has('ch-1')).toBe(true)
    const carimbos = db.writes.filter(w => w.table === 'youtube_channels' && w.op === 'update'
      && 'authorization_verified_at' in (w.payload as Row))
    expect(carimbos).toHaveLength(1)
  })

  it('métricas estendidas recusadas: conta, grava e avisa uma vez por canal', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([dia('2026-10-07')], 'recusadas'))
    const db = bd([v(1), v(2), v(3)])
    const ctx = ctxDe(db)
    const resumo = await passoDiario(ctx)
    expect(resumo.estendidas_recusadas).toBe(3)
    expect(linhas(db)).toHaveLength(3)
    expect(ctx.falhas.filter(f => f === 'diário: Canal Um: a Analytics API recusou as métricas estendidas')).toHaveLength(1)
  })
})

describe('passoDiario: relógio', () => {
  it('estourado no começo: pendentes = vídeos, nenhuma chamada', async () => {
    const db = bd([v(1), v(2)])
    const resumo = await passoDiario(ctxDe(db, 0))
    expect(diarioDoVideo).not.toHaveBeenCalled()
    expect(resumo.pendentes).toBe(2)
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
  })

  it('SemTempoError no meio: o vídeo e o canal ficam nao_alcancado_orcamento, sem falha', async () => {
    vi.mocked(diarioDoVideo)
      .mockResolvedValueOnce(resposta([dia('2026-10-07')]))
      .mockRejectedValueOnce(new SemTempoError())
    const db = bd([v(1), v(2)])
    const ctx = ctxDe(db)
    const resumo = await passoDiario(ctx)
    expect(resumo.pendentes).toBe(1)
    expect(resumo.gravados).toBe(1)
    expect(tentativa(db, 'video', 'yt2')).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'nao_alcancado_orcamento' })
    expect(ctx.falhas).toEqual([])
  })
})

describe('passoDiario: token', () => {
  it('sem conexão: tentativa de canal sem_conexao, nenhuma de vídeo, sem falha', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new NoActiveConnectionError('youtube'))
    const db = bd([v(1)])
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'sem_conexao' })
    expect(tentativa(db, 'video', 'yt1')).toBeUndefined()
    expect(diarioDoVideo).not.toHaveBeenCalled()
    expect(ctx.falhas).toEqual([])
  })

  it('token revogado: sem_autorizacao e canal em reautorizar', async () => {
    vi.mocked(ensureFreshToken).mockRejectedValue(new TokenRevokedError('youtube'))
    const db = bd([v(1)])
    await passoDiario(ctxDe(db))
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'sem_autorizacao' })
    expect(db.tables.youtube_channels![0]!.collection_status).toBe('reautorizar')
  })
})

describe('passoDiario: banco', () => {
  it('sem a migration: schema_ausente, nenhuma chamada à API', async () => {
    const db = bd([v(1)])
    db.errors.yt_own_video_daily = { code: '42P01', message: 'x' }
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(ctx.falhas).toEqual(['schema_ausente: yt_own_video_daily'])
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'schema_ausente' })
    expect(diarioDoVideo).not.toHaveBeenCalled()
  })

  it('erro de banco ao gravar: erro_http "erro de banco" e nada gravado', async () => {
    const db = bd([v(1)])
    db.writeErrors.yt_own_video_daily = { code: '23514', message: 'x' }
    const ctx = ctxDe(db)
    const resumo = await passoDiario(ctx)
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'erro_http', error: 'erro de banco' })
    expect(ctx.falhas).toContain('erro de banco ao gravar yt_own_video_daily')
    expect(ctx.falhas.some(f => f.startsWith('diário: Canal Um: 1 de 1 vídeos com erro ('))).toBe(true)
    expect(resumo.gravados).toBe(0)
  })

  it('leitura da última linha que falha para um vídeo: só ele erra, e não vira "primeira vez"', async () => {
    const db = bd([v(1), v(2)], [ultima(1, '2026-10-08'), ultima(2, '2026-10-08')])
    const real = db.client.from.bind(db.client)
    const erro = { code: 'XX000', message: 'x' }
    // Espia a leitura de yt_own_video_daily: para yt1 a cadeia devolve erro; o resto passa para o banco.
    const cliente = {
      from: (t: string) => {
        const q = real(t) as unknown as Record<string, (...a: unknown[]) => unknown>
        if (t !== 'yt_own_video_daily') return q
        const eqReal = q.eq!.bind(q)
        q.eq = (c: unknown, val: unknown) => {
          if (c === 'youtube_video_id' && val === 'yt1') {
            const cadeia: Record<string, unknown> = {}
            for (const m of ['eq', 'order', 'limit', 'maybeSingle', 'select']) cadeia[m] = () => cadeia
            cadeia.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: null, error: erro, count: null }).then(ok)
            return cadeia
          }
          return eqReal(c, val)
        }
        return q
      },
      rpc: db.client.rpc.bind(db.client),
    } as unknown as StepCtx['supabase']
    const ctx = { ...ctxDe(db), supabase: cliente }
    await passoDiario(ctx)
    expect(vi.mocked(diarioDoVideo).mock.calls.map(c => c[0].videoId)).toEqual(['yt2'])
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'erro_http', error: 'erro de banco' })
    expect(tentativa(db, 'video', 'yt2')).toMatchObject({ outcome: 'ok' })
  })
})

describe('passoDiario: gravação em trechos e lote', () => {
  const upserts = (db: FakeDb) => db.writes.filter(w => w.table === 'yt_own_video_daily' && w.op === 'upsert')
  const dias3 = () => [
    dia('2026-10-05', { views: 1, likes: 1 }),
    dia('2026-10-06', { views: 2 }),
    dia('2026-10-07', { views: 3, likes: 3 }),
  ]

  it('dia do meio com assinatura diferente: 3 upserts, na ordem dos dias', async () => {
    // Resposta fora de ordem: o passo ordena por dia antes de agrupar.
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([...dias3()].reverse()))
    const db = bd([v(1)])
    await passoDiario(ctxDe(db))
    const ordem = upserts(db).map(w => (w.payload as Row[]).map(l => l.day_pt))
    expect(ordem).toEqual([['2026-10-05'], ['2026-10-06'], ['2026-10-07']])
  })

  // Faz falhar só o n-ésimo upsert em yt_own_video_daily (os demais, se tentados, passam).
  const falharNoUpsert = (db: FakeDb, n: number) => {
    const real = db.client.from.bind(db.client)
    let chamadas = 0
    db.client.from = ((t: string) => {
      const q = real(t) as unknown as Record<string, (...a: unknown[]) => unknown>
      if (t === 'yt_own_video_daily') {
        const up = q.upsert!.bind(q)
        q.upsert = (...a: unknown[]) => {
          chamadas++
          if (chamadas === n) db.writeErrors.yt_own_video_daily = { code: '23514', message: 'x' }
          else delete db.writeErrors.yt_own_video_daily
          return up(...a)
        }
      }
      return q
    }) as typeof db.client.from
  }

  it('o segundo trecho falha: o primeiro fica, nada depois é gravado', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta(dias3()))
    const db = bd([v(1)])
    falharNoUpsert(db, 2)
    const resumo = await passoDiario(ctxDe(db))
    expect(linhas(db).map(r => r.day_pt)).toEqual(['2026-10-05'])
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'erro_http', error: 'erro de banco' })
    expect(resumo.gravados).toBe(1)
  })

  it('o primeiro trecho falha: nenhum dia posterior é gravado', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta(dias3()))
    const db = bd([v(1)])
    falharNoUpsert(db, 1)
    const resumo = await passoDiario(ctxDe(db))
    expect(linhas(db)).toHaveLength(0)
    expect(resumo.gravados).toBe(0)
    expect(tentativa(db, 'video', 'yt1')).toMatchObject({ outcome: 'erro_http' })
  })

  it('lote com chaves homogêneas: coluna que não veio no dia A não é anulada (41.5 fica)', async () => {
    vi.mocked(diarioDoVideo).mockResolvedValue(resposta([
      dia('2026-10-06', { views: 7 }),
      dia('2026-10-07', { views: 8, avg_view_percentage: 30 }),
    ]))
    const db = bd([v(1)], [ultima(1, '2026-10-06', { views: 5, avg_view_percentage: 41.5 })])
    await passoDiario(ctxDe(db))
    expect(linhas(db).find(r => r.day_pt === '2026-10-06')).toMatchObject({ views: 7, avg_view_percentage: 41.5 })
    for (const w of upserts(db)) {
      const lote = w.payload as Row[]
      const chaves = new Set(lote.map(l => Object.keys(l).sort().join(',')))
      expect(chaves.size).toBe(1)
    }
  })
})

describe('passoDiario: schema ausente na escrita', () => {
  it('PGRST204 ao gravar: interrompe, no máximo os 4 em voo chamam a API', async () => {
    const db = bd([1, 2, 3, 4, 5, 6].map(n => v(n)))
    db.writeErrors.yt_own_video_daily = { code: 'PGRST204', message: 'x' }
    const ctx = ctxDe(db)
    await passoDiario(ctx)
    expect(ctx.falhas).toContain('schema_ausente: yt_own_video_daily')
    expect(vi.mocked(diarioDoVideo).mock.calls.length).toBeLessThanOrEqual(4)
    expect(tentativa(db, 'canal', 'ch-1')).toMatchObject({ outcome: 'schema_ausente' })
  })
})

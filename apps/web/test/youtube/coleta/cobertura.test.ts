// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { fakeSupabase, type Row } from './fake-supabase'
import { lerCoberturaBase, inicioDaJanela } from '@/lib/youtube/coleta/cobertura'
import { addDays, dayPt } from '@/lib/youtube/coleta/day-pt'
import type { ColetaChannel, StepCtx } from '@/lib/youtube/coleta/types'

const HOJE = dayPt(new Date())
const SITE = '11111111-1111-4111-8111-111111111111'
const CANAL_ID = '22222222-2222-4222-8222-222222222222'
const OUTRO_SITE = '33333333-3333-4333-8333-333333333333'
const OUTRO_CANAL = '44444444-4444-4444-8444-444444444444'

const canal: ColetaChannel = {
  id: CANAL_ID, channel_id: 'UCcanal', site_id: SITE, name: 'Canal Um',
  sync_enabled: true, collection_status: 'ok', video_count: 3,
}

function linha(over: Row = {}): Row {
  const to = 'covered_to' in over ? over.covered_to : addDays(HOJE, -1)
  return {
    youtube_video_id: 'v1', metric_set: 'base', covered_from: addDays(HOJE, -60), covered_to: to,
    site_id: SITE, channel_id: CANAL_ID, collected_at: `${addDays(HOJE, -1)}T10:00:00+00:00`,
    ...over,
  }
}

function montar(seed: Row[]) {
  const db = fakeSupabase({ yt_own_video_coverage: seed })
  const ctx: Pick<StepCtx, 'supabase' | 'falhas'> = { supabase: db.client, falhas: [] }
  return { db, ctx }
}

describe('lerCoberturaBase', () => {
  it('tabela vazia: mapa vazio, sem falha (vazio de verdade, não erro)', async () => {
    const { ctx } = montar([])
    const r = await lerCoberturaBase(ctx, canal)
    expect(r).toBeInstanceOf(Map)
    expect((r as Map<string, unknown>).size).toBe(0)
    expect(ctx.falhas).toEqual([])
  })

  it('por vídeo fica o maior covered_to, o coletado mais recente e quantos intervalos', async () => {
    const { ctx } = montar([
      linha({ youtube_video_id: 'v1', covered_from: '2026-01-01', covered_to: '2026-02-01', collected_at: '2026-03-01T00:00:00+00:00' }),
      linha({ youtube_video_id: 'v1', covered_from: '2026-03-01', covered_to: '2026-04-01', collected_at: '2026-04-02T00:00:00+00:00' }),
      linha({ youtube_video_id: 'v1', covered_from: '2026-02-10', covered_to: '2026-02-20', collected_at: '2026-02-21T00:00:00+00:00' }),
      linha({ youtube_video_id: 'v2', covered_from: '2026-05-01', covered_to: '2026-05-10', collected_at: '2026-05-11T00:00:00+00:00' }),
    ])
    const r = await lerCoberturaBase(ctx, canal)
    expect(r).toBeInstanceOf(Map)
    const m = r as Map<string, { ate: string; coletadoEm: string; intervalos: number }>
    expect(m.get('v1')).toEqual({ ate: '2026-04-01', coletadoEm: '2026-04-02T00:00:00+00:00', intervalos: 3 })
    expect(m.get('v2')).toEqual({ ate: '2026-05-10', coletadoEm: '2026-05-11T00:00:00+00:00', intervalos: 1 })
  })

  it('só lê o canal, o site e o conjunto base', async () => {
    const { ctx, db } = montar([
      linha({ youtube_video_id: 'v1' }),
      linha({ youtube_video_id: 'v2', metric_set: 'estendidas' }),
      linha({ youtube_video_id: 'v3', channel_id: OUTRO_CANAL }),
      linha({ youtube_video_id: 'v4', site_id: OUTRO_SITE }),
    ])
    const r = (await lerCoberturaBase(ctx, canal)) as Map<string, unknown>
    expect([...r.keys()]).toEqual(['v1'])
    expect(db.leituras.yt_own_video_coverage).toBe(1)
  })

  it('mais de 1.000 linhas: pagina e não corta em silêncio (2.500 vídeos)', async () => {
    const seed = Array.from({ length: 2500 }, (_, i) => linha({ youtube_video_id: `v${String(i).padStart(5, '0')}` }))
    const { ctx, db } = montar(seed)
    const r = (await lerCoberturaBase(ctx, canal)) as Map<string, unknown>
    expect(r.size).toBe(2500)
    expect(db.leituras.yt_own_video_coverage).toBe(3)
    expect(ctx.falhas).toEqual([])
  })

  it('mais de 1.000 linhas com empates arbitrários: nenhuma linha perdida nem repetida', async () => {
    const seed = Array.from({ length: 2500 }, (_, i) => linha({ youtube_video_id: `v${String(i).padStart(5, '0')}` }))
    const { ctx, db } = montar(seed)
    db.embaralharEmpates = true
    const r = (await lerCoberturaBase(ctx, canal)) as Map<string, { intervalos: number }>
    expect(r.size).toBe(2500)
    expect([...r.values()].every(v => v.intervalos === 1)).toBe(true)
  })

  it('exatamente 5.000 linhas ainda passa', async () => {
    const seed = Array.from({ length: 5000 }, (_, i) => linha({ youtube_video_id: `v${String(i).padStart(5, '0')}` }))
    const { ctx } = montar(seed)
    const r = await lerCoberturaBase(ctx, canal)
    expect(r).toBeInstanceOf(Map)
    expect((r as Map<string, unknown>).size).toBe(5000)
  })

  it('cobertura cortada: 5.001 intervalos dão erro e a falha "cortada em 5000"', async () => {
    const seed = Array.from({ length: 5001 }, (_, i) => linha({ youtube_video_id: `v${String(i).padStart(5, '0')}` }))
    const { ctx } = montar(seed)
    const r = await lerCoberturaBase(ctx, canal)
    expect(r).toBe('erro')
    expect(ctx.falhas).toEqual(['diário: cobertura de Canal Um cortada em 5000'])
  })

  it.each(['42P01', 'PGRST205'])('tabela ausente (%s): schema_ausente, nunca "sem linhas"', async (code) => {
    const { ctx, db } = montar([])
    db.errors.yt_own_video_coverage = { code, message: 'relation does not exist' }
    expect(await lerCoberturaBase(ctx, canal)).toBe('schema_ausente')
  })

  it('outro erro do banco: erro, nunca mapa vazio', async () => {
    const { ctx, db } = montar([linha()])
    db.errors.yt_own_video_coverage = { code: '57014', message: 'statement timeout' }
    expect(await lerCoberturaBase(ctx, canal)).toBe('erro')
  })

  it('erro na segunda página: erro, sem devolver o que já tinha lido', async () => {
    const seed = Array.from({ length: 1500 }, (_, i) => linha({ youtube_video_id: `v${String(i).padStart(5, '0')}` }))
    const { ctx, db } = montar(seed)
    db.erroNaLeitura = (_t, n) => (n === 2 ? { code: '57014', message: 'timeout' } : undefined)
    expect(await lerCoberturaBase(ctx, canal)).toBe('erro')
  })

  it('tabela ausente na segunda página também é schema_ausente', async () => {
    const seed = Array.from({ length: 1500 }, (_, i) => linha({ youtube_video_id: `v${String(i).padStart(5, '0')}` }))
    const { ctx, db } = montar(seed)
    db.erroNaLeitura = (_t, n) => (n === 2 ? { code: '42P01', message: 'x' } : undefined)
    expect(await lerCoberturaBase(ctx, canal)).toBe('schema_ausente')
  })

  it('data nula sem erro: erro, nunca "sem linhas"', async () => {
    const { ctx, db } = montar([])
    const original = db.client.from.bind(db.client)
    db.client.from = ((t: string) => {
      const q = original(t)
      return Object.assign(q, { then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null, count: null }).then(ok) })
    }) as typeof db.client.from
    expect(await lerCoberturaBase(ctx, canal)).toBe('erro')
  })

  it('o cliente que lança vira erro', async () => {
    const { ctx, db } = montar([])
    db.client.from = (() => { throw new Error('boom') }) as typeof db.client.from
    expect(await lerCoberturaBase(ctx, canal)).toBe('erro')
  })

  it.each([
    ['covered_to nulo', { covered_to: null }],
    ['covered_to ausente', { covered_to: undefined }],
    ['covered_to com formato estranho', { covered_to: '12/10/2026' }],
    ['covered_to número', { covered_to: 20261012 }],
    ['youtube_video_id nulo', { youtube_video_id: null }],
    ['youtube_video_id vazio', { youtube_video_id: '' }],
    ['collected_at nulo', { collected_at: null }],
    ['collected_at que não é data', { collected_at: 'ontem' }],
  ])('linha com campo nulo ou estranho (%s): erro, nunca zero nem pular em silêncio', async (_nome, over) => {
    const { ctx } = montar([linha({ youtube_video_id: 'ok' }), linha(over as Row)])
    expect(await lerCoberturaBase(ctx, canal)).toBe('erro')
  })
})

describe('inicioDaJanela', () => {
  it('vídeo sem view há dois anos pede só os últimos 10 dias (cobertura até hoje − 3)', () => {
    expect(inicioDaJanela({ hoje: HOJE, cobertoAte: addDays(HOJE, -3), publicadoEm: '2024-01-01T00:00:00Z' })).toBe(addDays(HOJE, -10))
  })

  it('cobertura parada há 40 dias pede desde o último dia coberto', () => {
    expect(inicioDaJanela({ hoje: HOJE, cobertoAte: addDays(HOJE, -40), publicadoEm: '2024-01-01T00:00:00Z' })).toBe(addDays(HOJE, -40))
  })

  it('cobertura em exatamente hoje − 10: o mesmo dia', () => {
    expect(inicioDaJanela({ hoje: HOJE, cobertoAte: addDays(HOJE, -10), publicadoEm: '2024-01-01T00:00:00Z' })).toBe(addDays(HOJE, -10))
  })

  it('vídeo nunca coletado pede desde a publicação, no dia do Pacífico', () => {
    // 03:00 UTC de 15/03/2025 ainda é 14/03 no Pacífico (UTC-7 em horário de verão).
    expect(inicioDaJanela({ hoje: HOJE, cobertoAte: null, publicadoEm: '2025-03-15T03:00:00Z' })).toBe('2025-03-14')
  })

  it('publicação no futuro não gera janela invertida', () => {
    const amanha = new Date(Date.now() + 36 * 3_600_000).toISOString()
    const r = inicioDaJanela({ hoje: HOJE, cobertoAte: null, publicadoEm: amanha })
    expect(r).toBe(HOJE)
    expect(r <= HOJE).toBe(true)
  })

  it('cobertura no futuro também não passa de hoje', () => {
    expect(inicioDaJanela({ hoje: HOJE, cobertoAte: addDays(HOJE, 5), publicadoEm: '2024-01-01T00:00:00Z' })).toBe(addDays(HOJE, -10))
  })
})

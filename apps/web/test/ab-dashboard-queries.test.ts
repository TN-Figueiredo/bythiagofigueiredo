import { describe, it, expect } from 'vitest'
import { toCardView, toLatestDraft, computeDashboardStats } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { makeTestWithVariants } from './helpers/ab-fixtures'
import type { AbTestWithVariants } from '@/lib/youtube/ab-types'

describe('toCardView', () => {
  it('maps raw test to AbTestCardView with leader A for original', () => {
    const test = makeTestWithVariants()
    const card = toCardView(test)
    expect(card.leader).toBeDefined()
    expect(card.leaderColor).toBeTruthy()
    expect(card.confidence).toBeNull()
  })
  it('lift gravado (avaliador automático desligado) não chega ao card', () => {
    const test = makeTestWithVariants()
    test.result_metadata = { ctr_lift_percent: 7.5, winner_label: 'B', total_impressions: 100, estimated_monthly_extra_clicks: 1 }
    const card = toCardView(test)
    expect(card.lift).toBeNull()
  })
  it('lift é nulo (nunca 0) quando não há medição', () => {
    const test = makeTestWithVariants()
    expect(toCardView(test).lift).toBeNull()
  })
  it('computes dayOf from started_at', () => {
    const test = makeTestWithVariants({ startedDaysAgo: 5 })
    expect(toCardView(test).dayOf).toBe(5)
  })
  it('maps variants with display labels', () => {
    const test = makeTestWithVariants()
    const card = toCardView(test)
    expect(card.variants.length).toBe(2)
    expect(card.variants[0]!.label).toBe('A')
  })
})

describe('toLatestDraft', () => {
  it('returns null for empty array', () => {
    expect(toLatestDraft([])).toBeNull()
  })
  it('picks most recent by created_at', () => {
    const old = makeTestWithVariants({ createdAt: '2026-01-01T00:00:00Z' })
    const recent = makeTestWithVariants({ createdAt: '2026-05-01T00:00:00Z' })
    old.status = 'draft'
    recent.status = 'draft'
    const draft = toLatestDraft([old, recent])
    expect(draft).not.toBeNull()
    expect(draft!.createdAgo).toBeTruthy()
  })
})

describe('computeDashboardStats', () => {
  type Razao = AbTestWithVariants['completed_reason']
  function concluido(reason: Razao, comVencedor: boolean) {
    const t = makeTestWithVariants({ hasWinner: comVencedor })
    t.status = 'completed'
    t.completed_reason = reason
    return t
  }

  it('sem testes: winRate null (não 0) e sem avgConfidence/avgLift', () => {
    const s = computeDashboardStats([], [])
    expect(s).toEqual({ activeTests: 0, winRate: null, completedTests: 0, winRateBase: 0, testsWon: 0 })
    expect(s).not.toHaveProperty('avgConfidence')
    expect(s).not.toHaveProperty('avgLift')
  })
  it('exclui filho de playoff: sem teste que conte, winRate null', () => {
    const c = concluido('manual_apply', true)
    c.parent_test_id = 'parent-1'
    expect(computeDashboardStats([], [c]).winRate).toBeNull()
  })
  it('B2: a original vencedora é teste decidido (entra no denominador) mas não conta como vitória de variante', () => {
    const venceVariante = concluido('manual_winner', true)
    const venceOriginal = concluido('manual_winner', true)
    const orig = venceOriginal.variants.find(v => v.is_original)!
    venceOriginal.winner_variant_id = orig.id
    const s = computeDashboardStats([], [venceVariante, venceOriginal])
    expect(s.testsWon).toBe(1)
    expect(s.winRateBase).toBe(2)
    expect(s.winRate).toBe(50)
  })
  it('um manual com vencedor, um auto_resolve, um inconclusivo: 1 de 2 = 50 (mesma regra do pipeline)', () => {
    const manual = concluido('manual_apply', true)
    const auto = concluido('auto_resolve', true)
    const inconclusivo = concluido('max_duration', false)
    const s = computeDashboardStats([], [manual, auto, inconclusivo])
    expect(s.winRate).toBe(50)
    expect(s.testsWon).toBe(1)
    expect(s.completedTests).toBe(3)
    expect(s.winRateBase).toBe(2)
  })
  it('só auto_resolve: nenhum teste conta, winRate null', () => {
    const s = computeDashboardStats([], [concluido('auto_resolve', true)])
    expect(s.winRate).toBeNull()
  })
  it('razão desconhecida (null) fica fora do numerador e do denominador', () => {
    const s = computeDashboardStats([], [concluido(null, true), concluido('manual_apply', true)])
    expect(s.winRate).toBe(100)
  })
  it('counts active tests', () => {
    const active = [makeTestWithVariants(), makeTestWithVariants()]
    expect(computeDashboardStats(active, []).activeTests).toBe(2)
  })
})

describe('getEligibleVideosForPicker: hasActiveTest', () => {
  it('vídeo com teste queued → hasActiveTest true', async () => {
    const { vi } = await import('vitest')
    vi.resetModules()
    const dados: Record<string, unknown[]> = {
      youtube_videos: [{ id: 'v1', title: 'T', thumbnail_url: null, duration_seconds: 600, thumbnail_hq_url: 'hq', published_at: '2026-10-21T21:32:00Z', view_count: 0, youtube_channels: { handle: 'h' } }],
      ab_tests: [{ youtube_video_id: 'v1', status: 'queued', source_pipeline_id: null }],
    }
    const cadeia = (t: string) => {
      const c: Record<string, unknown> = {}
      for (const k of ['select', 'eq', 'order', 'limit', 'in']) c[k] = () => c
      c.then = (r: (v: unknown) => unknown) => r({ data: dados[t] })
      return c
    }
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: cadeia }) }))
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true }) }))
    const { getEligibleVideosForPicker } = await import('@/app/cms/(authed)/youtube/ab-lab/queries')
    const r = await getEligibleVideosForPicker()
    expect(r[0]!.hasActiveTest).toBe(true)
    expect(r[0]!.statusDoTeste).toBe('queued')
    expect(r[0]!.publishedAt).toBe('2026-10-21T21:32:00Z')
    expect(r[0]!.viewCount).toBeNull() // view_count 0 no banco = sem medição
    expect(r[0]!.bloqueio).toBeNull()
  })
  it('devolve rascunhoId do teste draft do vídeo (o mais recente quando houver dois)', async () => {
    const { vi } = await import('vitest')
    vi.resetModules()
    const dados: Record<string, unknown[]> = {
      youtube_videos: [{ id: 'v1', title: 'T', thumbnail_url: null, duration_seconds: 600, thumbnail_hq_url: 'hq', published_at: null, view_count: 0, youtube_channels: { handle: 'h' } }],
      ab_tests: [
        { id: 'velho', youtube_video_id: 'v1', status: 'draft', source_pipeline_id: null, created_at: '2026-10-01T10:00:00Z' },
        { id: 'novo', youtube_video_id: 'v1', status: 'draft', source_pipeline_id: null, created_at: '2026-10-02T10:00:00Z' },
      ],
    }
    const cadeia = (t: string) => {
      const c: Record<string, unknown> = {}
      for (const k of ['select', 'eq', 'order', 'limit', 'in']) c[k] = () => c
      c.then = (r: (v: unknown) => unknown) => r({ data: dados[t] })
      return c
    }
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: cadeia }) }))
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true }) }))
    const { getEligibleVideosForPicker } = await import('@/app/cms/(authed)/youtube/ab-lab/queries')
    const r = await getEligibleVideosForPicker()
    expect(r[0]!.statusDoTeste).toBe('draft')
    expect(r[0]!.rascunhoId).toBe('novo')
  })
  it('o select pede published_at, view_count e thumbnail_hq_url e não pede result_metadata', async () => {
    const { vi } = await import('vitest')
    vi.resetModules()
    const selects: string[] = []
    const cadeia = () => {
      const c: Record<string, unknown> = {}
      c.select = (cols: string) => { selects.push(cols); return c }
      for (const k of ['eq', 'order', 'limit', 'in']) c[k] = () => c
      c.then = (r: (v: unknown) => unknown) => r({ data: [] })
      return c
    }
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: cadeia }) }))
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true }) }))
    const { getEligibleVideosForPicker } = await import('@/app/cms/(authed)/youtube/ab-lab/queries')
    await getEligibleVideosForPicker()
    expect(selects[0]).toContain('published_at')
    expect(selects[0]).toContain('view_count')
    expect(selects[0]).toContain('thumbnail_hq_url')
    expect(selects.join(' ')).not.toContain('result_metadata')
  })
})

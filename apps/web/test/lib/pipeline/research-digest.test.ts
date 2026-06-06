import { describe, it, expect } from 'vitest'
import {
  computeResearchDigest,
  pickRecommendation,
  buildSummaryForOwner,
  isWindowExpired,
  FRESCA_STALE_DAYS,
  ANALISE_STALE_DAYS,
  MATURING_MIN_ITEMS,
  type ResearchDigestSignals,
} from '@/lib/pipeline/research-digest'

const NOW = Date.parse('2026-06-06T12:00:00Z')

function daysAgoIso(days: number): string {
  return new Date(NOW - days * 86_400_000).toISOString()
}

// --- Minimal supabase mock that serves the 3 digest queries ---------------

interface FakeData {
  items?: unknown[]
  foco?: unknown
  decisions?: unknown[]
}

function fakeSupabase(data: FakeData) {
  return {
    from(table: string) {
      if (table === 'research_items') {
        const builder = {
          select: () => builder,
          eq: () => Promise.resolve({ data: data.items ?? [], error: null }),
        }
        return builder
      }
      if (table === 'research_focos') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: () => Promise.resolve({ data: data.foco ?? null, error: null }),
        }
        return builder
      }
      if (table === 'research_decisions') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          neq: () => Promise.resolve({ data: data.decisions ?? [], error: null }),
        }
        return builder
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function run(data: FakeData): Promise<ResearchDigestSignals> {
  return computeResearchDigest(fakeSupabase(data) as any, 'site-1', NOW)
}

describe('computeResearchDigest', () => {
  it('counts items by status and theme', async () => {
    const signals = await run({
      items: [
        { id: 'a', title: 'A', status: 'fresca', theme_id: 'games', pinned: false, created_at: daysAgoIso(1), updated_at: daysAgoIso(1) },
        { id: 'b', title: 'B', status: 'analise', theme_id: 'games', pinned: true, created_at: daysAgoIso(5), updated_at: daysAgoIso(5) },
        { id: 'c', title: 'C', status: 'analise', theme_id: null, pinned: false, created_at: daysAgoIso(2), updated_at: daysAgoIso(2) },
      ],
    })
    expect(signals.countsByStatus).toEqual({ fresca: 1, analise: 2 })
    expect(signals.themeCounts).toEqual({ games: 2, '(sem tema)': 1 })
    expect(signals.pinnedCount).toBe(1)
    expect(signals.totalItems).toBe(3)
  })

  it('flags stale fresca (>14d) and stale analise (>30d)', async () => {
    const signals = await run({
      items: [
        { id: 'old-fresca', title: 'OldFresca', status: 'fresca', theme_id: null, pinned: false, created_at: daysAgoIso(FRESCA_STALE_DAYS + 1), updated_at: daysAgoIso(FRESCA_STALE_DAYS + 1) },
        { id: 'new-fresca', title: 'NewFresca', status: 'fresca', theme_id: null, pinned: false, created_at: daysAgoIso(2), updated_at: daysAgoIso(2) },
        { id: 'old-analise', title: 'OldAnalise', status: 'analise', theme_id: null, pinned: false, created_at: daysAgoIso(40), updated_at: daysAgoIso(ANALISE_STALE_DAYS + 1) },
      ],
    })
    expect(signals.staleFresca.map(s => s.id)).toEqual(['old-fresca'])
    expect(signals.staleAnalise.map(s => s.id)).toEqual(['old-analise'])
  })

  it('detects maturing themes (>=3 non-archived items, named theme)', async () => {
    const items = Array.from({ length: MATURING_MIN_ITEMS }, (_, i) => ({
      id: `g${i}`, title: `G${i}`, status: 'analise', theme_id: 'games', pinned: false, created_at: daysAgoIso(3), updated_at: daysAgoIso(3),
    }))
    // archived item in same theme should NOT count
    items.push({ id: 'arch', title: 'Arch', status: 'arquivada', theme_id: 'games', pinned: false, created_at: daysAgoIso(3), updated_at: daysAgoIso(3) })
    const signals = await run({ items })
    expect(signals.maturingThemes).toEqual([{ theme: 'games', count: MATURING_MIN_ITEMS }])
  })

  it('does not treat (sem tema) as maturing', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: `n${i}`, title: `N${i}`, status: 'fresca', theme_id: null, pinned: false, created_at: daysAgoIso(1), updated_at: daysAgoIso(1),
    }))
    const signals = await run({ items })
    expect(signals.maturingThemes).toEqual([])
  })

  it('collects overdue revisit decisions only', async () => {
    const signals = await run({
      decisions: [
        { id: 'd1', title: 'Overdue', horizon: 'agora', status: 'decidido', revisit: daysAgoIso(10) },
        { id: 'd2', title: 'Future', horizon: 'agora', status: 'decidido', revisit: new Date(NOW + 30 * 86_400_000).toISOString() },
        { id: 'd3', title: 'NoRevisit', horizon: 'agora', status: 'decidido', revisit: null },
      ],
    })
    expect(signals.revisitDue.map(d => d.id)).toEqual(['d1'])
  })
})

describe('pickRecommendation — Preflight priority order', () => {
  const empty: ResearchDigestSignals = {
    countsByStatus: {}, themeCounts: {}, activeFoco: null,
    revisitDue: [], staleFresca: [], staleAnalise: [], maturingThemes: [],
    pinnedCount: 0, totalItems: 0,
    thresholds: { frescaStaleDays: 14, analiseStaleDays: 30, maturingMinItems: 3 },
    generatedAt: new Date(NOW).toISOString(),
  }

  it('returns null when nothing worth surfacing (suggest-don\'t-nag)', () => {
    expect(pickRecommendation(empty)).toBeNull()
  })

  it('revisit_due wins over everything else', () => {
    const rec = pickRecommendation({
      ...empty,
      revisitDue: [{ id: 'd1', title: 'X', horizon: 'agora', status: 'decidido', revisit: daysAgoIso(5) }],
      activeFoco: { id: 'f', title: 'Old', window_label: 'Q1 2025', horizon: 'agora' },
      maturingThemes: [{ theme: 'games', count: 4 }],
      staleFresca: [{ id: 's', title: 'S', ageDays: 20 }],
    })
    expect(rec?.kind).toBe('revisit_due')
  })

  it('foco_orfao wins over tema maduro when no revisit due', () => {
    const rec = pickRecommendation({
      ...empty,
      activeFoco: { id: 'f', title: 'Velho', window_label: 'Q1 2025', horizon: 'agora' },
      maturingThemes: [{ theme: 'games', count: 4 }],
    })
    expect(rec?.kind).toBe('foco_orfao')
  })

  it('does not fire foco_orfao when window not expired', () => {
    const rec = pickRecommendation({
      ...empty,
      activeFoco: { id: 'f', title: 'Atual', window_label: 'Q2 2026', horizon: 'agora' },
      maturingThemes: [{ theme: 'games', count: 4 }],
    })
    expect(rec?.kind).toBe('tema_maduro')
  })

  it('tema_maduro wins over research stale and picks the largest theme', () => {
    const rec = pickRecommendation({
      ...empty,
      maturingThemes: [{ theme: 'games', count: 3 }, { theme: 'ia', count: 7 }],
      staleFresca: [{ id: 's', title: 'S', ageDays: 20 }],
    })
    expect(rec?.kind).toBe('tema_maduro')
    expect(rec?.recomendo_agora).toContain('ia')
    expect(rec?.dedupSegment).toBe('tema-ia')
  })

  it('research_stale is the lowest priority surface', () => {
    const rec = pickRecommendation({
      ...empty,
      staleAnalise: [{ id: 's', title: 'S', ageDays: 40 }],
    })
    expect(rec?.kind).toBe('research_stale')
  })
})

describe('buildSummaryForOwner — plain PT-BR contract', () => {
  const base: ResearchDigestSignals = {
    countsByStatus: { analise: 4 }, themeCounts: { games: 4 },
    activeFoco: { id: 'f', title: 'IA & Produção', window_label: 'Q1 2025', horizon: 'agora' },
    revisitDue: [{ id: 'd', title: 'X', horizon: 'agora', status: 'decidido', revisit: daysAgoIso(5) }],
    staleFresca: [], staleAnalise: [],
    maturingThemes: [{ theme: 'games', count: 4 }],
    pinnedCount: 2, totalItems: 6,
    thresholds: { frescaStaleDays: 14, analiseStaleDays: 30, maturingMinItems: 3 },
    generatedAt: new Date(NOW).toISOString(),
  }

  it('produces all 4 contract fields with no UUIDs', () => {
    const rec = pickRecommendation(base)
    const summary = buildSummaryForOwner(base, rec)
    expect(summary.estado).toContain('IA & Produção')
    expect(summary.o_que_esta_quente).toContain('games')
    expect(summary.recomendo_agora).toBe(rec?.recomendo_agora)
    expect(summary.precisa_da_sua_atencao).toContain('revisão vencida')
    // no raw UUID leakage
    expect(JSON.stringify(summary)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/)
  })

  it('falls back to "Nada urgente" when no recommendation', () => {
    const summary = buildSummaryForOwner(
      { ...base, revisitDue: [], maturingThemes: [], staleFresca: [], staleAnalise: [], activeFoco: { id: 'f', title: 'Atual', window_label: 'Q2 2026', horizon: 'agora' } },
      null,
    )
    expect(summary.recomendo_agora).toMatch(/Nada urgente/)
    expect(summary.precisa_da_sua_atencao).toBe('Nada vencido.')
  })
})

describe('isWindowExpired', () => {
  it('treats a past quarter as expired', () => {
    expect(isWindowExpired('Q1 2025', NOW)).toBe(true)
    expect(isWindowExpired('Q1 2026', NOW)).toBe(true) // current is Q2 2026
  })
  it('treats the current/future quarter as not expired', () => {
    expect(isWindowExpired('Q2 2026', NOW)).toBe(false)
    expect(isWindowExpired('Q4 2026', NOW)).toBe(false)
  })
  it('is conservative on unparseable / null labels', () => {
    expect(isWindowExpired(null, NOW)).toBe(false)
    expect(isWindowExpired('trimestre dos games', NOW)).toBe(false)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

const selectSpy = vi.fn()

// Realistic `content_pipeline.sections` shapes — the loader derives beats/flags in JS
// from these (PostgREST `.select()` cannot run jsonb_array_length/CASE/`?`).
const ROW_V1 = {
  id: 'v1', code: 'V-A01', title_pt: 'Olá', title_en: '',
  language: 'pt-br', stage: 'roteiro',
  format_metadata: { pillar: 'viagem', duration_range: '14–17 min' },
  version: 1, updated_at: '2026-06-07',
  sections: {
    ideia_pt: { content: { title: 'Olá' } },
    roteiro_pt: {
      content: {
        version: 3,
        beats: [
          { idx: 0, name: 'Abertura' },
          { idx: 1, name: 'Desenvolvimento' },
          { idx: 2, name: 'Fechamento' },
        ],
      },
    },
  },
}
const ROW_V2 = {
  id: 'v2', code: 'V-A02', title_pt: '', title_en: '',
  language: 'en', stage: 'published',
  format_metadata: {}, version: 1, updated_at: '2026-06-06',
  // roteiro_en present (→ hasEn) but empty beats (→ 0 beats); no ideia_en (→ no direction).
  sections: { roteiro_en: { content: { version: 3, beats: [] } } },
}

// Mutable row set so duration-specific cases can inject their own fixtures;
// beforeEach resets to the canonical pair above.
let mockRows: unknown[] = [ROW_V1, ROW_V2]

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: (cols: string) => {
        selectSpy(cols)
        // Self-referencing builder: tolerates any number of chained .eq() filters.
        const builder = {
          eq: () => builder,
          order: () => Promise.resolve({ data: mockRows, error: null }),
        }
        return builder
      },
    }),
  }),
}))

import { loadVideoHub } from '@/lib/pipeline/load-video-hub'

describe('loadVideoHub', () => {
  beforeEach(() => {
    selectSpy.mockClear()
    mockRows = [ROW_V1, ROW_V2]
  })

  it('selects the sections column + plain columns — no raw SQL (PostgREST cannot evaluate it)', async () => {
    await loadVideoHub('site-1')
    const cols = selectSpy.mock.calls[0][0] as string
    expect(cols).toContain('sections')
    expect(cols).toContain('format_metadata')
    // Regression guard: PostgREST .select() rejects SQL expressions — the hub once shipped
    // jsonb_array_length/CASE/`?`/`AS` here and 500'd against the real API.
    expect(cols).not.toMatch(/jsonb_array_length|CASE |\sAS\s|sections \?|to_jsonb/)
  })

  it('derives per-card beats + flags from the sections payload in JS', async () => {
    const hub = await loadVideoHub('site-1')
    const c1 = hub.cards.find((c) => c.id === 'v1')!
    expect(c1.column).toBe('roteiro')
    expect(c1.pillar).toBe('viagem')
    expect(c1.duration).toBe('14–17 min')
    expect(c1.beatsCount).toBe(3)
    expect(c1.beatsLabel).toBe('3 beats')
    expect(c1.hasPt).toBe(true)
    expect(c1.hasEn).toBe(false)
    expect(c1.title).toBe('Olá')

    const c2 = hub.cards.find((c) => c.id === 'v2')!
    expect(c2.column).toBe('published')
    expect(c2.pillar).toBeUndefined()
    expect(c2.duration).toBe('—')
    expect(c2.beatsCount).toBe(0)
    expect(c2.beatsLabel).toBe('sem roteiro')
    expect(c2.hasEn).toBe(true)
    expect(c2.title).toBe('Sem título')
  })

  it('prefers the authored duration_range over summed beat durations', async () => {
    mockRows = [{
      ...ROW_V1,
      format_metadata: { duration_range: '8–12min' },
      sections: {
        roteiro_pt: {
          content: {
            version: 3,
            beats: [{ idx: 0, name: 'Abertura', duration: 300 }],
          },
        },
      },
    }]
    const hub = await loadVideoHub('site-1')
    expect(hub.cards[0]!.duration).toBe('8–12min')
  })

  it('derives ~m:ss from summed beat durations when duration_range is unset', async () => {
    mockRows = [{
      ...ROW_V1,
      format_metadata: {},
      sections: {
        roteiro_pt: {
          content: {
            version: 3,
            beats: [
              { idx: 0, name: 'Abertura', duration: 300 },
              { idx: 1, name: 'Fechamento', duration: 270 },
              { idx: 2, name: 'Sem duração' }, // optional duration → counts as 0
            ],
          },
        },
      },
    }]
    const hub = await loadVideoHub('site-1')
    expect(hub.cards[0]!.duration).toBe('~9:30')
  })

  it('falls back to — when neither duration_range nor beat durations exist', async () => {
    mockRows = [{
      ...ROW_V1,
      format_metadata: {},
      sections: {
        roteiro_pt: {
          content: {
            version: 3,
            beats: [
              { idx: 0, name: 'Abertura' },
              { idx: 1, name: 'Fechamento', duration: 0 },
            ],
          },
        },
      },
    }]
    const hub = await loadVideoHub('site-1')
    expect(hub.cards[0]!.duration).toBe('—')
  })

  it('degrades a malformed roteiro to — without crashing the hub', async () => {
    mockRows = [{
      ...ROW_V1,
      format_metadata: {},
      // beats is not an array — readRoteiro throws; the card degrades, the hub survives.
      sections: { roteiro_pt: { content: { version: 3, beats: 'corrupted' } } },
    }]
    const hub = await loadVideoHub('site-1')
    expect(hub.cards[0]!.duration).toBe('—')
    expect(hub.cards[0]!.beatsCount).toBe(0)
  })

  it('computes stat-card counts by projected column and pillar chip counts', async () => {
    const hub = await loadVideoHub('site-1')
    expect(hub.stats.total).toBe(2)
    expect(hub.stats.roteiro).toBe(1)
    expect(hub.stats.gravacao).toBe(0)
    expect(hub.stats.published).toBe(1)
    expect(hub.pillarCounts.viagem).toBe(1)
    expect(hub.pillarCounts.ia ?? 0).toBe(0)
  })
})

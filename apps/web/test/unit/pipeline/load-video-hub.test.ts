import { describe, it, expect, vi, beforeEach } from 'vitest'

const selectSpy = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: (cols: string) => {
        selectSpy(cols)
        return {
          eq: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: 'v1', code: 'V-A01', title_pt: 'Olá', title_en: '',
                      language: 'pt-br', stage: 'roteiro',
                      format_metadata: { pillar: 'viagem', duration_range: '14–17 min' },
                      version: 1, updated_at: '2026-06-07',
                      beats_count: 3, has_direction: true, has_pt: true, has_en: false,
                    },
                    {
                      id: 'v2', code: 'V-A02', title_pt: '', title_en: '',
                      language: 'en', stage: 'published',
                      format_metadata: {}, version: 1, updated_at: '2026-06-06',
                      beats_count: 0, has_direction: false, has_pt: false, has_en: true,
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        }
      },
    }),
  }),
}))

import { loadVideoHub } from '@/lib/pipeline/load-video-hub'

describe('loadVideoHub', () => {
  beforeEach(() => selectSpy.mockClear())

  it('projects beats_count via direct bounded sections operators, NEVER selecting the full body', async () => {
    await loadVideoHub('site-1')
    const cols = selectSpy.mock.calls[0][0] as string
    expect(cols).toContain('beats_count')
    // Bounded: the count is computed server-side directly on the `sections` column.
    expect(cols).toMatch(/jsonb_array_length\(\s*sections #> ARRAY/)
    // `sections` must never be a BARE selected column (that would transfer the blob);
    // operator expressions (`sections #>`, `sections ?`) are the allowed bounded form.
    expect(cols).not.toMatch(/\bsections\b\s*(,|$)/m)
    // Guard against the whole-row serialization hack (reads every column incl. the body).
    expect(cols).not.toContain('to_jsonb(content_pipeline')
  })

  it('derives per-card fields from projected scalars only', async () => {
    const hub = await loadVideoHub('site-1')
    const c1 = hub.cards.find((c) => c.id === 'v1')!
    expect(c1.column).toBe('roteiro')
    expect(c1.pillar).toBe('viagem')
    expect(c1.duration).toBe('14–17 min')
    expect(c1.beatsLabel).toBe('3 beats')
    expect(c1.title).toBe('Olá')

    const c2 = hub.cards.find((c) => c.id === 'v2')!
    expect(c2.column).toBe('published')
    expect(c2.pillar).toBeUndefined()
    expect(c2.duration).toBe('—')
    expect(c2.beatsLabel).toBe('sem roteiro')
    expect(c2.title).toBe('Sem título')
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

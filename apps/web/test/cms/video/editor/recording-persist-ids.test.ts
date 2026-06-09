import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1', timezone: 'UTC' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn() }))

import { persistBeatIds } from '@/app/cms/(authed)/video/[id]/edit/recording-actions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import type { RoteiroContentV3 } from '@/lib/pipeline/roteiro-schemas'

const ROTEIRO_NO_IDS: RoteiroContentV3 = {
  version: 3,
  meta: {},
  beats: [
    { idx: 0, name: 'Hook', status: 'PENDING', kind: 'fala', script: [{ type: 'line', text: 'Olá mundo' }] },
    { idx: 1, name: 'Corpo', status: 'PENDING', kind: 'fala', script: [{ type: 'line', text: 'Segundo beat' }] },
  ],
}

/**
 * Minimal Supabase stub: the first `.single()` resolves the item read, the second (after an
 * `.update()` was queued) resolves the updated row. Captures the queued update payload.
 */
function buildSupabase(item: Record<string, unknown> | null) {
  const updates: Record<string, unknown>[] = []
  const chain = () => {
    const obj: Record<string, unknown> = {}
    const ret = () => obj
    obj.select = vi.fn(ret)
    obj.eq = vi.fn(ret)
    obj.update = vi.fn((d: Record<string, unknown>) => { updates.push(d); return obj })
    obj.single = vi.fn().mockImplementation(() =>
      updates.length > 0
        ? Promise.resolve({ data: { version: (item!.version as number) + 1 }, error: null })
        : Promise.resolve({ data: item, error: item ? null : { message: 'no row' } }),
    )
    return obj
  }
  return { from: vi.fn(chain), _updates: updates }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'u1' } } as never)
})

describe('persistBeatIds — beat-id persistence guard', () => {
  it('stamps + persists ids when beats lack them (changed → write, version bumps)', async () => {
    const sb = buildSupabase({
      id: 'vid-1',
      version: 4,
      sections: { roteiro_pt: { rev: 2, source: 'user', edited: true, content: ROTEIRO_NO_IDS } },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(sb as never)

    const res = await persistBeatIds('vid-1', 'pt', 4)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.persisted).toBe(true)
      expect(res.data.version).toBe(5)
    }
    // Exactly one update queued, writing the stamped roteiro back under the section key.
    expect(sb._updates.length).toBe(1)
    const written = sb._updates[0] as { sections: Record<string, { rev: number; edited: boolean; content: RoteiroContentV3 }> }
    const section = written.sections.roteiro_pt!
    expect(section.rev).toBe(3) // bumped from 2
    expect(section.edited).toBe(true) // preserved — system stamp does not change edited
    expect(section.content.beats.every((b) => typeof b.id === 'string' && b.id.length > 0)).toBe(true)
  })

  it('is a NO-OP when every beat already has an id (no write, persisted:false)', async () => {
    const withIds: RoteiroContentV3 = {
      ...ROTEIRO_NO_IDS,
      beats: ROTEIRO_NO_IDS.beats.map((b, i) => ({ ...b, id: `beat-${i}` })),
    }
    const sb = buildSupabase({
      id: 'vid-1',
      version: 4,
      sections: { roteiro_pt: { rev: 2, source: 'user', edited: true, content: withIds } },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(sb as never)

    const res = await persistBeatIds('vid-1', 'pt', 4)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.persisted).toBe(false)
    expect(sb._updates.length).toBe(0)
  })

  it('is a NO-OP when the lang has no roteiro section', async () => {
    const sb = buildSupabase({ id: 'vid-1', version: 4, sections: {} })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(sb as never)

    const res = await persistBeatIds('vid-1', 'en', 4)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.persisted).toBe(false)
    expect(sb._updates.length).toBe(0)
  })

  it('returns version_conflict on a stale expectedVersion (does not fight an in-flight edit)', async () => {
    const sb = buildSupabase({
      id: 'vid-1',
      version: 9,
      sections: { roteiro_pt: { rev: 2, source: 'user', edited: true, content: ROTEIRO_NO_IDS } },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(sb as never)

    const res = await persistBeatIds('vid-1', 'pt', 4)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('version_conflict')
    expect(sb._updates.length).toBe(0)
  })

  it('checks edit scope BEFORE the service client (forbidden short-circuits)', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'insufficient_access' } as never)
    const res = await persistBeatIds('vid-1', 'pt', 4)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('forbidden')
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
    expect(requireSiteScope).toHaveBeenCalledWith(expect.objectContaining({ mode: 'edit' }))
  })
})

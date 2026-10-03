import { describe, it, expect, vi, beforeEach } from 'vitest'

const deletes: string[] = []
function chain(table: string): Record<string, unknown> {
  const c: Record<string, unknown> = {}
  const self = () => c
  for (const m of ['select', 'eq', 'lt', 'gt', 'in', 'is', 'order', 'limit', 'update', 'insert', 'upsert', 'maybeSingle', 'single']) c[m] = vi.fn(self)
  c.delete = vi.fn(() => { deletes.push(table); return c })
  c.then = (r: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: [], error: null }).then(r)
  return c
}
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: (t: string) => chain(t), rpc: vi.fn(() => Promise.resolve({ data: null, error: null })) }) }))
vi.mock('@/lib/cron-health', () => ({ getCronHealth: vi.fn(() => Promise.resolve(null)), recordCronSuccess: vi.fn(), recordCronFailure: vi.fn() }))

describe('ab-watchdog keeps competitor change history', () => {
  beforeEach(() => { deletes.length = 0; process.env.CRON_SECRET = 's' })
  it('never deletes competitor_changes', async () => {
    const { GET } = await import('@/app/api/cron/ab-watchdog/route')
    await GET(new Request('http://x/api/cron/ab-watchdog', { headers: { authorization: 'Bearer s' } }) as never)
    expect(deletes).not.toContain('competitor_changes')
    expect(deletes).toContain('competitor_channel_snapshots')
  })
})

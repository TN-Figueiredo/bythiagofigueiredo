// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { fakePostgrest } from '../helpers/fake-postgrest'
import { makeTestRow } from '../helpers/ab-fixtures'

vi.mock('react', async (orig) => {
  const real = await orig<typeof import('react')>()
  return {
    ...real,
    cache: <A extends unknown[], R>(fn: (...a: A) => R) => {
      const memo = new Map<unknown, R>()
      return (...a: A): R => {
        if (!memo.has(a[0])) memo.set(a[0], fn(...a))
        return memo.get(a[0]) as R
      }
    },
  }
})
const estado = vi.hoisted(() => ({ fake: null as null | ReturnType<typeof import('../helpers/fake-postgrest').fakePostgrest> }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true }) }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => estado.fake!.client }))

import { getTestResults } from '@/app/cms/(authed)/youtube/ab-lab/queries'

describe('S8-F3 T3: uma leitura por abertura (M5)', () => {
  it('8: duas chamadas a getTestResults registram 1 consulta em ab_test_dias', async () => {
    estado.fake = fakePostgrest({
      columns: { ab_test_dias: ['test_id', 'day_pt', 'site_id', 'variant_id', 'motivo_sem_variante', 'alcance_estado', 'impressoes', 'ctr', 'views', 'views_estado', 'retratado_em', 'final'] },
      tables: {
        ab_tests: [{ ...makeTestRow({ id: 't1', site_id: 'site-1' }), youtube_videos: null }],
        ab_test_variants: [{ id: 'v-a', test_id: 't1', label: 'original', is_original: true, sort_order: 0 }],
        ab_test_cycles: [{ id: 'c1', test_id: 't1', variant_id: 'v-a', cycle_number: 1, started_at: null, ended_at: null, backfill_status: 'pending', backfill_attempts: 0, applied_metadata: null, created_at: null }],
        ab_test_polls: [],
        ab_test_dias: [],
      },
    })
    await getTestResults('t1')
    await getTestResults('t1')
    expect(estado.fake.on('ab_test_dias')).toHaveLength(1)
  })
})

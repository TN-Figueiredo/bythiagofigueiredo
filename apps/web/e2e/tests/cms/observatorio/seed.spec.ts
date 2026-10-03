// apps/web/e2e/tests/cms/observatorio/seed.spec.ts — smoke of the fidelity seed (no browser page):
// oracle → rows of the localhost site → loadDataset → engine gives the mockup's tab counts.
// The same round trip runs without Playwright in test/integration/observatorio-seed.test.ts.
import '../../../fixtures/server-only-shim' // first: load.ts imports 'server-only'
import { test, expect } from '@playwright/test'
import { loadDataset } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'
import { seedObservatory, clearObservatory, localServiceClient, ORACLE_NOW } from '../../../fixtures/observatorio-seed'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'

test('oracle seed loads into the engine with the mockup counts', async () => {
  test.setTimeout(120_000)
  const supabase = localServiceClient()
  const siteId = await getSeedSiteId(supabase)
  await seedObservatory(siteId, {}, supabase)
  try {
    expect(ORACLE_NOW).toBe(Date.parse('2026-10-24T15:02:00-03:00'))
    const obs = createObservatory(await loadDataset({ siteId, now: ORACLE_NOW, supabase }))
    expect(obs.tabCounts('todos')).toEqual({ canais: 14, mud: 18, out: 11 })
  } finally {
    await clearObservatory(siteId, supabase)
  }
})

// @vitest-environment node
// apps/web/test/youtube/observatorio/load-measure.test.ts — round trips and bytes of one render, per data volume.
import { describe, it, expect } from 'vitest'
import { fakeSupabase } from '../../helpers/fake-supabase'
import { buildTables } from './load-fixture'
import { loadRows } from '@/lib/youtube/observatorio/load'

const NOW = Date.now()
// the production shape of 2026-10-06 (13 channels, ~100 videos each, 50 tracked), today and projected to 3 months
const SHAPES = [
  { name: 'hoje (4 dias)', channels: 13, videosPerChannel: 100, limit: 50, days: 4, descChars: 1200 },
  { name: '3 meses (90 dias)', channels: 13, videosPerChannel: 100, limit: 50, days: 90, descChars: 1200 },
]

describe('medição: carregador sem cache (loadRows)', () => {
  it.each(SHAPES)('$name', async shape => {
    const db = fakeSupabase(buildTables({ siteId: 'site-m', now: NOW, ...shape }))
    const rows = await loadRows({ siteId: 'site-m', now: NOW, supabase: db.client })
    console.info('[medicao] sem cache |', shape.name, '| idas', db.trips.length, '| bytes', db.bytes, '| diários', rows.daily.length)
    expect(rows.daily).toHaveLength(13 * 50 * (shape.days + 1))
    expect(rows.videos).toHaveLength(1300)
    expect(db.trips.length).toBeGreaterThan(20)
  })
})

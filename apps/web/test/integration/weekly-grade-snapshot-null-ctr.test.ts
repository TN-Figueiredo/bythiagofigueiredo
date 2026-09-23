// @vitest-environment node
/**
 * DB-gated: runs the REAL weekly-grade-snapshot route against the local
 * Postgres, with videos shaped exactly like production on 2026-09-22 — `ctr`,
 * `impressions`, `avg_view_percentage` and `traffic_sources` all NULL on every
 * row (0 of 35 had any of them, because nothing can write them: YouTube
 * Analytics API v2 does not serve impressions/CTR).
 *
 * The old suite only ever fed computeBaseline fixtures WITH a ctr, i.e. it
 * supplied exactly what production never has — and the cron's
 * `.not('ctr', 'is', null)` filter silently graded zero videos every Monday.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn() }))
vi.mock('@/lib/cron-health', () => ({
  recordCronSuccess: vi.fn(async () => undefined),
  recordCronFailure: vi.fn(async () => undefined),
}))

import { GET } from '@/app/api/cron/weekly-grade-snapshot/route'
import { NextRequest } from 'next/server'

interface GradeRow {
  youtube_video_id: string
  grade: string
  score: number
  ctr: number | null
  retention: number | null
  reach: number | null
  engagement: number | null
  growth: number | null
  sub_impact: number | null
  view_count: number | null
}

describe.skipIf(skipIfNoLocalDb())('weekly-grade-snapshot with production-shaped (NULL ctr) videos', () => {
  const SECRET = 'test-cron-secret-weekly-grade'
  let siteId: string
  let channelId: string
  let measuredId: string
  let unmeasuredId: string
  let rows: GradeRow[] = []
  let body: { graded: number; errors: number }

  beforeAll(async () => {
    process.env.CRON_SECRET = SECRET
    const admin = getSupabaseServiceClient()
    siteId = (await seedSite(admin)).siteId

    channelId = randomUUID()
    const { error: chErr } = await admin.from('youtube_channels').insert({
      id: channelId,
      site_id: siteId,
      channel_id: `ext-chan-${channelId.slice(0, 8)}`,
      locale: 'pt',
      handle: `@g-${channelId.slice(0, 8)}`,
      name: 'Grade channel',
      uploads_playlist_id: `UU-${channelId.slice(0, 8)}`,
      sync_enabled: true,
      subscriber_count: 400,
    })
    if (chErr) throw new Error(`channel seed failed: ${chErr.message}`)

    measuredId = randomUUID()
    unmeasuredId = randomUUID()
    const base = {
      site_id: siteId,
      channel_id: channelId,
      published_at: new Date(Date.now() - 60 * 864e5).toISOString(),
      // exactly production: nothing can fill these four
      ctr: null,
      impressions: null,
      avg_view_percentage: null,
      traffic_sources: null,
    }
    const { error: vErr } = await admin.from('youtube_videos').insert([
      { ...base, id: measuredId, youtube_video_id: `ext-${measuredId.slice(0, 8)}`, title: 'Medido', view_count: 500 },
      { ...base, id: unmeasuredId, youtube_video_id: `ext-${unmeasuredId.slice(0, 8)}`, title: 'Sem analytics', view_count: 120 },
    ])
    if (vErr) throw new Error(`video seed failed: ${vErr.message}`)

    // Only the first video has an analytics row (as the sync-analytics cron
    // writes it: impressions/ctr stay at their 0 default).
    const { error: aErr } = await admin.from('youtube_video_analytics').insert({
      youtube_video_id: measuredId,
      site_id: siteId,
      date: new Date(Date.now() - 864e5).toISOString().split('T')[0]!,
      views: 200,
      likes: 10,
      comments: 4,
      shares: 2,
      subscribers_gained: 3,
    })
    if (aErr) throw new Error(`analytics seed failed: ${aErr.message}`)

    const res = await GET(new NextRequest('http://localhost/api/cron/weekly-grade-snapshot', {
      headers: { authorization: `Bearer ${SECRET}` },
    }))
    body = await res.json() as { graded: number; errors: number }

    const { data, error } = await admin
      .from('video_grade_history')
      .select('youtube_video_id, grade, score, ctr, retention, reach, engagement, growth, sub_impact, view_count')
      .in('youtube_video_id', [measuredId, unmeasuredId])
    if (error) throw new Error(error.message)
    rows = (data ?? []) as unknown as GradeRow[]
  })

  afterAll(async () => {
    const admin = getSupabaseServiceClient()
    // video_grade_history + youtube_video_analytics cascade from youtube_videos
    await admin.from('optimization_cycles').delete().in('youtube_video_id', [measuredId, unmeasuredId])
    await admin.from('youtube_videos').delete().eq('channel_id', channelId)
    await admin.from('youtube_channels').delete().eq('id', channelId)
    await admin.from('sites').delete().eq('id', siteId)
  })

  it('grades videos whose ctr is NULL instead of skipping the whole channel', () => {
    expect(body.errors).toBe(0)
    expect(rows.map(r => r.youtube_video_id).sort()).toEqual([measuredId, unmeasuredId].sort())
  })

  it('records the unmeasurable axes as NULL, never as a score', () => {
    const measured = rows.find(r => r.youtube_video_id === measuredId)!
    expect(measured.ctr).toBeNull()
    expect(measured.retention).toBeNull()
    expect(measured.sub_impact).toBeNull()
    expect(measured.growth).toBeNull()
    expect(measured.reach).not.toBeNull()
    expect(measured.engagement).not.toBeNull()
    expect(measured.view_count).toBe(500)
  })

  it('a video with no analytics row has no engagement axis rather than an engagement of 0', () => {
    const unmeasured = rows.find(r => r.youtube_video_id === unmeasuredId)!
    expect(unmeasured.engagement).toBeNull()
    expect(unmeasured.reach).not.toBeNull()
  })

  it('the stored score is the renormalized mean of the axes that exist', () => {
    // reach and engagement carry the same base weight (0.15 each), so after
    // renormalization the score is their plain average (no evergreen bonus:
    // one analytics row is far below the 14 it needs).
    const measured = rows.find(r => r.youtube_video_id === measuredId)!
    expect(Number(measured.score)).toBeCloseTo((Number(measured.reach) + Number(measured.engagement)) / 2, 1)
    const unmeasured = rows.find(r => r.youtube_video_id === unmeasuredId)!
    expect(Number(unmeasured.score)).toBeCloseTo(Number(unmeasured.reach), 1)
  })
})

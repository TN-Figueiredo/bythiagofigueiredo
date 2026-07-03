import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

describe.skipIf(skipIfNoLocalDb())('content_tracking RPCs', () => {
  const service = createClient(SUPABASE_URL, SERVICE_KEY)

  it('aggregate_content_events creates metrics rows', async () => {
    const { data: site } = await service.from('sites').select('id').limit(1).single()
    expect(site).not.toBeNull()

    const postId = crypto.randomUUID()
    await service.from('content_events').insert([
      {
        site_id: site!.id,
        session_id: crypto.randomUUID(),
        resource_type: 'blog',
        resource_id: postId,
        event_type: 'view',
        anonymous_id: 'test-anon-1',
        referrer_src: 'google',
        has_consent: false,
      },
      {
        site_id: site!.id,
        session_id: crypto.randomUUID(),
        resource_type: 'blog',
        resource_id: postId,
        event_type: 'read_complete',
        anonymous_id: 'test-anon-1',
        read_depth: 100,
        has_consent: false,
      },
    ])

    const { data, error } = await service.rpc('aggregate_content_events', {
      p_date: new Date().toISOString().split('T')[0],
    })
    expect(error).toBeNull()
    expect(data.metrics_upserted).toBeGreaterThan(0)

    const { data: metrics } = await service
      .from('content_metrics')
      .select('*')
      .eq('resource_id', postId)
      .single()
    expect(metrics).not.toBeNull()
    expect(metrics!.views).toBe(1)
    expect(metrics!.reads_complete).toBe(1)

    // Cleanup
    await service.from('content_events').delete().eq('resource_id', postId)
    await service.from('content_metrics').delete().eq('resource_id', postId)
  })

  it('purge_content_events removes old events', async () => {
    const { data: site } = await service.from('sites').select('id').limit(1).single()

    await service.from('content_events').insert({
      site_id: site!.id,
      session_id: crypto.randomUUID(),
      resource_type: 'blog',
      resource_id: crypto.randomUUID(),
      event_type: 'view',
      anonymous_id: 'old-anon',
      has_consent: false,
      created_at: new Date(Date.now() - 100 * 86400000).toISOString(),
    })

    const { data, error } = await service.rpc('purge_content_events', {
      p_older_than_days: 90,
    })
    expect(error).toBeNull()
    expect(data.purged).toBeGreaterThan(0)
  })
})

// BTF-095 — LGPD Art. 7 I / Art. 8: the POST route must NOT persist behavioral
// analytics for events lacking consent (server-side defense-in-depth, on top of
// the client hook gate). Drives the real route handler against local Supabase.
describe.skipIf(skipIfNoLocalDb())('POST /api/track/content — consent gate (BTF-095)', () => {
  const service = createClient(SUPABASE_URL, SERVICE_KEY)

  beforeAll(() => {
    // getSupabaseServiceClient() reads these at call time; point it at local DB.
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY
    // Avoid any geo lookup network path in the route.
    process.env.GEO_PROVIDER = 'stub'
  })

  async function callRoute(events: unknown[]): Promise<Response> {
    const { POST } = await import('@/app/api/track/content/route')
    const req = new Request('http://localhost/api/track/content', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'vitest-agent' },
      body: JSON.stringify({ events }),
    })
    return POST(req)
  }

  it('does NOT persist an event with hasConsent=false (204, zero rows)', async () => {
    const { data: site } = await service.from('sites').select('id').limit(1).single()
    const resourceId = crypto.randomUUID()

    const res = await callRoute([
      {
        sessionId: crypto.randomUUID(),
        siteId: site!.id,
        resourceType: 'blog',
        resourceId,
        eventType: 'view',
        anonymousId: 'anon-noconsent',
        hasConsent: false,
      },
    ])
    expect(res.status).toBe(204)

    const { data: rows } = await service
      .from('content_events')
      .select('id')
      .eq('resource_id', resourceId)
    expect(rows ?? []).toHaveLength(0)
  })

  it('persists an event with hasConsent=true', async () => {
    const { data: site } = await service.from('sites').select('id').limit(1).single()
    const resourceId = crypto.randomUUID()

    const res = await callRoute([
      {
        sessionId: crypto.randomUUID(),
        siteId: site!.id,
        resourceType: 'blog',
        resourceId,
        eventType: 'view',
        anonymousId: 'anon-consent',
        hasConsent: true,
      },
    ])
    expect(res.status).toBe(204)

    const { data: rows } = await service
      .from('content_events')
      .select('id, has_consent')
      .eq('resource_id', resourceId)
    expect(rows ?? []).toHaveLength(1)
    expect(rows![0].has_consent).toBe(true)

    await service.from('content_events').delete().eq('resource_id', resourceId)
  })

  it('drops only the unconsented events in a mixed batch', async () => {
    const { data: site } = await service.from('sites').select('id').limit(1).single()
    const consentedId = crypto.randomUUID()
    const unconsentedId = crypto.randomUUID()

    const res = await callRoute([
      {
        sessionId: crypto.randomUUID(),
        siteId: site!.id,
        resourceType: 'blog',
        resourceId: consentedId,
        eventType: 'view',
        anonymousId: 'anon-a',
        hasConsent: true,
      },
      {
        sessionId: crypto.randomUUID(),
        siteId: site!.id,
        resourceType: 'blog',
        resourceId: unconsentedId,
        eventType: 'view',
        anonymousId: 'anon-b',
        hasConsent: false,
      },
    ])
    expect(res.status).toBe(204)

    const { data: kept } = await service
      .from('content_events')
      .select('id')
      .eq('resource_id', consentedId)
    const { data: dropped } = await service
      .from('content_events')
      .select('id')
      .eq('resource_id', unconsentedId)
    expect(kept ?? []).toHaveLength(1)
    expect(dropped ?? []).toHaveLength(0)

    await service.from('content_events').delete().eq('resource_id', consentedId)
  })
})

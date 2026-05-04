import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'

const SUPABASE_URL = 'http://127.0.0.1:54321'

describe.skipIf(skipIfNoLocalDb())('content_tracking RPCs', () => {
  const service = createClient(SUPABASE_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU')

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

import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/local-supabase'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

describe.skipIf(skipIfNoLocalDb())('cron_runs schema', () => {
  const createdIds: string[] = []

  afterAll(async () => {
    if (createdIds.length > 0) {
      await admin.from('cron_runs').delete().in('id', createdIds)
    }
  })

  it('inserts ok run', async () => {
    const { data, error } = await admin
      .from('cron_runs')
      .insert({
        job: 'publish-scheduled',
        status: 'ok',
        duration_ms: 42,
        items_processed: 3,
      })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data?.job).toBe('publish-scheduled')
    if (data?.id) createdIds.push(data.id)
  })

  it('inserts error run with message', async () => {
    const { data, error } = await admin
      .from('cron_runs')
      .insert({
        job: 'publish-scheduled',
        status: 'error',
        error: 'boom',
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    if (data?.id) createdIds.push(data.id)
  })
})

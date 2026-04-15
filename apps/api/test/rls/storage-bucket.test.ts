import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, ANON_KEY } from '../helpers/local-supabase'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)
const anon = createClient(SUPABASE_URL, ANON_KEY)

describe.skipIf(skipIfNoLocalDb())('campaign-files bucket', () => {
  const createdPaths: string[] = []

  afterAll(async () => {
    if (createdPaths.length > 0) {
      await admin.storage.from('campaign-files').remove(createdPaths)
    }
  })

  it('bucket exists and is private', async () => {
    const { data, error } = await admin.storage.listBuckets()
    expect(error).toBeNull()
    const bucket = (data ?? []).find((b) => b.id === 'campaign-files')
    expect(bucket).toBeTruthy()
    expect(bucket!.public).toBe(false)
  })

  it('anon cannot write to bucket', async () => {
    const file = new Blob(['hello'], { type: 'text/plain' })
    const { data, error } = await anon.storage
      .from('campaign-files')
      .upload(`anon-${Date.now()}.txt`, file)
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/unauthor|row-level security|403|policy/i)
  })

  it('service role can write to bucket', async () => {
    const file = new Blob(['hello'], { type: 'text/plain' })
    const path = `sr-${Date.now()}.txt`
    const { error } = await admin.storage.from('campaign-files').upload(path, file)
    expect(error).toBeNull()
    createdPaths.push(path)
  })
})

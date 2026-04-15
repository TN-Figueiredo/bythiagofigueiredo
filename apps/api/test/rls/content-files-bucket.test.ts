import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, ANON_KEY } from '../helpers/local-supabase'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)
const anon = createClient(SUPABASE_URL, ANON_KEY)

describe.skipIf(skipIfNoLocalDb())('content-files bucket', () => {
  it('bucket exists and is private', async () => {
    const { data } = await admin.storage.listBuckets()
    const bucket = (data ?? []).find((b) => b.id === 'content-files')
    expect(bucket).toBeTruthy()
    expect(bucket!.public).toBe(false)
  })

  it('anon cannot write', async () => {
    const file = new Blob(['hello'], { type: 'text/plain' })
    const { error } = await anon.storage.from('content-files').upload(`anon-${Date.now()}.txt`, file)
    expect(error).not.toBeNull()
  })

  it('service role can write', async () => {
    const file = new Blob(['hello'], { type: 'text/plain' })
    const { error } = await admin.storage.from('content-files').upload(`sr-${Date.now()}.txt`, file)
    expect(error).toBeNull()
  })
})

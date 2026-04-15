import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/local-supabase'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

describe.skipIf(skipIfNoLocalDb())('citext extension', () => {
  it('pg_typeof_citext_probe returns "citext"', async () => {
    const { data, error } = await admin.rpc('pg_typeof_citext_probe')
    expect(error).toBeNull()
    expect(data).toBe('citext')
  })
})

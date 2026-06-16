import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/db-seed'
import { WAITLIST_CONSENT_VERSION as V } from '@/app/api/waitlists/consent'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

describe.skipIf(skipIfNoLocalDb())('consent_texts seed resolves for both locales', () => {
  it('has a row for en AND pt-BR at WAITLIST_CONSENT_VERSION', async () => {
    const { data } = await db.from('consent_texts').select('id, text_md').in('id', [
      `launch_notification:en:${V}`, `launch_notification:pt-BR:${V}`,
    ])
    expect((data ?? []).length).toBe(2)
    // The {name} placeholder is load-bearing: the signup route interpolates the waitlist
    // name into this exact text for the audit snapshot. Guard against a future seed dropping it.
    expect((data ?? []).every((r) => (r.text_md ?? '').includes('{name}'))).toBe(true)
  })
})

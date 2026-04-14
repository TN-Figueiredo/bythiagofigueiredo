import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'

// Point the app at the local Supabase BEFORE importing the server/env.
// Keys below are the stable Supabase CLI defaults for `supabase start`.
const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const LOCAL_SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

process.env.SUPABASE_URL = LOCAL_SUPABASE_URL
process.env.SUPABASE_ANON_KEY = LOCAL_ANON_KEY
process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_KEY

const { buildServer } = await import('../../src/server.js')

describe.skipIf(skipIfNoLocalDb())('signup → author row (integration)', () => {
  let app: FastifyInstance
  const admin = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const email = `signup-hook-${Date.now()}@gmail.com`

  beforeAll(async () => {
    app = await buildServer()
    await app.ready()
  })

  afterAll(async () => {
    const { data: users } = await admin.auth.admin.listUsers()
    const u = users?.users.find((x) => x.email === email)
    if (u) {
      await admin.from('authors').delete().eq('user_id', u.id)
      await admin.auth.admin.deleteUser(u.id)
    }
    await app.close()
  })

  it('POST /auth/signup creates an authors row linked to the new user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email,
        password: 'dev-password-123!',
        ageConfirmation: true,
      },
    })
    expect([200, 201]).toContain(res.statusCode)

    const { data: users } = await admin.auth.admin.listUsers()
    const u = users?.users.find((x) => x.email === email)
    expect(u).toBeDefined()

    const { data: author, error } = await admin
      .from('authors')
      .select('user_id, name, slug')
      .eq('user_id', u!.id)
      .single()
    expect(error).toBeNull()
    expect(author?.user_id).toBe(u!.id)
    expect(author?.slug).toMatch(new RegExp(`^signup-hook-\\d+-${u!.id.slice(0, 8)}$`))
  })
})

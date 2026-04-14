import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
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

describe.skipIf(skipIfNoLocalDb())('e2e smoke', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = await buildServer()
    await app.ready()
  })
  afterAll(async () => {
    await app?.close()
  })

  it('GET /health returns ok with db=ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('ok')
    expect(body.db).toBe('ok')
  })

  it('POST /auth/signin with seeded creds returns 200 + token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signin',
      payload: { email: 'thiago@bythiagofigueiredo.com', password: 'dev-password-123' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    // auth-fastify envelope: { success: true, data: { user, session } }
    // Accept common token field names across possible session shapes.
    const session = body?.data?.session ?? body?.session
    const token =
      session?.accessToken ??
      session?.access_token ??
      body?.data?.accessToken ??
      body?.accessToken
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(10)
  })
})

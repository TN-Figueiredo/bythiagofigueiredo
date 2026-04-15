import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, ANON_KEY, SERVICE_KEY } from '../helpers/local-supabase'

// Point the app at the local Supabase BEFORE importing the server/env.
const LOCAL_ANON_KEY = process.env.LOCAL_SUPABASE_ANON_KEY ?? ANON_KEY
const LOCAL_SERVICE_KEY = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? SERVICE_KEY

process.env.SUPABASE_URL = SUPABASE_URL
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

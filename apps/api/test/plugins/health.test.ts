import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import { healthPlugin } from '../../src/plugins/health.js'

describe('healthPlugin', () => {
  it('GET /health returns 200 with {status, db, time}', async () => {
    const app = Fastify()
    await app.register(healthPlugin)
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('ok')
    expect(['ok', 'fail']).toContain(body.db)
    expect(typeof body.time).toBe('string')
    await app.close()
  })
})

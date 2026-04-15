import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import { authPlugin } from '../../src/plugins/auth.js'

describe('authPlugin', () => {
  it('registers POST /auth/signin route', async () => {
    const app = Fastify()
    await app.register(authPlugin)
    await app.ready()
    const routes = app.printRoutes({ commonPrefix: false })
    expect(routes).toMatch(/\/auth\/signin/)
    expect(routes).toMatch(/\/auth\/signup/)
    expect(routes).toMatch(/\/auth\/refresh/)
    await app.close()
  })
})

import { describe, it, expect } from 'vitest'
import { buildServer } from '../src/server.js'

describe('server', () => {
  it('boots with health + auth plugins registered', async () => {
    const app = await buildServer()
    await app.ready()
    const routes = app.printRoutes({ commonPrefix: false })
    expect(routes).toMatch(/\/health/)
    expect(routes).toMatch(/\/auth\/signin/)
    await app.close()
  })
})

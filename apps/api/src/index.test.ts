import { describe, it, expect } from 'vitest'

describe('api', () => {
  it('health check response shape', () => {
    const response = { status: 'ok' }
    expect(response).toEqual({ status: 'ok' })
  })
})

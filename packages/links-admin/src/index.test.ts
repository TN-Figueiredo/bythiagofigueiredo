import { describe, it, expect } from 'vitest'

describe('@tn-figueiredo/links-admin scaffold', () => {
  it('exports types from index (server-safe barrel)', async () => {
    const mod = await import('./index')
    expect(mod).toBeDefined()
  })

  it('exports client barrel with "use client" components', async () => {
    const mod = await import('./client')
    expect(mod).toBeDefined()
  })
})

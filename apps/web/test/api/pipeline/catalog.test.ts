import { describe, it, expect, vi } from 'vitest'

const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockLike = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args)
        return {
          eq: (...a: unknown[]) => {
            mockEq(...a)
            return {
              like: (...b: unknown[]) => {
                mockLike(...b)
                return { data: [], error: null }
              },
            }
          },
        }
      },
    }),
  }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => ({ siteId: 'site-1' }),
}))

import { GET } from '@/app/api/pipeline/route'

describe('GET /api/pipeline/', () => {
  it('returns catalog with version 2.0.0', async () => {
    const res = await GET()
    const json = await res.json()
    expect(json.version).toBe('2.0.0')
  })

  it('has capabilities array with 6 domains', async () => {
    const res = await GET()
    const json = await res.json()
    expect(json.capabilities).toHaveLength(6)
  })

  it('has directives object', async () => {
    const res = await GET()
    const json = await res.json()
    expect(json.directives).toBeDefined()
    expect(typeof json.directives).toBe('object')
  })

  it('has cross_domain_workflows', async () => {
    const res = await GET()
    const json = await res.json()
    expect(json.cross_domain_workflows.length).toBeGreaterThan(0)
  })

  it('has context section with filter docs', async () => {
    const res = await GET()
    const json = await res.json()
    expect(json.context.endpoint).toBe('/api/pipeline/context')
    expect(json.context.filters).toBeDefined()
  })
})

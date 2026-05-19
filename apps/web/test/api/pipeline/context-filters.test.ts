import { describe, it, expect, vi, beforeEach } from 'vitest'

const MOCK_REFS = [
  { key: 'personal-profile', title: 'Profile', content_md: '# Profile', content_compact: {}, ref_group: 'pessoal', sort_order: 10, version: 1, updated_at: '2026-01-01' },
  { key: 'writer-voice-guide', title: 'Voice', content_md: '# Voice', content_compact: {}, ref_group: 'craft', sort_order: 10, version: 1, updated_at: '2026-01-01' },
  { key: '_system/groups', title: 'Groups', content_md: '', content_compact: { groups: [] }, ref_group: 'sistema', sort_order: 0, version: 1, updated_at: '2026-01-01' },
  { key: '_system/skill-mappings', title: 'Mappings', content_md: '', content_compact: { writer: ['personal-profile', 'writer-voice-guide'] }, ref_group: 'sistema', sort_order: 1, version: 1, updated_at: '2026-01-01' },
]

let capturedChainCalls: { method: string; args: unknown[] }[] = []

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => {
      capturedChainCalls = []
      const chain: Record<string, (...args: unknown[]) => unknown> = {}

      const addMethod = (name: string) => {
        chain[name] = (...args: unknown[]) => {
          capturedChainCalls.push({ method: name, args })
          return chain
        }
      }

      for (const m of ['select', 'eq', 'neq', 'in', 'not', 'like', 'order']) addMethod(m)

      // For the skill-mappings single() lookup
      chain.single = () => ({
        data: MOCK_REFS.find((r) => r.key === '_system/skill-mappings'),
        error: null,
      })

      // Make chain thenable — resolve with filtered data based on captured calls
      chain.then = (resolve: (v: unknown) => void) => {
        let result = [...MOCK_REFS]

        for (const call of capturedChainCalls) {
          if (call.method === 'eq' && call.args[0] === 'ref_group') {
            result = result.filter(r => r.ref_group === call.args[1])
          }
          if (call.method === 'in' && call.args[0] === 'key') {
            const keys = call.args[1] as string[]
            result = result.filter(r => keys.includes(r.key))
          }
          if (call.method === 'not' && call.args[0] === 'key' && call.args[1] === 'like') {
            const pattern = (call.args[2] as string).replace('%', '.*')
            const re = new RegExp(`^${pattern}$`)
            result = result.filter(r => !re.test(r.key))
          }
        }

        return Promise.resolve({ data: result, error: null }).then(resolve)
      }

      return chain
    },
  }),
}))

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: () => ({ ok: true, auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'api_key', keyHash: 'abc' } }),
  buildRateLimitHeaders: () => ({}),
}))

import { GET } from '@/app/api/pipeline/context/route'
import { NextRequest } from 'next/server'

function makeReq(params = ''): NextRequest {
  return new NextRequest(`http://localhost/api/pipeline/context${params}`)
}

describe('GET /api/pipeline/context', () => {
  beforeEach(() => { capturedChainCalls = [] })

  it('excludes _system/ entries by default', async () => {
    const res = await GET(makeReq())
    const json = await res.json()
    const keys = json.data.map((d: { key: string }) => d.key)
    expect(keys).not.toContain('_system/groups')
    expect(keys).not.toContain('_system/skill-mappings')
  })

  it('filters by ?group=pessoal', async () => {
    const res = await GET(makeReq('?group=pessoal'))
    const json = await res.json()
    for (const item of json.data) {
      expect(item.ref_group).toBe('pessoal')
    }
  })

  it('returns _system/ entries when ?group=sistema', async () => {
    const res = await GET(makeReq('?group=sistema'))
    const json = await res.json()
    expect(json.data.some((d: { key: string }) => d.key.startsWith('_system/'))).toBe(true)
  })
})

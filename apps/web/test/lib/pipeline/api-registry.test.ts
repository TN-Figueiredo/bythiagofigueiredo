import { describe, it, expect } from 'vitest'
import { API_REGISTRY, type ApiCatalog } from '@/lib/pipeline/api-registry'

describe('API_REGISTRY', () => {
  it('has version 2.0.0', () => {
    expect(API_REGISTRY.version).toBe('2.0.0')
  })

  it('has exactly 6 capability domains', () => {
    expect(API_REGISTRY.capabilities).toHaveLength(6)
    const domains = API_REGISTRY.capabilities.map((c) => c.domain)
    expect(domains).toEqual([
      'items-and-sections',
      'playlists',
      'libraries',
      'research',
      'youtube',
      'utilities',
    ])
  })

  it('endpoint_count matches actual endpoints array length for each domain', () => {
    for (const cap of API_REGISTRY.capabilities) {
      expect(cap.endpoint_count, `${cap.domain} count mismatch`).toBe(cap.endpoints.length)
    }
  })

  it('every endpoint has method, path, summary, and auth', () => {
    for (const cap of API_REGISTRY.capabilities) {
      for (const ep of cap.endpoints) {
        expect(ep.method).toMatch(/^(GET|POST|PATCH|PUT|DELETE)$/)
        expect(ep.path).toMatch(/^\//)
        expect(ep.summary.length).toBeGreaterThan(5)
        expect(ep.auth).toMatch(/^(read|write)$/)
      }
    }
  })

  it('every domain has suggest_when', () => {
    for (const cap of API_REGISTRY.capabilities) {
      expect(cap.suggest_when.length).toBeGreaterThan(10)
    }
  })

  it('has cross_domain_workflows', () => {
    expect(API_REGISTRY.cross_domain_workflows.length).toBeGreaterThan(0)
  })

  it('satisfies ApiCatalog type', () => {
    const catalog: ApiCatalog = API_REGISTRY
    expect(catalog.name).toBe('Content Pipeline API')
  })

  it('has no duplicate method+path combinations', () => {
    const seen = new Set<string>()
    for (const cap of API_REGISTRY.capabilities) {
      for (const ep of cap.endpoints) {
        const key = `${ep.method}:${ep.path}`
        expect(seen.has(key), `Duplicate endpoint: ${key}`).toBe(false)
        seen.add(key)
      }
    }
  })

  it('all endpoint paths start with /api/pipeline/', () => {
    for (const cap of API_REGISTRY.capabilities) {
      for (const ep of cap.endpoints) {
        expect(ep.path, `${ep.method} ${ep.path}`).toMatch(/^\/api\/pipeline\//)
      }
    }
  })

  it('cross_domain_workflows reference valid domains', () => {
    const validDomains = new Set(API_REGISTRY.capabilities.map((c) => c.domain))
    for (const workflow of API_REGISTRY.cross_domain_workflows) {
      for (const domain of workflow.domains) {
        expect(validDomains.has(domain), `Unknown domain "${domain}" in workflow "${workflow.name}"`).toBe(true)
      }
    }
  })
})

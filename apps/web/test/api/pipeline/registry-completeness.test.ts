import { describe, it, expect } from 'vitest'
import { API_REGISTRY } from '@/lib/pipeline/api-registry'
import { readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'

function findRouteFiles(dir: string): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      results.push(...findRouteFiles(full))
    } else if (entry === 'route.ts') {
      results.push(full)
    }
  }
  return results
}

describe('Registry completeness', () => {
  const pipelineDir = join(process.cwd(), 'src/app/api/pipeline')
  const routeFiles = findRouteFiles(pipelineDir)
    .filter((f) => !f.includes('/docs/'))

  const registeredPaths = API_REGISTRY.capabilities.flatMap((c) =>
    c.endpoints.map((e) => e.path.replace(/\/api\/pipeline/, ''))
  )

  it('has at least 50 registered endpoints', () => {
    const total = API_REGISTRY.capabilities.reduce((sum, c) => sum + c.endpoints.length, 0)
    expect(total).toBeGreaterThanOrEqual(50)
  })

  it('every capability domain has a docs file', () => {
    for (const cap of API_REGISTRY.capabilities) {
      const docPath = join(process.cwd(), '..', '..', 'docs', `cowork-docs-${cap.domain}.md`)
      expect(existsSync(docPath), `Missing doc: cowork-docs-${cap.domain}.md`).toBe(true)
    }
  })

  it('route file count roughly matches registered endpoint count', () => {
    const catalogRoutes = 1
    const docsRoutes = 1
    const domainRouteCount = routeFiles.length - catalogRoutes - docsRoutes
    const totalEndpoints = API_REGISTRY.capabilities.reduce((s, c) => s + c.endpoints.length, 0)
    expect(domainRouteCount).toBeLessThanOrEqual(totalEndpoints)
    expect(domainRouteCount).toBeGreaterThan(20)
  })
})

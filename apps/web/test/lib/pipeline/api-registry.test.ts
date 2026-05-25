import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, relative } from 'path'
import { API_REGISTRY, type ApiCatalog } from '@/lib/pipeline/api-registry'

describe('API_REGISTRY', () => {
  it('has version 2.0.0', () => {
    expect(API_REGISTRY.version).toBe('2.0.0')
  })

  it('has exactly 7 capability domains', () => {
    expect(API_REGISTRY.capabilities).toHaveLength(7)
    const domains = API_REGISTRY.capabilities.map((c) => c.domain)
    expect(domains).toEqual([
      'items-and-sections',
      'playlists',
      'libraries',
      'research',
      'youtube',
      'utilities',
      'course',
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

describe('registry completeness', () => {
  const webRoot = join(__dirname, '..', '..', '..', 'src')
  const routeDir = join(webRoot, 'app', 'api', 'pipeline')

  function findRouteFiles(dir: string): string[] {
    const results: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
      if (entry.name === 'route.ts' && entry.parentPath) {
        results.push(join(entry.parentPath, entry.name))
      }
    }
    return results
  }

  function toApiPath(filePath: string): string {
    const rel = relative(routeDir, filePath)
      .replace(/\/?route\.ts$/, '')
      .replace(/\[([^\]]+)\]/g, ':$1')
    return rel ? `/api/pipeline/${rel}` : '/api/pipeline'
  }

  const HTTP_METHOD_RE = /export\s+(?:(?:async\s+)?function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g

  const registryEndpoints = API_REGISTRY.capabilities.flatMap(c =>
    c.endpoints.map(e => ({ method: e.method, path: e.path, domain: c.domain }))
  )

  it('every route file has a registry entry', () => {
    const routeFiles = findRouteFiles(routeDir)
    const regSet = new Set(registryEndpoints.map(e => `${e.method} ${e.path}`))
    const missing: string[] = []

    for (const file of routeFiles) {
      const apiPath = toApiPath(file)
      if (apiPath === '/api/pipeline') continue // infrastructure: serves registry itself

      const content = readFileSync(file, 'utf8')
      let match: RegExpExecArray | null
      const re = new RegExp(HTTP_METHOD_RE.source, HTTP_METHOD_RE.flags)
      while ((match = re.exec(content)) !== null) {
        const key = `${match[1]} ${apiPath}`
        if (!regSet.has(key)) {
          missing.push(
            `${match[1]} ${apiPath}\n` +
            `  File: ${relative(join(routeDir, '..', '..', '..', '..'), file)}\n` +
            `  Fix: add to api-registry.ts: { method: '${match[1]}', path: '${apiPath}', summary: '...', auth: 'write' }`
          )
        }
      }
    }

    expect(missing, `Routes without registry entries:\n${missing.join('\n\n')}`).toHaveLength(0)
  })

  it('every registry entry has a route file', () => {
    const stale: string[] = []
    for (const ep of registryEndpoints) {
      const fsPath = join(routeDir, ep.path.replace(/^\/api\/pipeline\//, '').replace(/:([^/]+)/g, '[$1]'), 'route.ts')
      if (!existsSync(fsPath)) {
        stale.push(`${ep.method} ${ep.path} (${ep.domain}) — route file not found. Remove from api-registry.ts if deleted.`)
      } else {
        const content = readFileSync(fsPath, 'utf8')
        const re = new RegExp(HTTP_METHOD_RE.source, HTTP_METHOD_RE.flags)
        const exportedMethods: string[] = []
        let match: RegExpExecArray | null
        while ((match = re.exec(content)) !== null) {
          exportedMethods.push(match[1])
        }
        if (!exportedMethods.includes(ep.method)) {
          stale.push(`${ep.method} ${ep.path} (${ep.domain}) — method not exported in route file. Remove from api-registry.ts if handler was deleted.`)
        }
      }
    }
    expect(stale, `Registry entries without route files:\n${stale.join('\n')}`).toHaveLength(0)
  })

  it('total exported methods across route files matches registry count', () => {
    const routeFiles = findRouteFiles(routeDir)
    let totalExported = 0

    for (const file of routeFiles) {
      const apiPath = toApiPath(file)
      if (apiPath === '/api/pipeline') continue // infrastructure root

      const content = readFileSync(file, 'utf8')
      const re = new RegExp(HTTP_METHOD_RE.source, HTTP_METHOD_RE.flags)
      while (re.exec(content) !== null) {
        totalExported++
      }
    }

    expect(
      totalExported,
      `Route files export ${totalExported} methods but registry has ${registryEndpoints.length} entries. ` +
      `Run the "every route file has a registry entry" and "every registry entry has a route file" tests for details.`
    ).toBe(registryEndpoints.length)
  })

  it('every domain has a Tier 2 doc file', () => {
    const docsDir = join(webRoot, '..', 'data', 'pipeline-docs')
    const missing: string[] = []
    for (const cap of API_REGISTRY.capabilities) {
      const docPath = join(docsDir, `cowork-docs-${cap.domain}.md`)
      if (!existsSync(docPath)) {
        missing.push(`Domain "${cap.domain}" — create data/pipeline-docs/cowork-docs-${cap.domain}.md`)
      }
    }
    expect(missing, `Domains without Tier 2 docs:\n${missing.join('\n')}`).toHaveLength(0)
  })

  it('seed script file references are valid', () => {
    const seedPath = join(__dirname, '..', '..', '..', '..', '..', 'scripts', 'seed-pipeline-reference.ts')
    expect(existsSync(seedPath), `Seed script not found at ${seedPath}`).toBe(true)

    const content = readFileSync(seedPath, 'utf8')
    const filePathRe = /filePath:\s*['"]([^'"]+)['"]/g
    const scriptsDir = join(seedPath, '..')
    const broken: string[] = []

    let match: RegExpExecArray | null
    while ((match = filePathRe.exec(content)) !== null) {
      const refPath = join(scriptsDir, match[1])
      if (!existsSync(refPath)) {
        broken.push(`filePath: '${match[1]}' — resolved to ${refPath} (not found)`)
      }
    }
    expect(broken, `Broken file references in seed script:\n${broken.join('\n')}`).toHaveLength(0)
  })
})

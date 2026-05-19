import { NextRequest } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { authenticatePipeline } from '@/lib/pipeline/auth'
import { API_REGISTRY } from '@/lib/pipeline/api-registry'
import { pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'

// Resolve docs directory relative to this file so it works regardless of cwd
// (tests run from apps/web, Next.js runs from apps/web, both need monorepo root)
const DOCS_DIR = join(fileURLToPath(import.meta.url), '../../../../../../../../..', 'docs')

const DOMAIN_DOCS = new Map<string, string>()
for (const cap of API_REGISTRY.capabilities) {
  const filePath = join(DOCS_DIR, `cowork-docs-${cap.domain}.md`)
  if (existsSync(filePath)) {
    DOMAIN_DOCS.set(cap.domain, readFileSync(filePath, 'utf-8'))
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return pipelineError('UNAUTHORIZED', authResult.error, authResult.status)

  const guide = DOMAIN_DOCS.get(domain)
  const capability = API_REGISTRY.capabilities.find((c) => c.domain === domain)

  if (!guide || !capability) {
    const available = API_REGISTRY.capabilities.map((c) => c.domain)
    return pipelineError(
      'DOC_NOT_FOUND',
      `Domain "${domain}" not found. Available: ${available.join(', ')}`,
      404,
      authResult.auth,
    )
  }

  return pipelineSuccess({
    domain: capability.domain,
    name: capability.name,
    description: capability.description,
    guide,
  }, 200, authResult.auth)
}

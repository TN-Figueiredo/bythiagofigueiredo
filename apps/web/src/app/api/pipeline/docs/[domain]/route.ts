import { NextRequest } from 'next/server'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { authenticatePipeline } from '@/lib/pipeline/auth'
import { API_REGISTRY } from '@/lib/pipeline/api-registry'
import { pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'

function loadDocs(): Map<string, string> {
  const docsDir = join(process.cwd(), '..', '..', 'docs')
  const docs = new Map<string, string>()
  for (const cap of API_REGISTRY.capabilities) {
    const fp = join(docsDir, `cowork-docs-${cap.domain}.md`)
    if (existsSync(fp)) {
      docs.set(cap.domain, readFileSync(fp, 'utf-8'))
    }
  }
  return docs
}

let DOMAIN_DOCS: Map<string, string> | null = null
function getDocs(): Map<string, string> {
  if (!DOMAIN_DOCS) DOMAIN_DOCS = loadDocs()
  return DOMAIN_DOCS
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return pipelineError('UNAUTHORIZED', authResult.error, authResult.status)

  const guide = getDocs().get(domain)
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

import { NextRequest, NextResponse } from 'next/server'
import { WORKFLOWS } from '@/lib/pipeline/workflows'
import { API_REGISTRY } from '@/lib/pipeline/api-registry'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead } from '@/lib/pipeline/helpers'
import { getSiteContext } from '@/lib/cms/site-context'

async function loadDirectives(siteId: string): Promise<Record<string, { version: number; value: unknown }>> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('reference_content')
    .select('key, content_compact, version')
    .eq('site_id', siteId)
    .like('key', '_system/%')

  const directives: Record<string, { version: number; value: unknown }> = {}
  for (const row of data ?? []) {
    const shortKey = row.key.replace('_system/', '')
    directives[shortKey] = { version: row.version, value: row.content_compact }
  }
  return directives
}

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  let directives: Record<string, { version: number; value: unknown }> = {}
  try {
    const { siteId } = await getSiteContext()
    directives = await loadDirectives(siteId)
  } catch {
    directives = await loadDirectives(auth.siteId)
  }

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: {
      name: API_REGISTRY.name,
      version: API_REGISTRY.version,
      auth: API_REGISTRY.auth,
      capabilities: API_REGISTRY.capabilities,
      directives,
      cross_domain_workflows: API_REGISTRY.cross_domain_workflows,
      context: {
        endpoint: '/api/pipeline/context',
        filters: {
          group: '?group={group_id}',
          skill: '?skill={skill_name}',
          format: '?format=md (full markdown) or default (compact JSON)',
        },
      },
      formats: Object.keys(WORKFLOWS),
      workflows: WORKFLOWS,
    },
  }, { headers: headers ?? {} })
}

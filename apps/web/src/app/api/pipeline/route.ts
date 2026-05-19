import { NextResponse } from 'next/server'
import { WORKFLOWS } from '@/lib/pipeline/workflows'
import { API_REGISTRY } from '@/lib/pipeline/api-registry'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

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

export async function GET() {
  let directives: Record<string, { version: number; value: unknown }> = {}
  try {
    const { getSiteContext } = await import('@/lib/cms/site-context')
    const { siteId } = await getSiteContext()
    directives = await loadDirectives(siteId)
  } catch {
    // No site context (e.g., API key auth without site resolution) — return catalog without directives
  }

  return NextResponse.json({
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
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, buildRateLimitHeaders } from '@/lib/pipeline/auth'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult

  const format = req.nextUrl.searchParams.get('format')
  const group = req.nextUrl.searchParams.get('group')
  const skill = req.nextUrl.searchParams.get('skill')

  if (format && format !== 'md' && format !== 'compact') {
    return NextResponse.json({ error: { code: 'INVALID_PARAM', message: 'format must be "md" or "compact"' } }, { status: 400 })
  }

  if (group && !/^[a-z][a-z0-9_]{0,29}$/.test(group)) {
    return NextResponse.json({ error: { code: 'INVALID_PARAM', message: 'Invalid group id format' } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()

  // If filtering by skill, resolve keys from _system/skill-mappings
  let skillKeys: string[] | null = null
  if (skill) {
    const { data: mappingRow } = await supabase
      .from('reference_content')
      .select('content_compact')
      .eq('site_id', auth.siteId)
      .eq('key', '_system/skill-mappings')
      .single()
    const mappings = mappingRow?.content_compact as Record<string, string[]> | null
    skillKeys = mappings?.[skill] ?? []
  }

  let query = supabase
    .from('reference_content')
    .select('key, title, content_md, content_compact, ref_group, sort_order, version, updated_at')
    .eq('site_id', auth.siteId)

  if (group) {
    query = query.eq('ref_group', group)
  } else {
    // Exclude _system/* entries from default context calls
    query = query.not('key', 'like', '_system/%')
  }

  if (skillKeys !== null) {
    if (skillKeys.length === 0) {
      return NextResponse.json({ data: [] }, { headers: buildRateLimitHeaders(auth) ?? {} })
    }
    query = query.in('key', skillKeys)
  }

  query = query.order('ref_group').order('sort_order').order('key')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: { code: 'QUERY_ERROR', message: 'Failed to load references' } }, { status: 400 })

  const mapped = data?.map((d) => ({
    key: d.key,
    title: d.title,
    content: format === 'md' ? d.content_md : d.content_compact ?? d.content_md,
    ref_group: d.ref_group,
    sort_order: d.sort_order,
    version: d.version,
    updated_at: d.updated_at,
  }))

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: mapped }, { headers: headers ?? {} })
}

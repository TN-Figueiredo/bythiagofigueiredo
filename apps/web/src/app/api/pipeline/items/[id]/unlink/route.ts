import { NextRequest, NextResponse } from 'next/server'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { unlinkPostFromItem } from '@/lib/pipeline/blog-link'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID format' } }, { status: 400 })
  }

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const result = await unlinkPostFromItem(id, auth.siteId, null)
  if (!result.ok) return NextResponse.json({ error: { code: 'UNLINK_FAILED', message: result.error } }, { status: 400 })

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: { unlinked: true } }, { headers })
}

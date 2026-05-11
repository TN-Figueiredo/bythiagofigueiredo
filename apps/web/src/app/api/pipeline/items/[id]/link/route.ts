import { NextRequest, NextResponse } from 'next/server'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { linkPostToItem } from '@/lib/pipeline/blog-link'
import { z } from 'zod'

const LinkSchema = z.object({
  blog_post_id: z.string().uuid(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID format' } }, { status: 400 })
  }

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = LinkSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') } }, { status: 400 })

  const result = await linkPostToItem(id, parsed.data.blog_post_id, auth.siteId, null)

  if (!result.ok) {
    const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : result.code === 'DUPLICATE' || result.code === 'ALREADY_LINKED' ? 409 : 400
    return NextResponse.json({ error: { code: result.code ?? 'LINK_FAILED', message: result.error } }, { status })
  }

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: { linked: true, blog_post_id: parsed.data.blog_post_id } }, { headers })
}

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  const excludePostId = req.nextUrl.searchParams.get('exclude_post_id')

  if (!slug?.trim()) return NextResponse.json({ exists: false })

  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('blog_translations')
    .select('post_id')
    .eq('slug', slug)

  if (excludePostId) query = query.neq('post_id', excludePostId)

  const { data } = await query.limit(1)
  return NextResponse.json({ exists: (data?.length ?? 0) > 0 })
}

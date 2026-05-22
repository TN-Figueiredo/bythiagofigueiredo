import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  requireUser,
  createServerClient,
  UnauthenticatedError,
} from '@tn-figueiredo/auth-nextjs/server'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  const excludePostId = req.nextUrl.searchParams.get('exclude_post_id')

  if (!slug?.trim()) return NextResponse.json({ exists: false })

  const siteId = req.headers.get('x-site-id')
  if (!siteId) return NextResponse.json({ error: 'missing site context' }, { status: 400 })

  const cookieStore = await cookies()
  const supabase = createServerClient({
    env: {
      apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          cookieStore.set(name, value, options)
        }
      },
    },
  })

  try {
    await requireUser(supabase)
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    throw err
  }

  let query = supabase
    .from('blog_translations')
    .select('post_id, blog_posts!inner(id, site_id)')
    .eq('slug', slug)
    .eq('blog_posts.site_id', siteId)

  if (excludePostId) query = query.neq('post_id', excludePostId)

  const { data } = await query.limit(1)
  return NextResponse.json({ exists: (data?.length ?? 0) > 0 })
}

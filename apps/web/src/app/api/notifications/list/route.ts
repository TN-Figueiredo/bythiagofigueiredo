import { createServerClient } from '@tn-figueiredo/auth-nextjs'
import { cookies } from 'next/headers'
import { getSiteContext } from '@/lib/cms/site-context'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient({
    env: {
      apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ items: [] })

  const { siteId } = await getSiteContext()
  const { data } = await supabase
    .from('notifications')
    .select('id, site_id, user_id, type, domain, title, message, action_href, suggested_action, priority, read_at, dismissed_at, expired_at, snoozed_until, dedup_key, group_key, created_at')
    .eq('site_id', siteId)
    .eq('user_id', user.id)
    .is('dismissed_at', null)
    .is('expired_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    items: (data ?? []).map(n => ({ ...n, payload: null })),
  })
}

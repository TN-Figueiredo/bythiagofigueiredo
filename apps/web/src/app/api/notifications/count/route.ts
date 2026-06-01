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
  if (!user) return NextResponse.json({ unreadCount: 0, hasCritical: false })

  const { siteId } = await getSiteContext()
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('user_id', user.id)
    .is('dismissed_at', null)
    .is('expired_at', null)
    .is('read_at', null)

  const { count: criticalCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('user_id', user.id)
    .is('dismissed_at', null)
    .is('expired_at', null)
    .is('read_at', null)
    .gte('priority', 4)

  return NextResponse.json({
    unreadCount: count ?? 0,
    hasCritical: (criticalCount ?? 0) > 0,
  })
}

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { EditionEditor } from '../[id]/edit/edition-editor'

export const dynamic = 'force-dynamic'

export default async function NewEditionPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const params = await searchParams
  const supabase = getSupabaseServiceClient()
  const typeId = params.type ?? null

  if (typeId) {
    const { data: type } = await supabase
      .from('newsletter_types')
      .select('id, active')
      .eq('id', typeId)
      .eq('site_id', ctx.siteId)
      .single()
    if (!type || !type.active) throw new Error('Invalid or inactive newsletter type')
  }

  const { data: types } = await supabase
    .from('newsletter_types')
    .select('id, name, color')
    .eq('site_id', ctx.siteId)
    .eq('active', true)
    .order('sort_order')

  const defaultTypeId = typeId ?? types?.[0]?.id ?? null
  let subscriberCount = 0
  if (defaultTypeId) {
    const { count } = await supabase
      .from('newsletter_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('newsletter_id', defaultTypeId)
      .eq('status', 'confirmed')
    subscriberCount = count ?? 0
  }

  const cookieStore = await cookies()
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(c: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of c) cookieStore.set(name, value, options)
        },
      },
    },
  )
  const { data: { user } } = await userClient.auth.getUser()

  return (
    <EditionEditor
      edition={null}
      subscriberCount={subscriberCount}
      types={(types ?? []).map((t) => ({
        id: t.id as string,
        name: t.name as string,
        color: (t.color ?? '#7c3aed') as string,
      }))}
      initialTypeId={defaultTypeId}
      userEmail={user?.email ?? ''}
    />
  )
}

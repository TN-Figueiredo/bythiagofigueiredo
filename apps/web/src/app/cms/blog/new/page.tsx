import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { postRepo } from '../../../../../lib/cms/repositories'
import { getSiteContext } from '../../../../../lib/cms/site-context'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'

export const dynamic = 'force-dynamic'

export default async function NewPostPage() {
  const ctx = await getSiteContext()

  // Resolve current authenticated user via SSR client
  const cookieStore = await cookies()
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    },
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) {
    throw new Error('Unauthenticated — middleware should have redirected')
  }

  // Look up author row by user_id (service client bypasses RLS)
  const supabase = getSupabaseServiceClient()
  const { data: author, error } = await supabase
    .from('authors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !author) {
    throw new Error(`No author record linked to user_id=${user.id}. Create one in /cms/authors before posting.`)
  }

  const uniqueSlug = `sem-titulo-${Date.now()}`
  const post = await postRepo().create({
    site_id: ctx.siteId,
    author_id: author.id,
    initial_translation: {
      locale: ctx.defaultLocale,
      title: 'Sem título',
      slug: uniqueSlug,
      content_mdx: '',
    },
  })

  redirect(`/cms/blog/${post.id}/edit`)
}

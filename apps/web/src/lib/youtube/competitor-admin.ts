import { cookies } from 'next/headers'
import { createServerClient } from '@tn-figueiredo/auth-nextjs'

/**
 * "+25 vagas" is for admins only. Asks the database through the SESSION client: can_admin_site_users() is SECURITY
 * DEFINER and reads auth.uid(), so a service client (no uid) would always answer false. Fails closed on any error.
 */
export async function canAdminSiteUsers(siteId: string): Promise<boolean> {
  const cookieStore = await cookies()
  const userClient = createServerClient({
    env: {
      apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) cookieStore.set(name, value, options)
      },
    },
  })
  const { data, error } = await userClient.rpc('can_admin_site_users', { p_site_id: siteId })
  return !error && data === true
}

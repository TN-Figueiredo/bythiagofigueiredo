import { createServerClient } from '@tn-figueiredo/auth-nextjs'
import { cookies } from 'next/headers'

/**
 * True when the request carries a valid session (the recovery session minted
 * by /auth/callback from the PKCE `code`). Uses getUser() so the session is
 * validated against the auth server, not just the JWT.
 */
export async function hasRecoverySession(): Promise<boolean> {
  const cookieStore = await cookies()
  const supabase = createServerClient({
    env: {
      apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {
        // Server Component: cookies are read-only here.
      },
    },
  })
  const { data, error } = await supabase.auth.getUser()
  return !error && Boolean(data?.user)
}

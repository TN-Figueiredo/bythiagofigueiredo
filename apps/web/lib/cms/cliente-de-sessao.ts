import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'

/** O cliente Supabase da SESSÃO de quem pede (anon key + cookies): vale a RLS dele. Nunca é o cliente de serviço. */
export async function criarClienteDeSessao() {
  const cookieStore = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(c: Array<{ name: string; value: string; options?: CookieOptions }>) { for (const { name, value, options } of c) cookieStore.set(name, value, options) },
    },
  })
}

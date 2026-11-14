import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@tn-figueiredo/auth-nextjs'

/** A pessoa da SESSÃO (`getUser()`, que confere o JWT no Auth; nunca `getSession()`). Sem pessoa ou com erro = `null`. */
export async function usuarioDaSessao(): Promise<{ id: string; email: string | null } | null> {
  try {
    const store = await cookies()
    const sb = createServerClient({
      env: {
        apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      cookies: {
        getAll: () => store.getAll(),
        setAll: (lista) => {
          // Server Component não grava cookie; quem renova é o middleware (K17).
          try {
            for (const { name, value, options } of lista) store.set(name, value, options)
          } catch {
            /* render: sem escrita de cookie */
          }
        },
      },
    })
    const { data, error } = await sb.auth.getUser()
    if (error || !data?.user) return null
    return { id: data.user.id, email: data.user.email ?? null }
  } catch {
    return null
  }
}

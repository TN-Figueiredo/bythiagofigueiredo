// Sprint 5a Track D — D9: /account/(authed) layout.
// Guards the route group with requireUser() — redirects unauthenticated
// visitors to /cms/login (the canonical consumer login entry point per
// Sprint 4.5 split). On auth success, renders a minimal shell with
// account-level navigation.
import { createServerClient, requireUser, UnauthenticatedError } from '@tn-figueiredo/auth-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

export default async function AccountAuthedLayout({ children }: { children: ReactNode }) {
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
      redirect('/cms/login?redirect=/account/settings')
    }
    throw err
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
        <nav aria-label="Minha conta" className="mx-auto flex max-w-3xl items-center gap-4 text-sm">
          <Link href="/account/settings" className="font-medium">
            Minha conta
          </Link>
          <Link href="/account/settings/privacy" className="text-[var(--text-secondary)] hover:text-[var(--text)]">
            Privacidade
          </Link>
          <Link href="/account/export" className="text-[var(--text-secondary)] hover:text-[var(--text)]">
            Exportar
          </Link>
          <Link href="/account/delete" className="text-[var(--text-secondary)] hover:text-[var(--text)]">
            Excluir
          </Link>
        </nav>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-8">{children}</div>
    </div>
  )
}

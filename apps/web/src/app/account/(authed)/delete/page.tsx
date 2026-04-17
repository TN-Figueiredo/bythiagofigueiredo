// Sprint 5a Track D — D12: /account/delete page.
// Wraps <AccountDeleteWizard /> with the authed user's email + the
// feature-flag gate (NEXT_PUBLIC_ACCOUNT_DELETE_ENABLED).
import { createServerClient, requireUser } from '@tn-figueiredo/auth-nextjs'
import { cookies } from 'next/headers'
import { AccountDeleteWizard } from '@/components/lgpd/account-delete-wizard'

export const metadata = {
  title: 'Excluir conta | bythiagofigueiredo',
  robots: { index: false, follow: false },
}

export default async function AccountDeletePage() {
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
  const user = await requireUser(supabase)
  const enabled = process.env.NEXT_PUBLIC_ACCOUNT_DELETE_ENABLED === 'true'

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Excluir conta</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Processo assíncrono com 15 dias de graça. Você pode cancelar a qualquer momento durante o
          período.
        </p>
      </header>
      <AccountDeleteWizard userEmail={user.email} enabled={enabled} />
    </section>
  )
}

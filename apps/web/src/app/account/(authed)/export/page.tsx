// Sprint 5a Track D — D13: /account/export page.
// Feature-flagged by NEXT_PUBLIC_ACCOUNT_EXPORT_ENABLED.
import { createServerClient, requireUser } from '@tn-figueiredo/auth-nextjs'
import { cookies } from 'next/headers'
import { AccountExportButton } from '@/components/lgpd/account-export-button'

export const metadata = {
  title: 'Exportar dados | bythiagofigueiredo',
  robots: { index: false, follow: false },
}

export default async function AccountExportPage() {
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
  await requireUser(supabase)
  const enabled = process.env.NEXT_PUBLIC_ACCOUNT_EXPORT_ENABLED === 'true'

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Exportar meus dados</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Solicita um ZIP com seu conteúdo (posts, campanhas, consentimentos, histórico de audit).
          Limite de uma exportação a cada 30 dias (LGPD Art. 18 V).
        </p>
      </header>
      <AccountExportButton enabled={enabled} />
    </section>
  )
}

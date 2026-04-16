// Sprint 5a Track D — D10: /account/settings dashboard.
// Light hub with links to privacy / delete / export. Feature-flag
// aware: disabled flows render a hint line instead of a dead link.
import { createServerClient, requireUser } from '@tn-figueiredo/auth-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'

export const metadata = {
  title: 'Minha conta | bythiagofigueiredo',
  robots: { index: false, follow: false },
}

export default async function AccountSettingsPage() {
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

  const deleteEnabled = process.env.NEXT_PUBLIC_ACCOUNT_DELETE_ENABLED === 'true'
  const exportEnabled = process.env.NEXT_PUBLIC_ACCOUNT_EXPORT_ENABLED === 'true'

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Minha conta</h1>
        <p className="text-sm text-[var(--text-secondary)]">Conta: {user.email}</p>
      </header>

      <nav aria-label="Ações" className="flex flex-col gap-3">
        <Link
          href="/account/settings/privacy"
          className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-4 hover:bg-[var(--bg-subtle)]"
        >
          <span className="block text-sm font-medium">Privacidade</span>
          <span className="block text-xs text-[var(--text-secondary)]">
            Gerenciar consentimentos e histórico LGPD.
          </span>
        </Link>

        {exportEnabled ? (
          <Link
            href="/account/export"
            className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-4 hover:bg-[var(--bg-subtle)]"
          >
            <span className="block text-sm font-medium">Exportar dados</span>
            <span className="block text-xs text-[var(--text-secondary)]">
              Baixar um ZIP com todo o seu conteúdo (LGPD Art. 18 V).
            </span>
          </Link>
        ) : (
          <div className="rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] p-4 text-xs text-[var(--text-tertiary)]">
            Exportação temporariamente desabilitada.
          </div>
        )}

        {deleteEnabled ? (
          <Link
            href="/account/delete"
            className="rounded-md border border-red-500/40 bg-red-500/5 p-4 hover:bg-red-500/10"
          >
            <span className="block text-sm font-medium text-red-700 dark:text-red-300">
              Excluir conta
            </span>
            <span className="block text-xs text-[var(--text-secondary)]">
              Processo assíncrono com 15 dias de graça (LGPD Art. 18 VI).
            </span>
          </Link>
        ) : (
          <div className="rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] p-4 text-xs text-[var(--text-tertiary)]">
            Exclusão de conta temporariamente desabilitada.
          </div>
        )}
      </nav>
    </section>
  )
}

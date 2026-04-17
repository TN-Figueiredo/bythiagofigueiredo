// Sprint 5a Track D — D14a (under D9–13 umbrella): /account/deleted goodbye page.
// Public route (no auth) — shown after the deletion confirmation flow completes.
import Link from 'next/link'

export const metadata = {
  title: 'Conta excluída | bythiagofigueiredo',
  robots: { index: false, follow: false },
}

export default function AccountDeletedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <h1 className="text-2xl font-semibold">Sua conta foi excluída</h1>
      <p className="text-sm text-[var(--text-secondary)]">
        Iniciamos o processo de exclusão. Seu login está bloqueado imediatamente. Dados pessoais
        serão anonimizados e a conta removida em até 15 dias, conforme LGPD Art. 18 VI.
      </p>
      <p className="text-sm text-[var(--text-secondary)]">
        Se você mudou de ideia, clique no link de cancelamento enviado no email de confirmação.
      </p>
      <p className="text-xs text-[var(--text-tertiary)]">
        Dúvidas? Escreva para{' '}
        <a href="mailto:privacidade@bythiagofigueiredo.com" className="underline">
          privacidade@bythiagofigueiredo.com
        </a>
        .
      </p>
      <Link
        href="/"
        className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--bg-subtle)]"
      >
        Voltar à página inicial
      </Link>
    </main>
  )
}

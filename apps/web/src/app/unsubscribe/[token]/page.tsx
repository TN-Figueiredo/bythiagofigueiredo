import type { Metadata } from 'next'
import { unsubscribeViaToken } from './actions'

interface Props {
  params: Promise<{ token: string }>
  searchParams: Promise<{ confirmed?: string }>
}

// Prevent GET prefetches (email scanners / browser link previews) from firing
// the unsubscribe side effect.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  other: { 'cache-control': 'no-store' },
}

async function confirmUnsubscribe(token: string): Promise<void> {
  'use server'
  const result = await unsubscribeViaToken(token)
  // Encode status in URL so the page renders the right message on the same URL.
  const status = result.status
  // Redirect to the same page with ?confirmed=<status>
  const { redirect } = await import('next/navigation')
  redirect(`/unsubscribe/${encodeURIComponent(token)}?confirmed=${status}`)
}

export default async function UnsubscribePage({ params, searchParams }: Props) {
  const { token } = await params
  const { confirmed } = await searchParams

  if (!token || typeof token !== 'string') {
    return (
      <main>
        <h1>Link inválido</h1>
        <p>Este link de cancelamento é inválido.</p>
      </main>
    )
  }

  // If the user already confirmed via POST we render the result.
  if (confirmed) {
    if (confirmed === 'not_found') {
      return (
        <main>
          <h1>Link não encontrado</h1>
          <p>Este link de cancelamento não existe ou já foi removido.</p>
        </main>
      )
    }
    if (confirmed === 'error') {
      return (
        <main>
          <h1>Erro ao processar</h1>
          <p>Ocorreu um erro inesperado. Tente novamente mais tarde.</p>
        </main>
      )
    }
    if (confirmed === 'already') {
      return (
        <main>
          <h1>Já cancelado</h1>
          <p>
            Você já estava cancelado da nossa newsletter. Não enviaremos mais
            emails para você.
          </p>
        </main>
      )
    }
    // confirmed === 'ok'
    return (
      <main>
        <h1>Cancelamento confirmado</h1>
        <p>
          Você foi removido da nossa newsletter com sucesso. Não enviaremos
          mais emails para você.
        </p>
      </main>
    )
  }

  // Initial GET — just render a confirmation button. No side effects yet.
  // Email prefetchers / link scanners that issue GETs will not mark the token as used.
  return (
    <main>
      <h1>Cancelar inscrição</h1>
      <p>
        Clique no botão abaixo para confirmar o cancelamento da sua inscrição na nossa newsletter.
      </p>
      <form
        action={async () => {
          'use server'
          await confirmUnsubscribe(token)
        }}
        method="post"
      >
        <button type="submit">Cancelar minha inscrição</button>
      </form>
    </main>
  )
}

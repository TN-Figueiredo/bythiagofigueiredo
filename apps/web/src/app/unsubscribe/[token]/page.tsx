import { createHash } from 'node:crypto'
import type { Metadata } from 'next'
import { unsubscribeViaToken } from './actions'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'

interface Props {
  params: Promise<{ token: string }>
  searchParams: Promise<{ confirmed?: string }>
}

// Prevent GET prefetches (email scanners / browser link previews) from firing
// the unsubscribe side effect. L1: the initial GET is intentionally side-effect
// free — state change only happens on POST from the confirm button.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  other: { 'cache-control': 'no-store' },
}

// M3: minimal two-locale copy.
const COPY = {
  'pt-BR': {
    invalid_title: 'Link inválido',
    invalid_body: 'Este link de cancelamento é inválido.',
    not_found_title: 'Link não encontrado',
    not_found_body: 'Este link de cancelamento não existe ou já foi removido.',
    error_title: 'Erro ao processar',
    error_body: 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
    already_title: 'Já cancelado',
    already_body:
      'Você já estava cancelado da nossa newsletter. Não enviaremos mais emails para você.',
    ok_title: 'Cancelamento confirmado',
    ok_body:
      'Você foi removido da nossa newsletter com sucesso. Não enviaremos mais emails para você.',
    initial_title: 'Cancelar inscrição',
    initial_body:
      'Clique no botão abaixo para confirmar o cancelamento da sua inscrição na nossa newsletter.',
    initial_button: 'Cancelar minha inscrição',
  },
  en: {
    invalid_title: 'Invalid link',
    invalid_body: 'This unsubscribe link is invalid.',
    not_found_title: 'Link not found',
    not_found_body: 'This unsubscribe link does not exist or has already been removed.',
    error_title: 'Error processing',
    error_body: 'An unexpected error occurred. Please try again later.',
    already_title: 'Already unsubscribed',
    already_body:
      'You were already unsubscribed from our newsletter. We will not send you any more emails.',
    ok_title: 'Unsubscribe confirmed',
    ok_body:
      'You have been removed from our newsletter. We will not send you any more emails.',
    initial_title: 'Unsubscribe',
    initial_body:
      'Click the button below to confirm unsubscribing from our newsletter.',
    initial_button: 'Unsubscribe me',
  },
} as const

type Locale = keyof typeof COPY
function pickCopy(locale: string | null | undefined) {
  return COPY[(locale && locale in COPY ? locale : 'pt-BR') as Locale]
}

// Look up the subscription's locale by joining unsubscribe_tokens (by hash)
// to newsletter_subscriptions. Best-effort: any error falls back to pt-BR.
async function lookupLocale(token: string): Promise<string | null> {
  try {
    const supabase = getSupabaseServiceClient()
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const { data: tokRow } = await supabase
      .from('unsubscribe_tokens')
      .select('site_id, email')
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (!tokRow) return null
    const { data: subRow } = await supabase
      .from('newsletter_subscriptions')
      .select('locale')
      .eq('site_id', tokRow.site_id)
      .eq('email', tokRow.email)
      .maybeSingle()
    return (subRow?.locale as string | null) ?? null
  } catch {
    return null
  }
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
    const c = pickCopy(null)
    return (
      <main>
        <h1>{c.invalid_title}</h1>
        <p>{c.invalid_body}</p>
      </main>
    )
  }

  const locale = await lookupLocale(token)
  const c = pickCopy(locale)

  // If the user already confirmed via POST we render the result.
  if (confirmed) {
    if (confirmed === 'not_found') {
      return (
        <main>
          <h1>{c.not_found_title}</h1>
          <p>{c.not_found_body}</p>
        </main>
      )
    }
    if (confirmed === 'error') {
      return (
        <main>
          <h1>{c.error_title}</h1>
          <p>{c.error_body}</p>
        </main>
      )
    }
    if (confirmed === 'already') {
      return (
        <main>
          <h1>{c.already_title}</h1>
          <p>{c.already_body}</p>
        </main>
      )
    }
    // confirmed === 'ok'
    return (
      <main>
        <h1>{c.ok_title}</h1>
        <p>{c.ok_body}</p>
      </main>
    )
  }

  // Initial GET — just render a confirmation button. No side effects yet.
  // Email prefetchers / link scanners that issue GETs will not mark the token as used.
  return (
    <main>
      <h1>{c.initial_title}</h1>
      <p>{c.initial_body}</p>
      <form
        action={async () => {
          'use server'
          await confirmUnsubscribe(token)
        }}
        method="post"
      >
        <button type="submit">{c.initial_button}</button>
      </form>
    </main>
  )
}

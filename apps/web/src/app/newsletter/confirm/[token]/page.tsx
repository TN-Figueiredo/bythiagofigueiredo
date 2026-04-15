import { createHash } from 'node:crypto'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'

interface Props {
  params: Promise<{ token: string }>
}

interface ConfirmRpcResult {
  ok: boolean
  already?: boolean
  error?: 'not_found' | 'expired' | 'invalid_state'
  site_id?: string
  email?: string
}

// M3: minimal two-locale copy. Falls back to pt-BR for any other locale.
const COPY = {
  'pt-BR': {
    invalid_title: 'Link inválido',
    invalid_body: 'Este link de confirmação é inválido.',
    rpc_error_title: 'Erro ao confirmar',
    rpc_error_body: 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
    not_found_title: 'Link não encontrado',
    not_found_body: 'Este link de confirmação não existe ou já foi utilizado.',
    expired_title: 'Link expirado',
    expired_body:
      'Este link de confirmação expirou. Faça uma nova inscrição para receber um novo link.',
    invalid_state_title: 'Não foi possível confirmar',
    invalid_state_body:
      'Ocorreu um problema com sua inscrição. Entre em contato caso o problema persista.',
    already_title: 'Já confirmado',
    already_body:
      'Seu email já estava confirmado. Você continuará recebendo nossa newsletter.',
    ok_title: 'Inscrição confirmada!',
    ok_body: 'Obrigado por confirmar seu email. Você está inscrito na nossa newsletter.',
  },
  en: {
    invalid_title: 'Invalid link',
    invalid_body: 'This confirmation link is invalid.',
    rpc_error_title: 'Error confirming',
    rpc_error_body: 'An unexpected error occurred. Please try again later.',
    not_found_title: 'Link not found',
    not_found_body: 'This confirmation link does not exist or has already been used.',
    expired_title: 'Link expired',
    expired_body:
      'This confirmation link has expired. Please subscribe again to receive a new link.',
    invalid_state_title: 'Unable to confirm',
    invalid_state_body:
      'There was a problem with your subscription. Please contact us if the issue persists.',
    already_title: 'Already confirmed',
    already_body:
      'Your email was already confirmed. You will continue to receive our newsletter.',
    ok_title: 'Subscription confirmed!',
    ok_body: 'Thank you for confirming your email. You are subscribed to our newsletter.',
  },
} as const

type Locale = keyof typeof COPY
function pickCopy(locale: string | null | undefined) {
  return COPY[(locale && locale in COPY ? locale : 'pt-BR') as Locale]
}

export default async function NewsletterConfirmPage({ params }: Props) {
  const { token } = await params

  if (!token || typeof token !== 'string') {
    const c = pickCopy(null)
    return (
      <main>
        <h1>{c.invalid_title}</h1>
        <p>{c.invalid_body}</p>
      </main>
    )
  }

  const supabase = getSupabaseServiceClient()
  const tokenHash = createHash('sha256').update(token).digest('hex')

  // Pre-fetch the locale (best-effort — ignore errors). We look up by hash
  // before confirming so we know which language to render on success/already.
  let locale: string | null = null
  try {
    const { data: row } = await supabase
      .from('newsletter_subscriptions')
      .select('locale')
      .eq('confirmation_token_hash', tokenHash)
      .maybeSingle()
    locale = (row?.locale as string | null) ?? null
  } catch {
    /* best-effort */
  }

  const { data, error: rpcError } = await supabase.rpc('confirm_newsletter_subscription', {
    p_token_hash: tokenHash,
  })

  // RPC returns a JSON object
  const result = (data ?? null) as ConfirmRpcResult | null

  // If we didn't find a locale by hash (already-confirmed rows clear the hash),
  // try one more lookup via the returned email/site_id.
  if (!locale && result?.email && result.site_id) {
    try {
      const { data: row2 } = await supabase
        .from('newsletter_subscriptions')
        .select('locale')
        .eq('site_id', result.site_id)
        .eq('email', result.email)
        .maybeSingle()
      locale = (row2?.locale as string | null) ?? null
    } catch {
      /* best-effort */
    }
  }

  const c = pickCopy(locale)

  if (rpcError || !result) {
    return (
      <main>
        <h1>{c.rpc_error_title}</h1>
        <p>{c.rpc_error_body}</p>
      </main>
    )
  }

  if (!result.ok) {
    if (result.error === 'not_found') {
      return (
        <main>
          <h1>{c.not_found_title}</h1>
          <p>{c.not_found_body}</p>
        </main>
      )
    }
    if (result.error === 'expired') {
      return (
        <main>
          <h1>{c.expired_title}</h1>
          <p>{c.expired_body}</p>
        </main>
      )
    }
    // invalid_state or unknown
    return (
      <main>
        <h1>{c.invalid_state_title}</h1>
        <p>{c.invalid_state_body}</p>
      </main>
    )
  }

  if (result.already) {
    return (
      <main>
        <h1>{c.already_title}</h1>
        <p>{c.already_body}</p>
      </main>
    )
  }

  return (
    <main>
      <h1>{c.ok_title}</h1>
      <p>{c.ok_body}</p>
    </main>
  )
}

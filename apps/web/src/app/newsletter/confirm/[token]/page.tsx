import React from 'react'
import type { Metadata } from 'next'
import { createHash } from 'node:crypto'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { ConfirmLayout } from './_layouts/confirm-layout'
import { ConfirmFlow } from './confirm-flow'
import type { ConfirmCopy } from './confirm-flow'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ token: string }>
}

// M3: minimal two-locale copy. Falls back to pt-BR for any other locale.
const COPY = {
  'pt-BR': {
    confirm_title: 'Confirmar inscrição',
    confirm_body: 'Clique no botão abaixo para confirmar sua inscrição na newsletter.',
    confirm_button: 'Confirmar inscrição',
    confirm_pending: 'Confirmando...',
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
      'Seu email já estava confirmado. Você continuará recebendo as edições das suas newsletters.',
    ok_title: 'Inscrição confirmada!',
    ok_body: 'Sua inscrição está confirmada.',
    ok_body_continuation: 'A próxima edição vai direto para o seu email.',
    ok_signoff: 'Obrigado por estar aqui.',
    already_signoff: 'Obrigado por estar aqui.',
    go_to_site: 'Ir para o site',
    read_latest: 'Ou leia o último artigo →',
    back_home: 'Voltar ao início',
    subscribed_to: 'Suas newsletters:',
  },
  en: {
    confirm_title: 'Confirm subscription',
    confirm_body: 'Click the button below to confirm your newsletter subscription.',
    confirm_button: 'Confirm subscription',
    confirm_pending: 'Confirming...',
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
      'Your email was already confirmed. You will continue receiving editions of your newsletters.',
    ok_title: 'Subscription confirmed!',
    ok_body: 'Your subscription is confirmed.',
    ok_body_continuation: 'The next edition will go straight to your inbox.',
    ok_signoff: 'Thank you for being here.',
    already_signoff: 'Thank you for being here.',
    go_to_site: 'Go to site',
    read_latest: 'Or read the latest article →',
    back_home: 'Back to home',
    subscribed_to: 'Your newsletters:',
  },
} as const

type Locale = keyof typeof COPY
function pickCopy(locale: string | null | undefined) {
  return COPY[(locale && locale in COPY ? locale : 'pt-BR') as Locale]
}

/**
 * Two-step confirmation page.
 *
 * GET does NOT call the confirm RPC — it only validates the token exists and
 * renders a "Confirm" button. This prevents email scanners (Safe Links,
 * Proofpoint) from auto-confirming subscriptions by following the link.
 *
 * The actual confirmation happens via a server action triggered by the button.
 */
export default async function NewsletterConfirmPage({ params }: Props) {
  const { token } = await params

  if (!token || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    const c = pickCopy(null)
    return (
      <ConfirmLayout
        state="invalid"
        title={c.invalid_title}
        body={c.invalid_body}
        backLabel={c.back_home}
        locale="pt-BR"
      />
    )
  }

  // Validate the token exists without calling the confirm RPC.
  // This lets us show the right locale and detect invalid/expired tokens early.
  let locale: string | null = null
  let tokenExists = false

  try {
    const supabase = getSupabaseServiceClient()
    const tokenHash = createHash('sha256').update(token).digest('hex')

    const { data: row } = await supabase
      .from('newsletter_subscriptions')
      .select('locale, status, confirmation_expires_at')
      .eq('confirmation_token_hash', tokenHash)
      .maybeSingle()

    if (row) {
      tokenExists = true
      locale = (row.locale as string | null) ?? null

      // Already confirmed — show immediately (no button needed)
      if (row.status === 'confirmed') {
        const c = pickCopy(locale)
        const lang = locale === 'en' ? 'en' : 'pt-BR'
        return (
          <ConfirmLayout
            state="already"
            title={c.already_title}
            body={c.already_body}
            backLabel={c.back_home}
            lang={lang}
            locale={lang}
            signoff={c.already_signoff}
          />
        )
      }

      // Token expired — show immediately
      const expiresAt = row.confirmation_expires_at
        ? new Date(row.confirmation_expires_at as string)
        : null
      if (expiresAt && expiresAt < new Date()) {
        const c = pickCopy(locale)
        const lang = locale === 'en' ? 'en' : 'pt-BR'
        return (
          <ConfirmLayout
            state="expired"
            title={c.expired_title}
            body={c.expired_body}
            backLabel={c.back_home}
            lang={lang}
            locale={lang}
          />
        )
      }
    }
  } catch {
    // Best-effort token validation — if it fails, show the button anyway.
    // The server action will return the proper error.
    tokenExists = true
  }

  const c = pickCopy(locale)
  const lang = locale === 'en' ? 'en' : 'pt-BR'

  // Token not found — show error immediately
  if (!tokenExists) {
    return (
      <ConfirmLayout
        state="not_found"
        title={c.not_found_title}
        body={c.not_found_body}
        backLabel={c.back_home}
        lang={lang}
        locale={lang}
      />
    )
  }

  // ── Two-step: render confirm prompt ────────────────────────────────────
  // The ConfirmFlow client component handles the button click and
  // renders the result inline after the server action completes.
  const flowCopy: ConfirmCopy = {
    confirm_button: c.confirm_button,
    confirm_pending: c.confirm_pending,
    confirm_body: c.confirm_body,
    rpc_error_title: c.rpc_error_title,
    rpc_error_body: c.rpc_error_body,
    not_found_title: c.not_found_title,
    not_found_body: c.not_found_body,
    expired_title: c.expired_title,
    expired_body: c.expired_body,
    invalid_state_title: c.invalid_state_title,
    invalid_state_body: c.invalid_state_body,
    already_title: c.already_title,
    already_body: c.already_body,
    already_signoff: c.already_signoff,
    ok_title: c.ok_title,
    ok_body: c.ok_body,
    ok_body_continuation: c.ok_body_continuation,
    ok_signoff: c.ok_signoff,
    go_to_site: c.go_to_site,
    read_latest: c.read_latest,
    back_home: c.back_home,
    subscribed_to: c.subscribed_to,
  }

  return (
    <ConfirmLayout
      state="prompt"
      title={c.confirm_title}
      body=""
      backLabel={c.back_home}
      lang={lang}
      locale={lang}
    >
      <ConfirmFlow token={token} copy={flowCopy} locale={lang} />
    </ConfirmLayout>
  )
}

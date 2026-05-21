import React from 'react'
import { createHash } from 'node:crypto'
import type { Metadata } from 'next'
import { unsubscribeViaToken } from './actions'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'
import { UnsubscribeLayout } from './_layouts/unsubscribe-layout'

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
    ok_signoff: 'Sem ressentimentos. A porta fica aberta.',
    initial_title: 'Cancelar inscrição',
    initial_body:
      'Clique no botão abaixo para confirmar o cancelamento da sua inscrição na nossa newsletter.',
    initial_button: 'Cancelar minha inscrição',
    back_home: 'Ir para o site',
    manage: 'Gerenciar preferências',
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
    ok_signoff: 'No hard feelings. The door stays open.',
    initial_title: 'Unsubscribe',
    initial_body:
      'Click the button below to confirm unsubscribing from our newsletter.',
    initial_button: 'Unsubscribe me',
    back_home: 'Go to site',
    manage: 'Manage preferences',
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

/* ── Unsubscribe button style (kept here — used only by the form in this page) */
const unsubBtnStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 24px',
  border: '1.5px solid #C14513',
  borderRadius: 4,
  background: 'transparent',
  color: '#C14513',
  fontFamily: 'var(--font-inter-var), var(--font-jetbrains-var), sans-serif',
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: '0.01em',
  cursor: 'pointer',
  transition: 'background 0.15s ease, color 0.15s ease',
  textDecoration: 'none',
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default async function UnsubscribePage({ params, searchParams }: Props) {
  const { token } = await params
  const { confirmed } = await searchParams

  if (!token || typeof token !== 'string') {
    const c = pickCopy(null)
    return (
      <UnsubscribeLayout
        state="invalid"
        title={c.invalid_title}
        body={c.invalid_body}
        backLabel={c.back_home}
        locale="pt-BR"
        lang="pt-BR"
      />
    )
  }

  const locale = await lookupLocale(token)
  const c = pickCopy(locale)
  const lang = locale === 'en' ? 'en' : 'pt-BR'

  // Validate the confirmed param against known states to prevent arbitrary values
  // from falling through to the success/ok state without an actual unsubscribe.
  const VALID_STATUSES = new Set(['ok', 'already', 'not_found', 'error'])
  const validatedConfirmed =
    typeof confirmed === 'string' && VALID_STATUSES.has(confirmed) ? confirmed : null

  // If the user already confirmed via POST we render the result.
  if (validatedConfirmed) {
    const confirmed = validatedConfirmed
    if (confirmed === 'not_found') {
      return (
        <UnsubscribeLayout
          state="not_found"
          title={c.not_found_title}
          body={c.not_found_body}
          backLabel={c.back_home}
          lang={lang}
          locale={lang}
        />
      )
    }
    if (confirmed === 'error') {
      return (
        <UnsubscribeLayout
          state="error"
          title={c.error_title}
          body={c.error_body}
          backLabel={c.back_home}
          lang={lang}
          locale={lang}
        />
      )
    }
    if (confirmed === 'already') {
      return (
        <UnsubscribeLayout
          state="already"
          title={c.already_title}
          body={c.already_body}
          backLabel={c.back_home}
          manageLabel={c.manage}
          lang={lang}
          locale={lang}
        />
      )
    }
    // confirmed === 'ok'
    return (
      <UnsubscribeLayout
        state="ok"
        title={c.ok_title}
        body={c.ok_body}
        signoff={c.ok_signoff}
        backLabel={c.back_home}
        manageLabel={c.manage}
        lang={lang}
        locale={lang}
      />
    )
  }

  // Initial GET — just render a confirmation button. No side effects yet.
  // Email prefetchers / link scanners that issue GETs will not mark the token as used.
  return (
    <UnsubscribeLayout
      state="initial"
      title={c.initial_title}
      body={c.initial_body}
      backLabel={c.back_home}
      lang={lang}
      locale={lang}
      form={
        <form
          action={async () => {
            'use server'
            await confirmUnsubscribe(token)
          }}
          style={{ marginBottom: 28 }}
        >
          <button type="submit" className="unsub-btn" style={unsubBtnStyle}>
            {c.initial_button}
          </button>
        </form>
      }
    />
  )
}

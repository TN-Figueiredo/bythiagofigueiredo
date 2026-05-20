import { createHash } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { captureServerActionError } from '../../../../lib/sentry-wrap'

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
    back_home: 'Voltar ao início',
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
    back_home: 'Back to home',
  },
} as const

type Locale = keyof typeof COPY
function pickCopy(locale: string | null | undefined) {
  return COPY[(locale && locale in COPY ? locale : 'pt-BR') as Locale]
}

/* ── State visual config ─────────────────────────────────────────────────── */

type StateKind = 'success' | 'already' | 'expired' | 'not_found' | 'error' | 'invalid'

const STATE_CONFIG: Record<StateKind, { accent: string; icon: string }> = {
  success:   { accent: '#4CAF50', icon: '✔' },  // check mark
  already:   { accent: 'var(--pb-accent, #FF8240)', icon: 'ℹ' },  // info
  expired:   { accent: '#E5A100', icon: '⏳' },  // hourglass
  not_found: { accent: 'var(--pb-muted, #958A75)', icon: '⁇' },  // question
  error:     { accent: '#C14513', icon: '⚠' },   // warning
  invalid:   { accent: '#C14513', icon: '✕' },   // x mark
}

/* ── Shared inline styles ────────────────────────────────────────────────── */

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
    background: 'var(--pb-bg, #1A1714)',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    textAlign: 'center' as const,
  },
  accentLine: (color: string) => ({
    width: 48,
    height: 3,
    borderRadius: 2,
    background: color,
    margin: '0 auto 28px',
  }),
  icon: (color: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: '50%',
    border: `2px solid ${color}`,
    fontSize: 24,
    lineHeight: 1,
    marginBottom: 20,
    color,
  }),
  title: {
    fontFamily: 'var(--font-fraunces-var), serif',
    fontSize: 28,
    fontWeight: 600,
    color: 'var(--pb-ink, #F5EFE6)',
    margin: '0 0 12px',
    lineHeight: 1.2,
  },
  body: {
    fontFamily: 'var(--font-jetbrains-var), monospace',
    fontSize: 14,
    lineHeight: 1.7,
    color: 'var(--pb-muted, #958A75)',
    margin: '0 0 32px',
    maxWidth: 420,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  divider: {
    width: 32,
    height: 1,
    background: 'var(--pb-line, #332D25)',
    margin: '0 auto 20px',
    border: 'none',
  },
  homeLink: {
    fontFamily: 'var(--font-jetbrains-var), monospace',
    fontSize: 12,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    color: 'var(--pb-muted, #958A75)',
    textDecoration: 'none',
    borderBottom: '1px dashed var(--pb-line, #332D25)',
    paddingBottom: 2,
    transition: 'color 0.15s ease, border-color 0.15s ease',
  },
} as const

function ConfirmLayout({
  state,
  title,
  body,
  backLabel,
}: {
  state: StateKind
  title: string
  body: string
  backLabel: string
}) {
  const { accent, icon } = STATE_CONFIG[state]
  return (
    <main style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.icon(accent)} role="img" aria-hidden="true">
          {icon}
        </div>
        <div style={styles.accentLine(accent)} />
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.body}>{body}</p>
        <hr style={styles.divider} />
        <a href="/" style={styles.homeLink}>
          {backLabel}
        </a>
      </div>
    </main>
  )
}

export default async function NewsletterConfirmPage({ params }: Props) {
  const { token } = await params

  if (!token || typeof token !== 'string') {
    const c = pickCopy(null)
    return (
      <ConfirmLayout
        state="invalid"
        title={c.invalid_title}
        body={c.invalid_body}
        backLabel={c.back_home}
      />
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
    if (rpcError) {
      captureServerActionError(rpcError, { action: 'confirm_newsletter' })
    }
    return (
      <ConfirmLayout
        state="error"
        title={c.rpc_error_title}
        body={c.rpc_error_body}
        backLabel={c.back_home}
      />
    )
  }

  if (!result.ok) {
    if (result.error === 'not_found') {
      return (
        <ConfirmLayout
          state="not_found"
          title={c.not_found_title}
          body={c.not_found_body}
          backLabel={c.back_home}
        />
      )
    }
    if (result.error === 'expired') {
      return (
        <ConfirmLayout
          state="expired"
          title={c.expired_title}
          body={c.expired_body}
          backLabel={c.back_home}
        />
      )
    }
    // invalid_state or unknown
    return (
      <ConfirmLayout
        state="error"
        title={c.invalid_state_title}
        body={c.invalid_state_body}
        backLabel={c.back_home}
      />
    )
  }

  if (result.already) {
    return (
      <ConfirmLayout
        state="already"
        title={c.already_title}
        body={c.already_body}
        backLabel={c.back_home}
      />
    )
  }

  // Subscriber count changed — invalidate cross-promotion suggestion cache
  revalidateTag('newsletter-suggestions')

  return (
    <ConfirmLayout
      state="success"
      title={c.ok_title}
      body={c.ok_body}
      backLabel={c.back_home}
    />
  )
}

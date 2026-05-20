import type { Metadata } from 'next'
import { createHash } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { after } from 'next/server'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { captureServerActionError } from '../../../../lib/sentry-wrap'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

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

interface NlType {
  name: string
  tagline: string | null
  color: string
  colorDark: string | null
  cadenceLabel: string | null
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
      'Seu email já estava confirmado. Você continuará recebendo as edições das suas newsletters.',
    ok_title: 'Inscrição confirmada!',
    ok_body:
      'Obrigado por confirmar seu email. Você receberá as próximas edições das newsletters abaixo.',
    back_home: 'Voltar ao início',
    subscribed_to: 'Suas newsletters:',
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
      'Your email was already confirmed. You will continue receiving editions of your newsletters.',
    ok_title: 'Subscription confirmed!',
    ok_body:
      'Thank you for confirming your email. You will receive upcoming editions of the newsletters below.',
    back_home: 'Back to home',
    subscribed_to: 'Your newsletters:',
  },
} as const

type Locale = keyof typeof COPY
function pickCopy(locale: string | null | undefined) {
  return COPY[(locale && locale in COPY ? locale : 'pt-BR') as Locale]
}

/* ── State visual config ─────────────────────────────────────────────────── */

type StateKind = 'success' | 'already' | 'expired' | 'not_found' | 'error' | 'invalid'

const STATE_CONFIG: Record<StateKind, { accent: string; icon: string; shimmer: boolean }> = {
  success:   { accent: '#4CAF50', icon: '✔', shimmer: true },
  already:   { accent: '#FF8240', icon: 'ℹ', shimmer: false },
  expired:   { accent: '#E5A100', icon: '⏳', shimmer: false },
  not_found: { accent: '#958A75', icon: '⁇', shimmer: false },
  error:     { accent: '#C14513', icon: '⚠', shimmer: false },
  invalid:   { accent: '#C14513', icon: '✕', shimmer: false },
}

/* ── Newsletter list query ───────────────────────────────────────────────── */

async function getSubscribedTypes(siteId: string, email: string): Promise<NlType[]> {
  try {
    const supabase = getSupabaseServiceClient()
    const { data: subs } = await supabase
      .from('newsletter_subscriptions')
      .select('newsletter_id')
      .eq('site_id', siteId)
      .eq('email', email)
      .eq('status', 'confirmed')

    if (!subs?.length) return []

    const typeIds = subs.map((s) => s.newsletter_id)
    const { data: types } = await supabase
      .from('newsletter_types')
      .select('name, tagline, color, color_dark, cadence_label')
      .in('id', typeIds)
      .eq('active', true)
      .order('sort_order')

    return (types ?? []).map((t) => ({
      name: t.name as string,
      tagline: t.tagline as string | null,
      color: (t.color as string | null) ?? '#FF8240',
      colorDark: t.color_dark as string | null,
      cadenceLabel: t.cadence_label as string | null,
    }))
  } catch {
    return []
  }
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function localePath(locale: string | undefined): string {
  return locale === 'pt-BR' ? '/pt' : '/'
}

/* ── Shared layout component ─────────────────────────────────────────────── */

function ConfirmLayout({
  state,
  title,
  body,
  backLabel,
  lang,
  locale,
  newsletters,
  subscribedToLabel,
}: {
  state: StateKind
  title: string
  body: string
  backLabel: string
  lang?: string
  locale?: string
  newsletters?: NlType[]
  subscribedToLabel?: string
}) {
  const { accent, icon, shimmer } = STATE_CONFIG[state]
  const showNewsletter = (state === 'success' || state === 'already') && newsletters && newsletters.length > 0

  return (
    <main
      lang={lang}
      className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-[var(--pb-bg)]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
      }}
    >
      {/* TF Monogram — outside card */}
      <div className="mb-6 flex flex-col items-center">
        <span
          className="inline-flex items-baseline font-source-serif select-none"
          style={{ letterSpacing: '-0.08em', fontSize: 56 }}
          role="img"
          aria-label="TF"
        >
          <span style={{ fontWeight: 500, lineHeight: 1, color: 'var(--pb-ink)' }}>T</span>
          <span style={{ fontWeight: 500, fontStyle: 'italic', lineHeight: 1, color: 'var(--pb-accent)', opacity: 0.95 }}>F</span>
        </span>
      </div>

      {/* Card */}
      <div
        className="w-full overflow-hidden rounded-md"
        style={{
          maxWidth: 680,
          background: 'var(--pb-paper)',
          boxShadow: 'var(--pb-shadow-card)',
        }}
      >
        {/* Top stripe */}
        {shimmer ? (
          <div
            aria-hidden="true"
            className="h-1 w-full"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${accent} 30%, #7FD98A 60%, ${accent} 80%, transparent 100%)`,
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s ease-in-out infinite',
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            className="h-1 w-full"
            style={{ background: accent, opacity: 0.7 }}
          />
        )}

        {/* Card body */}
        <div className="px-8 py-12 sm:px-14 sm:py-14 text-center">
          {/* State icon */}
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
            style={{ border: `2px solid ${accent}`, color: accent, fontSize: 24, lineHeight: 1 }}
            role="img"
            aria-hidden="true"
          >
            {icon}
          </div>

          {/* Title */}
          <h1
            className="font-fraunces font-semibold m-0 mb-3 leading-tight"
            style={{
              fontSize: 'clamp(28px, 5vw, 34px)',
              color: 'var(--pb-ink)',
            }}
          >
            {title}
          </h1>

          {/* Body */}
          <p
            className="font-jetbrains text-sm leading-[1.7] mb-8 mx-auto"
            style={{
              maxWidth: 420,
              color: 'var(--pb-muted)',
            }}
          >
            {body}
          </p>

          {/* Newsletter list */}
          {showNewsletter && (
            <div className="mb-8 text-left">
              <p
                className="font-jetbrains text-xs uppercase tracking-widest mb-3"
                style={{ color: 'var(--pb-muted)', letterSpacing: '0.1em' }}
              >
                {subscribedToLabel}
              </p>
              <ul className="space-y-2 list-none p-0 m-0">
                {newsletters!.map((nl) => (
                  <li
                    key={nl.name}
                    className="px-4 py-3 rounded-sm"
                    style={{
                      borderLeft: `3px solid ${nl.color}`,
                      background: 'var(--pb-paper2, rgba(255,255,255,0.03))',
                    }}
                  >
                    <span
                      className="font-fraunces font-medium block text-sm"
                      style={{ color: 'var(--pb-ink)' }}
                    >
                      {nl.name}
                    </span>
                    {nl.tagline && (
                      <span
                        className="font-jetbrains text-xs block mt-0.5"
                        style={{ color: 'var(--pb-muted)' }}
                      >
                        {nl.tagline}
                        {nl.cadenceLabel && (
                          <span style={{ opacity: 0.6 }}> · {nl.cadenceLabel}</span>
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Divider */}
          <hr
            className="border-none mx-auto mb-5"
            style={{
              width: 32,
              height: 1,
              background: 'var(--pb-line)',
            }}
          />

          {/* Home link */}
          <a
            href={localePath(locale)}
            className="font-jetbrains text-xs uppercase tracking-widest pb-0.5 transition-colors duration-150"
            style={{
              color: 'var(--pb-muted)',
              textDecoration: 'none',
              borderBottom: '1px dashed var(--pb-line)',
              letterSpacing: '0.05em',
            }}
          >
            {backLabel}
          </a>
        </div>
      </div>

      {/* End mark — outside card */}
      <div
        className="mt-8 flex items-center gap-3"
        aria-hidden="true"
      >
        <span className="block h-px w-10" style={{ background: 'var(--pb-line)' }} />
        <span className="font-source-serif text-base" style={{ color: 'var(--pb-muted)', opacity: 0.5 }}>❦</span>
        <span className="block h-px w-10" style={{ background: 'var(--pb-line)' }} />
      </div>

      {/* Signature — outside card */}
      <div className="mt-4 text-center">
        <p
          className="font-jetbrains text-xs"
          style={{ color: 'var(--pb-muted)', opacity: 0.5 }}
        >
          tf ❦ Thiago Figueiredo
        </p>
        <a
          href="https://bythiagofigueiredo.com"
          className="font-jetbrains text-xs"
          style={{ color: 'var(--pb-muted)', opacity: 0.4, textDecoration: 'none' }}
          tabIndex={-1}
          aria-hidden="true"
        >
          bythiagofigueiredo.com
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
        locale="pt-BR"
      />
    )
  }

  try {
    const supabase = getSupabaseServiceClient()
    const tokenHash = createHash('sha256').update(token).digest('hex')

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

    const result = (data ?? null) as ConfirmRpcResult | null

    if (!locale && result?.email && result.site_id) {
      try {
        const { data: row2 } = await supabase
          .from('newsletter_subscriptions')
          .select('locale')
          .eq('site_id', result.site_id)
          .eq('email', result.email)
          .limit(1)
          .maybeSingle()
        locale = (row2?.locale as string | null) ?? null
      } catch {
        /* best-effort */
      }
    }

    const c = pickCopy(locale)
    const lang = locale === 'en' ? 'en' : 'pt-BR'

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
          lang={lang}
          locale={lang}
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
            lang={lang}
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
            lang={lang}
          />
        )
      }
      return (
        <ConfirmLayout
          state="error"
          title={c.invalid_state_title}
          body={c.invalid_state_body}
          backLabel={c.back_home}
          lang={lang}
          locale={lang}
        />
      )
    }

    if (result.already) {
      const newsletters =
        result.site_id && result.email
          ? await getSubscribedTypes(result.site_id, result.email)
          : []

      return (
        <ConfirmLayout
          state="already"
          title={c.already_title}
          body={c.already_body}
          backLabel={c.back_home}
          lang={lang}
          locale={lang}
          newsletters={newsletters}
          subscribedToLabel={c.subscribed_to}
        />
      )
    }

    after(() => revalidateTag('newsletter-suggestions'))

    const newsletters =
      result.site_id && result.email
        ? await getSubscribedTypes(result.site_id, result.email)
        : []

    return (
      <ConfirmLayout
        state="success"
        title={c.ok_title}
        body={c.ok_body}
        backLabel={c.back_home}
        lang={lang}
        newsletters={newsletters}
        subscribedToLabel={c.subscribed_to}
      />
    )
  } catch (err) {
    captureServerActionError(err, { action: 'confirm_newsletter', branch: 'outer_catch' })
    const c = pickCopy(null)
    return (
      <ConfirmLayout
        state="error"
        title={c.rpc_error_title}
        body={c.rpc_error_body}
        backLabel={c.back_home}
        locale="pt-BR"
      />
    )
  }
}

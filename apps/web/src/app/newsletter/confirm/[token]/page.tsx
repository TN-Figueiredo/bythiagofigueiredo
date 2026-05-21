import type { Metadata } from 'next'
import { createHash } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { after } from 'next/server'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { deriveCadenceLabel } from '../../../../../lib/newsletter/format'
import { captureServerActionError } from '../../../../lib/sentry-wrap'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

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
    ok_body: 'Você agora faz parte de:',
    ok_body_continuation: 'A próxima edição de cada uma vai direto para o seu email.',
    ok_signoff: 'Obrigado por estar aqui.',
    already_signoff: 'Obrigado por estar aqui.',
    go_to_site: 'Ir para o site',
    read_latest: 'Ou leia o último artigo →',
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
    ok_body: 'You are now part of:',
    ok_body_continuation: 'The next edition of each will go straight to your inbox.',
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

/* ── State visual config ─────────────────────────────────────────────────── */

type StateKind = 'success' | 'already' | 'expired' | 'not_found' | 'error' | 'invalid'

const STATE_CONFIG: Record<StateKind, { accent: string; icon: string; shimmer: boolean }> = {
  success:   { accent: '#FF8240', icon: '❦', shimmer: true },
  already:   { accent: '#FF8240', icon: '❦', shimmer: false },
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
      .select('name, tagline, color, color_dark, cadence_label, cadence_days, cadence_start_date, locale')
      .in('id', typeIds)
      .eq('active', true)
      .order('sort_order')

    return (types ?? []).map((t) => {
      const typeLocale = (t.locale as string) === 'pt-BR' ? 'pt-BR' : 'en'
      return {
        name: t.name as string,
        tagline: t.tagline as string | null,
        color: (t.color as string | null) ?? '#FF8240',
        colorDark: t.color_dark as string | null,
        cadenceLabel: deriveCadenceLabel(
          t.cadence_label as string | null,
          t.cadence_days as number,
          typeLocale,
          t.cadence_start_date as string | null,
        ),
      }
    })
  } catch {
    return []
  }
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function localePath(locale: string | undefined): string {
  return locale === 'pt-BR' ? '/pt/' : '/'
}

/* ── Shared layout component ─────────────────────────────────────────────── */

function ConfirmLayout({
  state,
  title,
  body,
  bodyContinuation,
  backLabel,
  lang,
  locale,
  newsletters,
  subscribedToLabel,
  signoff,
  showCta,
  ctaLabel,
  readLatestLabel,
}: {
  state: StateKind
  title: string
  body: string
  bodyContinuation?: string
  backLabel: string
  lang?: string
  locale?: string
  newsletters?: NlType[]
  subscribedToLabel?: string
  signoff?: string
  showCta?: boolean
  ctaLabel?: string
  readLatestLabel?: string
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
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
        @media (max-width: 560px) {
          .confirm-card-body { padding: 36px 28px 32px !important; }
          .confirm-title { font-size: 26px !important; }
          .confirm-monogram { font-size: 38px !important; margin-bottom: 24px !important; }
          .confirm-fleuron { font-size: 32px !important; margin-bottom: 24px !important; }
        }
        .confirm-cta:hover { background: var(--pb-accent-deep, #e06d2a) !important; transform: translateY(-1px); }
        .confirm-cta:focus-visible { outline: 2px solid var(--pb-accent); outline-offset: 3px; }
      `}</style>

      {/* Page wrapper — constrains all content to 520px */}
      <div style={{ maxWidth: 520, width: '100%' }}>

        {/* TF Monogram — outside card */}
        <div className="flex justify-center" style={{ marginBottom: 32, animation: 'fadeIn 0.5s ease-out' }}>
          <span
            className="confirm-monogram font-source-serif select-none"
            style={{ fontSize: 44, fontWeight: 500, letterSpacing: '-4px', lineHeight: 1, color: 'var(--pb-ink)', whiteSpace: 'nowrap' }}
            role="img"
            aria-label="TF"
          >
            T<span style={{ fontStyle: 'italic', color: 'var(--pb-accent)' }}>F</span><span style={{ fontSize: 8, color: 'var(--pb-ink)', verticalAlign: 'middle', marginLeft: 2 }}>●</span>
          </span>
        </div>

        {/* Card */}
        <div
          className="w-full overflow-hidden rounded-md"
          style={{
            maxWidth: 520,
            background: 'var(--pb-paper)',
            boxShadow: 'var(--pb-shadow-card)',
            animation: 'fadeUp 0.6s ease-out both',
            animationDelay: '0.15s',
          }}
        >
          {/* Top stripe */}
          {shimmer ? (
            <div
              aria-hidden="true"
              className="w-full"
              style={{
                height: 4,
                background: `linear-gradient(90deg, transparent 0%, ${accent} 25%, #FFB380 50%, ${accent} 75%, transparent 100%)`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s ease-in-out infinite',
              }}
            />
          ) : (
            <div
              aria-hidden="true"
              className="w-full"
              style={{ height: 4, background: accent, opacity: 0.7 }}
            />
          )}

          {/* Card body */}
          <div className="confirm-card-body text-center" style={{ padding: '48px 48px 44px' }}>
            {/* State icon */}
            {(state === 'success' || state === 'already') ? (
              <div
                className="confirm-fleuron font-source-serif mb-7"
                style={{
                  fontSize: 40,
                  color: accent,
                  lineHeight: 1,
                  animation: 'fadeIn 0.4s ease-out both',
                  animationDelay: '0.45s',
                }}
                role="img"
                aria-hidden="true"
              >
                {icon}
              </div>
            ) : (
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
                style={{
                  border: `2px solid ${accent}`,
                  color: accent,
                  fontSize: 24,
                  lineHeight: 1,
                  animation: 'fadeIn 0.4s ease-out both',
                  animationDelay: '0.45s',
                }}
                role="img"
                aria-hidden="true"
              >
                {icon}
              </div>
            )}

            {/* Title */}
            <h1
              className="confirm-title font-fraunces font-medium m-0 mb-4"
              style={{
                fontSize: 'clamp(26px, 5vw, 30px)',
                color: 'var(--pb-ink)',
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
              }}
            >
              {title}
            </h1>

            {/* Body */}
            <p
              className="font-source-serif leading-[1.65] mx-auto"
              style={{
                fontSize: 17,
                maxWidth: 420,
                color: 'var(--pb-muted)',
                marginBottom: 0,
              }}
            >
              {body}
            </p>

            {/* Newsletter list */}
            {showNewsletter && (
              <div className="text-left" style={{ margin: '20px 0 4px' }}>
                <ul className="list-none p-0 m-0" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {newsletters!.map((nl) => (
                    <li
                      key={nl.name}
                      style={{
                        borderLeft: `3px solid ${nl.color}`,
                        padding: '10px 0 10px 16px',
                      }}
                    >
                      <span
                        className="font-fraunces font-medium block"
                        style={{ fontSize: 16, color: 'var(--pb-ink)', lineHeight: 1.3, letterSpacing: '-0.01em', marginBottom: 2 }}
                      >
                        {nl.name}
                      </span>
                      {nl.tagline && (
                        <span
                          className="font-inter block mt-0.5"
                          style={{ fontSize: 12, color: 'var(--pb-faint)', letterSpacing: '0.02em' }}
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

            {/* Body continuation */}
            {bodyContinuation && (
              <p
                className="font-source-serif leading-[1.65] mx-auto"
                style={{
                  fontSize: 17,
                  maxWidth: 420,
                  color: 'var(--pb-muted)',
                  marginTop: 20,
                  marginBottom: 0,
                }}
              >
                {bodyContinuation}
              </p>
            )}

            {/* Sign-off */}
            {signoff && (
              <>
                <p
                  className="font-source-serif leading-[1.6]"
                  style={{ fontSize: 16, color: 'var(--pb-muted)', marginTop: 20, marginBottom: 0 }}
                >
                  {signoff}
                  <br />
                  — Thiago
                </p>
              </>
            )}

            {/* Divider */}
            <hr
              className="border-none"
              style={{
                width: '100%',
                height: 1,
                background: 'var(--pb-line)',
                margin: '32px 0',
              }}
            />

            {/* CTA — success state */}
            {showCta ? (
              <>
                <a
                  href={localePath(locale)}
                  className="confirm-cta inline-block font-inter font-semibold no-underline transition-all duration-150"
                  style={{
                    background: 'var(--pb-accent)',
                    color: '#1F1B17',
                    letterSpacing: '0.01em',
                    padding: '15px 40px',
                    borderRadius: 4,
                    fontSize: 15,
                  }}
                >
                  {ctaLabel}
                </a>
                <a
                  href={`${localePath(locale)}blog`}
                  className="block font-inter font-medium no-underline"
                  style={{ color: 'var(--pb-accent)', fontSize: 13, marginTop: 20, letterSpacing: '0.01em' }}
                >
                  {readLatestLabel}
                </a>
              </>
            ) : (
              <a
                href={localePath(locale)}
                className="font-inter no-underline"
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--pb-faint)',
                }}
              >
                {backLabel}
              </a>
            )}

            {/* End mark — inside card */}
            <div className="flex items-center justify-center" style={{ marginTop: 36, gap: 14 }} aria-hidden="true">
              <span className="block" style={{ width: 36, height: 1, background: 'var(--pb-line)' }} />
              <span className="font-source-serif" style={{ fontSize: 16, color: 'var(--pb-accent)', lineHeight: 1 }}>❦</span>
              <span className="block" style={{ width: 36, height: 1, background: 'var(--pb-line)' }} />
            </div>

            {/* Signature — inside card */}
            <div className="mt-4 text-center">
              <p className="font-source-serif" style={{ fontSize: 13, color: 'var(--pb-faint)', lineHeight: 1.4, margin: 0 }}>
                <span style={{ fontStyle: 'italic', fontWeight: 300, opacity: 0.7 }}>tf</span>
                {' '}
                <span style={{ color: 'var(--pb-accent)' }}>❦</span>
                {' '}
                <span style={{ fontWeight: 500 }}>Thiago Figueiredo</span>
              </p>
              <p className="font-inter" style={{ fontSize: 11, color: 'var(--pb-faint)', marginTop: 2, letterSpacing: '0.02em' }}>
                <a
                  href="https://bythiagofigueiredo.com"
                  style={{ color: 'var(--pb-faint)', textDecoration: 'none' }}
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  bythiagofigueiredo.com
                </a>
              </p>
            </div>

          </div>
        </div>

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
            locale={lang}
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
            locale={lang}
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
          signoff={c.already_signoff}
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
        bodyContinuation={c.ok_body_continuation}
        backLabel={c.back_home}
        lang={lang}
        locale={lang}
        newsletters={newsletters}
        subscribedToLabel={c.subscribed_to}
        signoff={c.ok_signoff}
        showCta
        ctaLabel={c.go_to_site}
        readLatestLabel={c.read_latest}
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

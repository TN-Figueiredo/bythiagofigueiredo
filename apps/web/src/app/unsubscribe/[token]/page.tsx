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

/* ── State visual config ─────────────────────────────────────────────────── */

type StateKind = 'initial' | 'ok' | 'already' | 'not_found' | 'error' | 'invalid'

const STATE_CONFIG: Record<StateKind, { accent: string; icon: string }> = {
  initial:   { accent: '#958A75', icon: '❦' },
  ok:        { accent: '#958A75', icon: '❦' },
  already:   { accent: '#FF8240', icon: 'ℹ' },
  not_found: { accent: '#958A75', icon: '⁇' },
  error:     { accent: '#C14513', icon: '⚠' },
  invalid:   { accent: '#C14513', icon: '✕' },
}

/* ── Shared inline styles ────────────────────────────────────────────────── */

const s = {
  /* Full-page wrapper with grain texture via SVG filter */
  outer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px 56px',
    background: 'var(--pb-bg, #1A1714)',
    position: 'relative' as const,
    isolation: 'isolate' as const,
  } as React.CSSProperties,

  /* Grain SVG noise overlay (same approach as confirm page) */
  grain: {
    position: 'absolute' as const,
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none' as const,
    opacity: 0.35,
  } as React.CSSProperties,

  /* Content column — everything sits above the grain */
  column: {
    position: 'relative' as const,
    zIndex: 1,
    width: '100%',
    maxWidth: 680,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 0,
  } as React.CSSProperties,

  /* Monogram above the card */
  monogramWrap: {
    marginBottom: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  monogramBox: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    border: '1.5px solid var(--pb-line, #332D25)',
    background: 'var(--pb-paper, #221E1A)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  } as React.CSSProperties,

  monogramText: {
    fontFamily: 'var(--font-source-serif-var), serif',
    fontSize: 22,
    fontWeight: 500,
    letterSpacing: '-0.06em',
    lineHeight: 1,
    color: 'var(--pb-ink, #F5EFE6)',
  } as React.CSSProperties,

  monogramItalic: {
    fontStyle: 'italic',
    color: 'var(--pb-muted, #958A75)',
  } as React.CSSProperties,

  /* Main card */
  card: {
    width: '100%',
    background: 'var(--pb-paper, #221E1A)',
    borderRadius: 6,
    boxShadow: 'var(--pb-shadow-card, 0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03))',
    overflow: 'hidden',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  /* Muted top stripe (departure theme — always var(--pb-line)) */
  stripe: {
    height: 3,
    background: 'var(--pb-line, #332D25)',
    borderRadius: '6px 6px 0 0',
  } as React.CSSProperties,

  /* Card inner padding */
  cardInner: {
    padding: '40px 40px 44px',
  } as React.CSSProperties,

  /* Farewell fleuron icon */
  iconWrap: (color: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: '50%',
    border: `1.5px solid ${color}`,
    fontSize: 22,
    lineHeight: 1,
    marginBottom: 24,
    color,
    opacity: 0.75,
  } as React.CSSProperties),

  /* Divider line inside icon area */
  iconDivider: (color: string) => ({
    width: 32,
    height: 1,
    background: color,
    margin: '0 auto 24px',
    opacity: 0.3,
  } as React.CSSProperties),

  title: {
    fontFamily: 'var(--font-fraunces-var), serif',
    fontSize: 28,
    fontWeight: 600,
    color: 'var(--pb-ink, #F5EFE6)',
    margin: '0 0 14px',
    lineHeight: 1.2,
  } as React.CSSProperties,

  body: {
    fontFamily: 'var(--font-source-serif-var), serif',
    fontSize: 17,
    lineHeight: 1.7,
    color: 'var(--pb-muted, #958A75)',
    margin: '0 0 28px',
    maxWidth: 480,
    marginLeft: 'auto',
    marginRight: 'auto',
  } as React.CSSProperties,

  /* Sign-off (ok state only) */
  signoff: {
    fontFamily: 'var(--font-source-serif-var), serif',
    fontSize: 15,
    fontStyle: 'italic' as const,
    color: 'var(--pb-faint, #928871)',
    margin: '0 0 28px',
    lineHeight: 1.5,
  } as React.CSSProperties,

  /* Outlined (departure) unsubscribe button */
  unsubBtn: {
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
  } as React.CSSProperties,

  /* Card divider before home link */
  cardDivider: {
    width: '100%',
    height: 1,
    background: 'var(--pb-line, #332D25)',
    border: 'none',
    margin: '0 0 24px',
  } as React.CSSProperties,

  /* Home link */
  homeLink: {
    fontFamily: 'var(--font-jetbrains-var), monospace',
    fontSize: 12,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--pb-muted, #958A75)',
    textDecoration: 'none',
    borderBottom: '1px dashed var(--pb-line, #332D25)',
    paddingBottom: 2,
  } as React.CSSProperties,

  homeLinkArrow: {
    marginLeft: 4,
  } as React.CSSProperties,

  /* End mark + signature below the card */
  endMark: {
    marginTop: 36,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,

  endLine: {
    width: 40,
    height: 1,
    background: 'var(--pb-line, #332D25)',
  } as React.CSSProperties,

  endFleuron: {
    fontFamily: 'serif',
    fontSize: 14,
    color: 'var(--pb-faint, #928871)',
    opacity: 0.5,
    lineHeight: 1,
  } as React.CSSProperties,

  signature: {
    fontFamily: 'var(--font-source-serif-var), serif',
    fontSize: 12,
    color: 'var(--pb-faint, #928871)',
    opacity: 0.6,
    letterSpacing: '0.02em',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  } as React.CSSProperties,

  sigMonogram: {
    fontWeight: 500,
    letterSpacing: '-0.04em',
  } as React.CSSProperties,
}

/* ── Responsive title (larger on desktop via media query simulation) ─────── */
// We use a style tag injection for the media query since inline styles can't do @media.
function ResponsiveStyles() {
  return (
    <style>{`
      @media (min-width: 640px) {
        .unsub-title { font-size: 34px !important; }
        .unsub-card-inner { padding: 48px 56px 52px !important; }
      }
    `}</style>
  )
}

/* ── Grain SVG (noise texture on bg) ────────────────────────────────────── */
function GrainOverlay() {
  return (
    <svg
      aria-hidden="true"
      style={s.grain}
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
    >
      <filter id="unsub-grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.65"
          numOctaves="3"
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#unsub-grain)" />
    </svg>
  )
}

/* ── Monogram ────────────────────────────────────────────────────────────── */
function Monogram() {
  return (
    <div style={s.monogramWrap} aria-hidden="true">
      <div style={s.monogramBox}>
        <span style={s.monogramText}>
          T<span style={s.monogramItalic}>F</span>
        </span>
      </div>
    </div>
  )
}

/* ── End mark + signature ────────────────────────────────────────────────── */
function EndMark() {
  return (
    <div style={s.endMark} aria-hidden="true">
      <div style={s.endLine} />
      <span style={s.endFleuron}>❦</span>
      <div style={s.endLine} />
      <span style={s.signature}>
        <span style={s.sigMonogram}>tf</span>
        <span style={{ opacity: 0.45 }}>❦</span>
        <span>Thiago Figueiredo</span>
      </span>
    </div>
  )
}

/* ── Layout component ────────────────────────────────────────────────────── */

import type React from 'react'

function localePath(locale: string | undefined): string {
  return locale === 'pt-BR' ? '/pt' : '/'
}

function UnsubscribeLayout({
  state,
  title,
  body,
  backLabel,
  lang,
  locale,
  signoff,
  form,
}: {
  state: StateKind
  title: string
  body: string
  backLabel: string
  lang?: string
  locale?: string
  signoff?: string
  form?: React.ReactNode
}) {
  const { accent, icon } = STATE_CONFIG[state]

  return (
    <main style={s.outer} lang={lang}>
      <ResponsiveStyles />
      <GrainOverlay />

      <div style={s.column}>
        <Monogram />

        <div style={s.card}>
          {/* Muted top stripe — departure theme, NOT orange */}
          <div style={s.stripe} />

          <div style={{ ...s.cardInner }} className="unsub-card-inner">
            {/* Farewell fleuron icon */}
            <div>
              <div style={s.iconWrap(accent)} role="img" aria-hidden="true">
                {icon}
              </div>
            </div>

            {/* Thin divider below icon */}
            <div style={s.iconDivider(accent)} />

            <h1 style={s.title} className="unsub-title">{title}</h1>
            <p style={s.body}>{body}</p>

            {/* Sign-off for ok state */}
            {signoff && (
              <p style={s.signoff}>
                {signoff}
                {' '}— Thiago
              </p>
            )}

            {/* Unsubscribe form (initial state only) */}
            {form}

            {/* Divider before home link */}
            <hr style={s.cardDivider} />

            <a href={localePath(locale)} style={s.homeLink}>
              {backLabel}
              <span style={s.homeLinkArrow}>→</span>
            </a>
          </div>
        </div>

        <EndMark />
      </div>
    </main>
  )
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

  // If the user already confirmed via POST we render the result.
  if (confirmed) {
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
          method="post"
          style={{ marginBottom: 28 }}
        >
          <button type="submit" style={s.unsubBtn}>
            {c.initial_button}
          </button>
        </form>
      }
    />
  )
}

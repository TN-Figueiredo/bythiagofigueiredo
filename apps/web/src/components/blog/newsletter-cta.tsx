'use client'

import { useActionState } from 'react'
import { subscribeNewsletterInline, type InlineState } from '@/app/(public)/actions/newsletter-inline'
import { Tape } from '@/app/(public)/components/Tape'

type Props = {
  category: string | null
  locale: string
  newsletterId?: string
}

const INITIAL: InlineState = {}

const CATEGORY_LABEL: Record<string, string> = {
  Ensaios: 'Caderno de Campo',
  Codigo: 'Code Drops',
  Bastidores: 'Behind the Screens',
}

const COPY = {
  'pt-BR': {
    headline: 'Gostou? Recebe os próximos na caixa de entrada.',
    success: 'Inscrição recebida! Verifique seu email para confirmar.',
    placeholder: 'seu@email.com',
    cta: (label: string) => `Assinar ${label}`,
    vanity: 'cancelar é um clique',
  },
  en: {
    headline: 'Liked it? Get the next ones in your inbox.',
    success: 'Subscription received! Check your email to confirm.',
    placeholder: 'you@email.com',
    cta: (label: string) => `Subscribe ${label}`,
    vanity: 'unsubscribe is one click',
  },
} as const

export function NewsletterCta({ category, locale, newsletterId }: Props) {
  const [state, dispatch, pending] = useActionState(subscribeNewsletterInline, INITIAL)
  const ctaLabel = category ? CATEGORY_LABEL[category] ?? 'Caderno de Campo' : 'Caderno de Campo'
  const c = COPY[locale === 'pt-BR' ? 'pt-BR' : 'en']

  return (
    <div className="blog-nl-cta">
      <Tape variant="tape" className="top-[-10px] left-[40%]" rotate={3} />

      <div className="blog-sidebar-label mb-2.5" style={{ opacity: 0.7 }}>
        Newsletter
      </div>
      <h3
        className="font-fraunces font-medium leading-[1.15] mb-4 max-w-[500px]"
        style={{ fontSize: 26, textWrap: 'balance' }}
      >
        {c.headline}
      </h3>

      {state.success ? (
        <p className="text-pb-accent font-jetbrains text-sm py-4">{c.success}</p>
      ) : (
        <form action={dispatch} className="flex gap-2 flex-wrap">
          {newsletterId && <input type="hidden" name="newsletter_id" value={newsletterId} />}
          <input type="hidden" name="locale" value={locale} />
          <input
            name="email"
            type="email"
            required
            placeholder={c.placeholder}
            aria-label="Email"
            className="flex-1 min-w-[200px] text-sm outline-none"
            style={{
              padding: '12px 14px',
              border: '1px solid #1A140C',
              background: '#FFFCEE',
              color: '#1A140C',
              fontFamily: '"Inter", var(--font-sans), sans-serif',
            }}
          />
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="border-none font-jetbrains text-[11px] font-semibold tracking-[0.14em] uppercase cursor-pointer whitespace-nowrap disabled:opacity-50"
            style={{
              padding: '12px 20px',
              background: '#1A140C',
              color: 'var(--pb-marker)',
            }}
          >
            {pending ? '...' : c.cta(ctaLabel)}
          </button>
          {state.error && <p className="text-pb-yt font-jetbrains text-xs w-full">{state.error}</p>}
        </form>
      )}
      <div className="text-[11px] mt-2.5 font-jetbrains" style={{ opacity: 0.65 }}>
        {c.vanity}
      </div>
    </div>
  )
}

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

export function NewsletterCta({ category, locale, newsletterId }: Props) {
  const [state, dispatch, pending] = useActionState(subscribeNewsletterInline, INITIAL)
  const ctaLabel = category ? CATEGORY_LABEL[category] ?? 'Caderno de Campo' : 'Caderno de Campo'

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
        Gostou? Recebe os proximos na caixa de entrada.
      </h3>

      {state.success ? (
        <p className="text-pb-accent font-jetbrains text-sm py-4">Inscricao recebida! Verifique seu email para confirmar.</p>
      ) : (
        <form action={dispatch} className="flex gap-2 flex-wrap">
          {newsletterId && <input type="hidden" name="newsletter_id" value={newsletterId} />}
          <input type="hidden" name="locale" value={locale} />
          <input
            name="email"
            type="email"
            required
            placeholder="seu@email.com"
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
            {pending ? '...' : `Assinar ${ctaLabel}`}
          </button>
          {state.error && <p className="text-pb-yt font-jetbrains text-xs w-full">{state.error}</p>}
        </form>
      )}
      <div className="text-[11px] mt-2.5 font-jetbrains" style={{ opacity: 0.65 }}>
        1.427 leitores · 62% open rate · cancelar e um clique
      </div>
    </div>
  )
}

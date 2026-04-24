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
      <Tape variant="tape" className="top-[-10px] left-[calc(50%-40px)]" rotate={-1.5} />
      <Tape variant="tape2" className="bottom-[-8px] right-10" rotate={2} />
      <div className="blog-nl-accent" />

      <div className="blog-sidebar-label mb-3.5">NEWSLETTER</div>
      <h3 className="font-fraunces text-[28px] font-bold leading-tight mb-5 max-w-[500px]">
        Gostou? Recebe os proximos na caixa de entrada.
      </h3>

      {state.success ? (
        <p className="text-pb-accent font-jetbrains text-sm py-4">Inscrição recebida! Verifique seu email para confirmar.</p>
      ) : (
        <form action={dispatch}>
          {newsletterId && <input type="hidden" name="newsletter_id" value={newsletterId} />}
          <input type="hidden" name="locale" value={locale} />
          <div className="flex gap-2.5 mb-3">
            <input
              name="email"
              type="email"
              required
              placeholder="seu@email.com"
              className="flex-1 bg-[--pb-bg] border border-[--pb-line] text-pb-ink px-4 py-3.5 rounded-lg text-[15px] outline-none font-sans focus:border-pb-accent"
            />
            <button
              type="submit"
              disabled={pending}
              className="bg-pb-accent border-none px-5 py-3.5 rounded-lg font-jetbrains text-xs font-semibold tracking-wider uppercase cursor-pointer whitespace-nowrap transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ color: '#14110B' }}
            >
              {pending ? '…' : `Assinar ${ctaLabel}`}
            </button>
          </div>
          {state.error && <p className="text-pb-yt font-jetbrains text-xs mb-2">{state.error}</p>}
        </form>
      )}
      <div className="text-xs text-pb-faint">1.427 leitores · 62% open rate · cancelar e um clique</div>
    </div>
  )
}

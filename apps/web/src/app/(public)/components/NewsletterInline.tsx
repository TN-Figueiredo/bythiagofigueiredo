'use client'

import { useActionState } from 'react'
import { subscribeNewsletterInline, type InlineState } from '../actions/newsletter-inline'
import type { HomeNewsletter } from '@/lib/home/types'

type Props = {
  locale: 'en' | 'pt-BR'
  primaryNewsletter: HomeNewsletter
  t: Record<string, string>
}

const INITIAL: InlineState = {}

export function NewsletterInline({ locale, primaryNewsletter, t }: Props) {
  const [state, dispatch, pending] = useActionState(subscribeNewsletterInline, INITIAL)

  return (
    <section id="newsletter" className="border-t border-[--pb-line]" style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 28px' }}>
      <div className="max-w-md mx-auto text-center">
        <h2 className="font-fraunces text-pb-ink text-3xl mb-2" style={{ letterSpacing: '-0.03em' }}>
          {t['newsletter.title']}
        </h2>
        <p className="text-pb-muted text-sm mb-6">{t['newsletter.subtitle']}</p>

        {state.success ? (
          <p className="text-pb-accent font-mono text-sm py-4">{t['newsletter.success']}</p>
        ) : (
          <form action={dispatch} className="flex flex-col gap-3">
            <input type="hidden" name="newsletter_id" value={primaryNewsletter.id} />
            <input type="hidden" name="locale" value={locale} />

            <div className="flex gap-2">
              <input
                name="email"
                type="email"
                required
                placeholder={t['newsletter.emailPlaceholder']}
                className="flex-1 px-3 py-2 rounded text-sm font-mono bg-[--pb-paper2] text-pb-ink border border-[--pb-line] placeholder:text-pb-faint focus:outline-none focus:border-pb-accent"
              />
              <button
                type="submit"
                disabled={pending}
                className="bg-pb-accent text-white font-mono font-semibold text-sm px-4 py-2 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {pending ? '…' : t['newsletter.submit']}
              </button>
            </div>

            {state.error && (
              <p className="text-pb-yt font-mono text-xs">{state.error}</p>
            )}

            <p className="text-pb-faint text-xs">
              {t['newsletter.consent']}{' '}
              <a href="/privacy" className="underline hover:text-pb-muted">
                Privacy Policy
              </a>
            </p>
          </form>
        )}

        <a href="/newsletter" className="mt-4 inline-block font-mono text-xs text-pb-accent hover:underline">
          {t['newsletter.more']}
        </a>
      </div>
    </section>
  )
}

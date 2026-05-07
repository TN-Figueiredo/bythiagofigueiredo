import Link from 'next/link'
import { localePath } from '@/lib/i18n/locale-path'
import type { BlogStrings } from './_i18n/types'

type Props = {
  previousPost: { title: string; slug: string; locale: string } | null
  nextPost: { title: string; slug: string; locale: string; excerpt?: string } | null
  continuesInNext: boolean
  t: BlogStrings
  locale: string
}

export function SeriesNav({ previousPost, nextPost, continuesInNext, t, locale: _locale }: Props) {
  if (!previousPost && !nextPost && !continuesInNext) return null
  return (
    <div className="my-8 space-y-4">
      {previousPost && (
        <div style={{ background: 'var(--pb-paper)', borderLeft: '3px solid var(--pb-accent)', padding: '16px 20px' }}>
          <div className="font-jetbrains uppercase mb-2" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--pb-muted)' }}>
            {t.previousPost.toUpperCase()}
          </div>
          <Link
            href={localePath(`/blog/${encodeURIComponent(previousPost.slug)}`, previousPost.locale)}
            className="no-underline font-fraunces"
            style={{ fontSize: 18, fontWeight: 500, color: 'var(--pb-ink)' }}
          >
            ← {previousPost.title}
          </Link>
        </div>
      )}
      {(nextPost || continuesInNext) && (
        <div style={{ background: 'var(--pb-paper)', borderLeft: '3px solid var(--pb-accent)', padding: '24px 28px' }}>
          <div className="font-jetbrains uppercase mb-3" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--pb-muted)' }}>
            {t.continuesNext.toUpperCase()}
          </div>
          {nextPost && (
            <>
              <div className="font-fraunces mb-2" style={{ fontSize: 22, fontWeight: 500 }}>
                <Link
                  href={localePath(`/blog/${encodeURIComponent(nextPost.slug)}`, nextPost.locale)}
                  className="no-underline"
                  style={{ color: 'var(--pb-ink)' }}
                >
                  {nextPost.title} →
                </Link>
              </div>
              {nextPost.excerpt && (
                <p className="text-sm leading-relaxed mt-2" style={{ color: 'var(--pb-muted)' }}>
                  {nextPost.excerpt}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

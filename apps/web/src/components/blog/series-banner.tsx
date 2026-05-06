import Link from 'next/link'
import { localePath } from '@/lib/i18n/locale-path'
import type { BlogStrings } from './_i18n/types'

type Props = {
  previousPost: { title: string; slug: string; locale: string } | null
  t: BlogStrings
}

export function SeriesBanner({ previousPost, t }: Props) {
  if (!previousPost) return null
  return (
    <div
      className="px-4 py-3 mb-6"
      style={{
        background: 'var(--pb-paper2)',
        borderLeft: '3px solid var(--pb-accent)',
      }}
    >
      <div
        className="uppercase"
        style={{
          fontFamily: 'var(--font-jetbrains), monospace',
          fontSize: 10,
          letterSpacing: '0.14em',
          color: '#958a75',
        }}
      >
        {t.partOfSeries.toUpperCase()}
      </div>
      <Link
        href={localePath(`/blog/${encodeURIComponent(previousPost.slug)}`, previousPost.locale)}
        className="no-underline"
        style={{
          fontFamily: 'var(--font-fraunces), serif',
          fontSize: 17,
          fontWeight: 500,
          color: 'var(--pb-accent)',
          lineHeight: 1.4,
        }}
      >
        ← {previousPost.title}
      </Link>
    </div>
  )
}

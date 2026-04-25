import Link from 'next/link'

type Props = {
  nextSlug?: string
  nextTitle?: string
  nextExcerpt?: string
  locale: string
}

export function SeriesNav({ nextSlug, nextTitle, nextExcerpt, locale }: Props) {
  if (!nextSlug || !nextTitle) return null
  return (
    <div
      className="my-8"
      style={{
        background: '#1e1a14',
        borderLeft: '3px solid var(--pb-accent)',
        padding: '24px 28px',
      }}
    >
      <div
        className="font-jetbrains uppercase mb-3"
        style={{ fontSize: 10, letterSpacing: '0.14em', color: '#958a75' }}
      >
        CONTINUA NA PROXIMA PARTE
      </div>
      <div className="font-fraunces mb-2" style={{ fontSize: 22, fontWeight: 500 }}>
        <Link
          href={`/blog/${locale}/${encodeURIComponent(nextSlug)}`}
          className="no-underline"
          style={{ color: '#efe6d2' }}
        >
          {nextTitle} →
        </Link>
      </div>
      {nextExcerpt && (
        <p className="text-sm leading-relaxed mt-2" style={{ color: '#958a75' }}>
          {nextExcerpt}
        </p>
      )}
    </div>
  )
}

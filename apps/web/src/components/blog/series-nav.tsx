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
    <div className="bg-[--pb-paper] rounded-xl px-7 py-6 my-6">
      <div className="font-jetbrains text-[10px] tracking-[2px] uppercase text-pb-accent mb-2.5">
        CONTINUA NA PROXIMA PARTE
      </div>
      <div className="font-fraunces text-[22px] font-bold mb-2">
        <Link href={`/blog/${locale}/${encodeURIComponent(nextSlug)}`} className="text-pb-ink no-underline">
          {nextTitle} →
        </Link>
      </div>
      {nextExcerpt && (
        <p className="text-sm text-pb-muted leading-relaxed">{nextExcerpt}</p>
      )}
    </div>
  )
}

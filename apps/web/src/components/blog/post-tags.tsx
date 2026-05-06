import Link from 'next/link'
import { localePath } from '@/lib/i18n/locale-path'
import type { BlogStrings } from './_i18n/types'

interface Hashtag {
  id: string
  name: string
  slug: string
}

type Props = { hashtags: Hashtag[]; locale: string; t: BlogStrings }

export function PostTags({ hashtags, locale, t }: Props) {
  if (!hashtags || hashtags.length === 0) return null
  return (
    <div className="my-6">
      <div className="blog-sidebar-label">{t.tags}</div>
      <div className="flex flex-wrap gap-1.5">
        {hashtags.map((tag) => (
          <Link
            key={tag.id}
            href={localePath(`/blog?tag=${encodeURIComponent(tag.slug)}`, locale)}
            className="inline-block border border-[--pb-line] rounded-full px-3.5 py-1 font-jetbrains text-xs text-pb-muted hover:border-pb-faint transition-colors"
          >
            #{tag.name}
          </Link>
        ))}
      </div>
    </div>
  )
}

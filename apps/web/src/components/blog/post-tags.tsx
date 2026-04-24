import Link from 'next/link'

type Props = { tags: string[] | undefined; locale: string }

export function PostTags({ tags, locale }: Props) {
  if (!tags || tags.length === 0) return null
  return (
    <div className="my-6">
      <div className="blog-sidebar-label">Marcadores</div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Link
            key={tag}
            href={`/blog/${locale}?tag=${encodeURIComponent(tag)}`}
            className="inline-block border border-[--pb-line] rounded-full px-3.5 py-1 font-jetbrains text-xs text-pb-muted hover:border-pb-faint transition-colors"
          >
            #{tag}
          </Link>
        ))}
      </div>
    </div>
  )
}

import type { BlogStrings } from './_i18n/types'

type Props = { points: string[] | undefined; t: BlogStrings }

export function PostKeyPoints({ points, t }: Props) {
  if (!points || points.length === 0) return null
  return (
    <div>
      <div className="blog-sidebar-label">{t.keyPoints}</div>
      <ol className="list-none">
        {points.map((point, i) => (
          <li key={i} className="flex gap-2.5 items-start mb-3">
            <span className="font-jetbrains text-xs font-bold text-pb-accent min-w-5">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="text-[13px] text-pb-ink leading-snug">{point}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

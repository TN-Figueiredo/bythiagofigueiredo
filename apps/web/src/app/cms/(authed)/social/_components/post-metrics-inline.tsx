'use client'

interface PostMetricsInlineProps {
  likes: number
  comments: number
  shares: number
  linkClicks: number | null
}

export function PostMetricsInline({
  likes,
  comments,
  shares,
  linkClicks,
}: PostMetricsInlineProps) {
  const engagements = likes + comments + shares

  if (engagements === 0 && !linkClicks) return null

  return (
    <p className="text-xs text-cms-text-dim">
      {engagements > 0 && (
        <span>
          {engagements} engagement{engagements !== 1 ? 's' : ''}
        </span>
      )}
      {engagements > 0 && linkClicks !== null && linkClicks > 0 && (
        <span className="mx-1">&middot;</span>
      )}
      {linkClicks !== null && linkClicks > 0 && (
        <span>
          {linkClicks} link click{linkClicks !== 1 ? 's' : ''}
        </span>
      )}
    </p>
  )
}

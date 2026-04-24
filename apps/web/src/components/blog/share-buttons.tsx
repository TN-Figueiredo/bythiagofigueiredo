'use client'

type Props = {
  url: string
  compact?: boolean
}

export function ShareButtons({ url, compact }: Props) {
  return (
    <div className={`flex gap-2 ${compact ? 'ml-3' : ''}`}>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-8 h-8 rounded-lg bg-[--pb-paper] border border-[--pb-line] flex items-center justify-center text-xs text-pb-muted hover:border-pb-faint transition-colors"
      >
        X
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-8 h-8 rounded-lg bg-[--pb-paper] border border-[--pb-line] flex items-center justify-center text-xs text-pb-muted hover:border-pb-faint transition-colors"
      >
        in
      </a>
      <button
        onClick={() => navigator.clipboard.writeText(url)}
        className="w-8 h-8 rounded-lg bg-[--pb-paper] border border-[--pb-line] flex items-center justify-center text-xs text-pb-muted hover:border-pb-faint transition-colors cursor-pointer"
      >
        🔗
      </button>
    </div>
  )
}

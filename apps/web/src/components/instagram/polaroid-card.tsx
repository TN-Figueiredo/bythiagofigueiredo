import type { InstagramPostView } from '@/lib/instagram/types'

const TAPE_COLORS = [
  'bg-amber-300/40',
  'bg-sky-300/40',
  'bg-rose-300/40',
]

function seededRandom(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  return Math.abs(hash % 1000) / 1000
}

interface PolaroidCardProps {
  post: InstagramPostView
  index: number
  pinned?: boolean
  className?: string
}

export function PolaroidCard({ post, index, pinned, className = '' }: PolaroidCardProps) {
  const rand = seededRandom(post.id)
  const rotation = (rand - 0.5) * 6
  const tapeColor = TAPE_COLORS[index % TAPE_COLORS.length]

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative block ${className}`}
    >
      <div className="relative bg-[#faf8f4] p-2 pb-8 shadow-md transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg dark:bg-[#2a2824]" style={{ transform: `rotate(${rotation}deg)` }}>
        {/* Grain texture */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }} />

        {/* Tape */}
        <div className={`absolute -top-2 left-1/2 z-10 h-5 w-12 -translate-x-1/2 -rotate-1 rounded-sm ${tapeColor}`} />

        {/* Photo */}
        <div className="relative aspect-square overflow-hidden">
          {post.cachedImageUrl ? (
            <img
              src={post.cachedImageUrl}
              alt={post.caption ?? ''}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-200 dark:bg-slate-700">
              <span className="text-sm text-slate-400">No image</span>
            </div>
          )}
          {/* Vignette */}
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_30px_rgba(0,0,0,0.15)]" />
        </div>

        {/* Caption */}
        <div className="mt-2 px-0.5">
          {post.caption && (
            <p className="line-clamp-2 text-sm leading-tight text-slate-700 dark:text-slate-300" style={{ fontFamily: 'var(--font-caveat-var), cursive' }}>
              {post.caption}
            </p>
          )}
          <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-400">
            <span>{formatDate(post.igTimestamp)}</span>
            <span>&#9829; {post.likeCount}</span>
          </div>
        </div>
      </div>
    </a>
  )
}

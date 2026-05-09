import Image from 'next/image'
import type { InstagramPostView } from '@/lib/instagram/types'

const TAPE_COLORS_DARK = [
  'rgba(255, 226, 140, 0.42)',
  'rgba(209, 224, 255, 0.36)',
  'rgba(255, 120, 120, 0.40)',
]

const TAPE_COLORS_LIGHT = [
  'rgba(255, 226, 140, 0.75)',
  'rgba(200, 220, 255, 0.7)',
  'rgba(255, 150, 150, 0.7)',
]

function seededRandom(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  return Math.abs(hash % 1000) / 1000
}

function formatPostDate(iso: string, locale: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' }).toUpperCase()
}

interface PolaroidCardProps {
  post: InstagramPostView
  index: number
  pinned?: boolean
  locale?: string
  rotation?: number
  className?: string
}

export function PolaroidCard({ post, index, pinned, locale = 'pt-BR', rotation, className = '' }: PolaroidCardProps) {
  const rand = seededRandom(post.id)
  const rot = rotation ?? (rand - 0.5) * 6
  const tapeIdx = index % TAPE_COLORS_DARK.length
  const tapeRot = (index * 13) % 14 - 7
  const altText = post.caption || `Instagram post ${index + 1}`

  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={post.caption ? `Instagram: ${post.caption.slice(0, 60)}` : `Instagram post from ${formatPostDate(post.igTimestamp, locale)}`}
      className={`group relative block no-underline ${className}`}
      style={{ transform: `rotate(${rot}deg)`, transition: 'transform 0.2s ease' }}
    >
      <div
        className="relative bg-[#FBF6E8] shadow-[0_14px_32px_rgba(20,17,11,0.18),0_2px_6px_rgba(20,17,11,0.12)] dark:bg-[#2A241A] dark:shadow-[0_12px_28px_rgba(0,0,0,0.55),0_2px_6px_rgba(0,0,0,0.4)]"
        style={{ padding: '10px 10px 14px' }}
      >
        {/* Tape — uses two layers: light visible in light mode, dark visible in dark mode */}
        <div
          className="absolute -top-2.5 z-10 h-5 rounded-sm dark:hidden"
          style={{ left: '30%', width: 70, transform: `rotate(${tapeRot}deg)`, background: TAPE_COLORS_LIGHT[tapeIdx] }}
        />
        <div
          className="absolute -top-2.5 z-10 hidden h-5 rounded-sm dark:block"
          style={{ left: '30%', width: 70, transform: `rotate(${tapeRot}deg)`, background: TAPE_COLORS_DARK[tapeIdx] }}
        />

        {pinned && (
          <div className="absolute -right-1.5 -top-1.5 z-20 rounded-full bg-amber-400 p-0.5 shadow-sm" aria-label="Pinned">
            <svg className="h-2.5 w-2.5 text-amber-900" viewBox="0 0 16 16" fill="currentColor">
              <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1-.707.707l-.71-.71-3.18 3.18a5 5 0 0 1-1.413 1.006l-.265.106-.452 2.26a.5.5 0 0 1-.588.393l-.07-.018-2.5-.625a.5.5 0 0 1-.276-.178L3.5 10.18l-1.793 1.793a.5.5 0 0 1-.707-.707L2.793 9.47l-1.75-1.75a.5.5 0 0 1-.178-.276l-.625-2.5a.5.5 0 0 1 .375-.658l2.26-.452.106-.265a5 5 0 0 1 1.006-1.413l3.18-3.18-.71-.71a.5.5 0 0 1 .708-.707z"/>
            </svg>
          </div>
        )}

        <div className="relative aspect-square w-full overflow-hidden">
          {post.cachedImageUrl ? (
            <Image
              src={post.cachedImageUrl}
              alt={altText}
              fill
              sizes="(max-width: 768px) 45vw, 240px"
              className="object-cover dark:brightness-[0.92]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#E5DCC4] dark:bg-[#1A140E]">
              <span className="text-sm text-[#958A75]">No image</span>
            </div>
          )}
        </div>

        <div className="mt-2" style={{ minHeight: 22 }}>
          {post.caption && (
            <p
              className="line-clamp-2 text-[17px] leading-tight text-[#161208] dark:text-[#EFE6D2]"
              style={{ fontFamily: 'var(--font-caveat-var), cursive' }}
            >
              {post.caption}
            </p>
          )}
        </div>

        <div className="mt-1 flex items-center justify-between font-mono text-[9.5px] tracking-[0.08em] text-[#6A5F48] dark:text-[#958A75]">
          <span>{formatPostDate(post.igTimestamp, locale)}</span>
          <span>&#9829; {post.likeCount}</span>
        </div>
      </div>
    </a>
  )
}

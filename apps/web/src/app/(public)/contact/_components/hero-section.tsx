import type { ContactPageSettings, ContactPageVisibility, ContactAuthorData } from '@/lib/contact/types'

interface Props {
  settings: ContactPageSettings
  visibility: ContactPageVisibility
  author: ContactAuthorData | null
}

export function HeroSection({ settings, visibility, author }: Props) {
  if (!visibility.show_hero) return null

  const words = settings.hero_title.split(' ')
  const lastWord = words.pop() ?? ''
  const leadWords = words.join(' ')

  return (
    <div className="flex flex-col items-center text-center gap-4 py-10">
      {/* Avatar */}
      {visibility.show_avatar && (
        <div className="shrink-0">
          {author?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={author.avatar_url}
              alt={author.name}
              width={72}
              height={72}
              className="rounded-full object-cover border-2 border-pb-line"
              style={{ width: 72, height: 72 }}
            />
          ) : (
            <div
              className="rounded-full flex items-center justify-center text-2xl font-bold text-pb-ink border-2 border-pb-line"
              style={{
                width: 72,
                height: 72,
                background: 'linear-gradient(135deg, var(--pb-accent) 0%, var(--pb-accent-deep) 100%)',
              }}
            >
              {(author?.name ?? settings.hero_title).charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Title */}
      <h1
        className="text-pb-ink leading-tight tracking-tight"
        style={{
          fontFamily: 'var(--font-fraunces-var)',
          fontSize: 'clamp(2rem, 4vw + 0.5rem, 3rem)',
        }}
      >
        {leadWords && <span>{leadWords} </span>}
        <span className="relative inline-block">
          {lastWord}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0.5 h-[0.35em] bg-pb-marker/40 -z-10 rounded-sm"
          />
        </span>
      </h1>

      {/* Subtitle */}
      {settings.hero_subtitle && (
        <p
          className="text-pb-muted italic max-w-md"
          style={{
            fontFamily: 'var(--font-source-serif-var)',
            fontSize: 'clamp(1rem, 1.5vw + 0.25rem, 1.2rem)',
            lineHeight: 1.6,
          }}
        >
          {settings.hero_subtitle}
        </p>
      )}

      {/* Bio */}
      {visibility.show_bio && author?.bio && (
        <p
          className="text-pb-muted max-w-prose text-base"
          style={{ fontFamily: 'var(--font-source-serif-var)', lineHeight: 1.7 }}
        >
          {author.bio}
        </p>
      )}

      {/* Response time badge */}
      {visibility.show_response_badge && settings.response_time_text && (
        <div className="flex items-center gap-2 mt-1 px-3 py-1.5 rounded-full border border-pb-line bg-pb-paper text-sm text-pb-muted">
          <span
            className="inline-block w-2 h-2 rounded-full bg-green-500"
            style={{ animation: 'pulse 2s ease-in-out infinite' }}
            aria-hidden="true"
          />
          {settings.response_time_text}
        </div>
      )}
    </div>
  )
}

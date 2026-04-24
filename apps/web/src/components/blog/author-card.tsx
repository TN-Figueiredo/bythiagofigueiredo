import type { AuthorData } from './types'

type Props = {
  author: AuthorData
  locale: string
}

export function AuthorCard({ author, locale }: Props) {
  return (
    <div className="bg-[--pb-paper] rounded-xl p-7 my-12">
      <div className="blog-sidebar-label mb-4">SOBRE QUEM ESCREVEU</div>
      <div className="flex gap-4 items-start">
        <div
          className="w-16 h-16 rounded-full bg-pb-accent flex items-center justify-center font-bold text-[22px] shrink-0"
          style={{ color: 'var(--pb-bg)' }}
        >
          {author.initials}
        </div>
        <div>
          <div className="font-fraunces text-[22px] font-bold mb-0.5">{author.name}</div>
          <div className="font-jetbrains text-xs text-pb-muted">{author.role}</div>
        </div>
      </div>
      <p className="text-[15px] text-pb-ink leading-relaxed my-3">{author.bio}</p>
      <div className="flex gap-4 text-[13px]">
        {author.links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pb-muted hover:text-pb-accent transition-colors"
          >
            {link.label} ↗
          </a>
        ))}
      </div>
      <a
        href={`/blog/${locale}`}
        className="font-caveat text-base text-pb-accent float-right mt-2"
      >
        <em>mais textos de {author.name.split(' ')[0]}</em> →
      </a>
    </div>
  )
}

import { localePath } from '@/lib/i18n/locale-path'
import type { AuthorData } from './types'
import type { BlogStrings } from './_i18n/types'

type Props = {
  author: AuthorData
  locale: string
  t?: BlogStrings
}

export function AuthorCard({ author, locale, t: _t }: Props) {
  return (
    <div className="relative my-12" style={{ background: 'var(--pb-paper)', padding: '32px 28px 24px' }}>
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: 80, height: 8, background: 'var(--pb-accent)', opacity: 0.7 }}
      />

      <div className="blog-sidebar-label mb-5">{locale === 'pt-BR' ? 'Sobre quem escreveu' : 'About the author'}</div>

      <div className="flex gap-4 items-center mb-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center font-fraunces font-semibold text-lg shrink-0"
          style={{
            background: 'linear-gradient(135deg, var(--pb-accent), var(--pb-marker))',
            color: 'var(--pb-ink-on-accent)',
          }}
        >
          {author.initials}
        </div>
        <div>
          <div className="font-fraunces text-xl" style={{ fontWeight: 500, color: 'var(--pb-ink)' }}>
            {author.name}
          </div>
          <div className="font-jetbrains text-xs text-pb-muted">{author.role}</div>
        </div>
      </div>

      <p className="text-[15px] leading-relaxed mb-5" style={{ color: 'var(--pb-muted)', fontFamily: 'var(--font-source-serif), Georgia, serif' }}>
        {author.bio}
      </p>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-4 text-[13px] font-jetbrains">
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
          href={localePath('/blog', locale)}
          className="font-caveat text-base text-pb-accent no-underline"
        >
          <em>{locale === 'pt-BR' ? `mais textos de ${author.name.split(' ')[0]}` : `more from ${author.name.split(' ')[0]}`}</em> →
        </a>
      </div>
    </div>
  )
}

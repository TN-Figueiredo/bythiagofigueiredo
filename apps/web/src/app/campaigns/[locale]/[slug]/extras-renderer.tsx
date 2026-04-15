import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { parseExtras } from '../../../../../lib/campaigns/extras-schema'

export function ExtrasRenderer({ extras }: { extras: unknown }) {
  const blocks = parseExtras(extras)
  return (
    <div>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'youtube':
            return (
              <iframe
                key={i}
                title={b.title ?? 'YouTube'}
                src={`https://www.youtube.com/embed/${b.videoId}`}
                allowFullScreen
              />
            )
          case 'testimonial':
            return (
              <blockquote key={i}>
                <p>{b.quote}</p>
                <cite>{b.author}</cite>
              </blockquote>
            )
          case 'whoAmI':
            return (
              <section key={i}>
                <h3>{b.headline}</h3>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{b.bio_md}</ReactMarkdown>
              </section>
            )
          case 'whatsappCtas':
            return (
              <nav key={i}>
                {b.ctas.map((c, j) => (
                  <a
                    key={j}
                    href={
                      c.kind === 'joinChannel'
                        ? c.url
                        : `https://wa.me/${c.phone}?text=${encodeURIComponent(c.text)}`
                    }
                  >
                    {c.label}
                  </a>
                ))}
              </nav>
            )
        }
      })}
    </div>
  )
}

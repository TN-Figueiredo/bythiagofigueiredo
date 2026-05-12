import { Paper } from '@/components/pinboard/paper'
import { localePath } from '@/lib/i18n/locale-path'
import Link from 'next/link'

interface Props {
  locale: string
}

export function SuccessState({ locale }: Props) {
  const isPt = locale === 'pt-BR'

  return (
    <div className="flex justify-center px-4 py-16">
      <Paper
        padding="36px"
        rotation={-0.4}
        style={{ maxWidth: 448, width: '100%', textAlign: 'center' }}
      >
        {/* Heading */}
        <p
          className="text-pb-accent mb-3"
          style={{
            fontFamily: 'var(--font-caveat-var)',
            fontSize: 'clamp(2rem, 4vw + 0.5rem, 2.75rem)',
            lineHeight: 1.1,
          }}
        >
          {isPt ? 'recebido!' : 'got it!'}
        </p>

        {/* Body */}
        <p
          className="text-pb-muted mb-6 text-base"
          style={{
            fontFamily: 'var(--font-source-serif-var)',
            lineHeight: 1.65,
          }}
        >
          {isPt
            ? 'Sua mensagem chegou certinho. Vou ler com atenção e responder assim que possível.'
            : "Your message landed safely. I'll read it carefully and get back to you as soon as I can."}
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={localePath('/', locale)}
            className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium border border-pb-line text-pb-ink hover:bg-pb-line/40 transition-colors"
          >
            {isPt ? '← Início' : '← Home'}
          </Link>
          <Link
            href={localePath('/blog', locale)}
            className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium bg-pb-accent text-white hover:opacity-90 transition-opacity"
            style={{ color: 'var(--pb-ink-on-accent, #1A140C)' }}
          >
            {isPt ? 'Ler o blog →' : 'Read the blog →'}
          </Link>
        </div>
      </Paper>
    </div>
  )
}

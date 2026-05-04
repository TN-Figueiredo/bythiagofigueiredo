import { PaperCard } from './PaperCard'
import { Tape } from './Tape'
import { YOUTUBE_CHANNELS } from '../../../../lib/home/videos-data'

type Props = {
  locale: 'en' | 'pt-BR'
}

export function HouseVideoCard({ locale }: Props) {
  const isPt = locale === 'pt-BR'
  const channel = YOUTUBE_CHANNELS[locale]

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 28px' }}>
      <PaperCard index={25} variant="paper" className="p-5">
        <Tape variant="tapeR" className="-top-2 left-8" rotate={-3} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--pb-faint)' }}>
            house
          </span>
          <span style={{ color: 'var(--pb-faint)', fontSize: 10 }}>·</span>
          <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--pb-yt)' }}>
            video
          </span>
          <button
            type="button"
            aria-label="dismiss"
            className="ml-auto font-mono"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pb-faint)', fontSize: 14, lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        </div>
        <h3 className="font-fraunces" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--pb-ink)', margin: 0 }}>
          {isPt ? 'Sua pergunta, em vídeo — toda quinta.' : 'Your question, in video — every Thursday.'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--pb-muted)', marginTop: 6, lineHeight: 1.45 }}>
          {isPt ? 'Vídeos curtos sobre o que estou construindo.' : 'Short videos about what I\'m building.'}
        </p>
        <a
          href={channel.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono inline-block"
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--pb-yt)', textDecoration: 'none', marginTop: 10 }}
        >
          Watch on YouTube →
        </a>
        <p className="font-mono" style={{ fontSize: 10, color: 'var(--pb-faint)', marginTop: 6 }}>
          {isPt ? 'Canal no YouTube · weekly' : 'YouTube channel · weekly'}
        </p>
      </PaperCard>
    </div>
  )
}

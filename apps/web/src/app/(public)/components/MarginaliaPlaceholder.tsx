import { PaperCard } from './PaperCard'
import { Tape } from './Tape'

type Props = {
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

export function MarginaliaPlaceholder({ locale, t }: Props) {
  const isPt = locale === 'pt-BR'

  return (
    <aside aria-label={isPt ? 'Publicidade' : 'Advertisement'} style={{ marginTop: 26 }}>
      <PaperCard index={18} variant="paper" style={{ padding: '16px 18px' }}>
        <Tape variant="tape2" className="-top-2 left-6" rotate={-4} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span className="font-mono" style={{ fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--pb-faint)', opacity: 0.6 }}>
            ad
          </span>
          <span style={{ color: 'var(--pb-faint)', fontSize: 8, opacity: 0.4 }}>·</span>
          <span className="font-mono" style={{ fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--pb-faint)', opacity: 0.6 }}>
            {t['home.ad.label']}
          </span>
        </div>
        <div style={{ aspectRatio: '3 / 1', background: 'var(--pb-paper2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, border: '1px dashed var(--pb-line)' }}>
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--pb-faint)', letterSpacing: '0.1em', opacity: 0.5 }}>
            {t['home.ad.marginaliaTitle']}
          </span>
        </div>
        <p className="font-caveat" style={{ fontSize: 14, color: 'var(--pb-faint)', margin: 0, transform: 'rotate(-0.5deg)' }}>
          {t['home.ad.marginaliaBody']}
        </p>
      </PaperCard>
    </aside>
  )
}

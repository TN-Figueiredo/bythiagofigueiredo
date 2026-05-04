interface CtaChipProps {
  number: string
  label: string
  href: string
  external?: boolean
}

export function CtaChip({ number, label, href, external }: CtaChipProps) {
  return (
    <a
      className="about-chip"
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      <span className="about-chip-num">{number}</span>
      <span className="about-chip-label">{label}</span>
      <span className="about-chip-arrow">→</span>
    </a>
  )
}

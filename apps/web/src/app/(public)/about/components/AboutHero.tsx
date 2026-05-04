interface AboutHeroProps {
  headline: string
}

export function AboutHero({ headline }: AboutHeroProps) {
  const parts = headline.split('|')
  const before = parts[0] ?? ''
  const highlighted = parts.slice(1).join('|')

  return (
    <section style={{ maxWidth: 1080, margin: '0 auto', padding: '72px 28px 24px' }}>
      <div className="about-kicker">§ OLÁ</div>
      <h1 className="about-headline">
        <span>{before}</span>
        {highlighted && (
          <span className="about-marker">
            <span className="about-marker-text">{highlighted}</span>
            <span className="about-marker-bg" />
          </span>
        )}
      </h1>
    </section>
  )
}

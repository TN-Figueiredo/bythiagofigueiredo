type Props = {
  postCount: number
  videoCount: number
  subscriberCount: number
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

export function StatsStrip({ postCount, videoCount, subscriberCount, locale, t }: Props) {
  if (postCount === 0 && videoCount === 0 && subscriberCount === 0) return null

  const fmt = (n: number) => n.toLocaleString(locale)
  const items = [
    subscriberCount > 0 ? `${fmt(subscriberCount)} ${t['home.stats.subscribers']}` : null,
    postCount > 0 ? `${fmt(postCount)} ${t['home.stats.posts']}` : null,
    videoCount > 0 ? `${fmt(videoCount)} ${t['home.stats.youtube']}` : null,
  ].filter(Boolean)

  if (items.length === 0) return null

  return (
    <div style={{ borderBottom: '1px dashed var(--pb-line)', background: 'var(--pb-bg)' }}>
      <div
        className="flex justify-center md:justify-end items-center flex-wrap px-[18px] md:px-7"
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          paddingTop: 10,
          paddingBottom: 10,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 12,
          color: 'var(--pb-faint)',
          gap: '8px 18px',
        }}
      >
        {items.map((item, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <span className="hidden md:inline" style={{ opacity: 0.4 }}>|</span>}
            {i === 0 ? `▸ ${item}` : item}
          </span>
        ))}
      </div>
    </div>
  )
}

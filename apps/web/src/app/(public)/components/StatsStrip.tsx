type Props = {
  postCount: number
  videoCount: number
  subscriberCount: number
  t: Record<string, string>
}

export function StatsStrip({ postCount, videoCount, subscriberCount, t }: Props) {
  if (postCount === 0 && videoCount === 0 && subscriberCount === 0) return null

  const fmt = (n: number) => n.toLocaleString('pt-BR')
  const items = [
    subscriberCount > 0 ? `${fmt(subscriberCount)} ${t['home.stats.subscribers']}` : null,
    postCount > 0 ? `${fmt(postCount)} ${t['home.stats.posts']}` : null,
    videoCount > 0 ? `${fmt(videoCount)} ${t['home.stats.videos']}` : null,
  ].filter(Boolean)

  if (items.length === 0) return null

  return (
    <div
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '10px 28px',
        borderBottom: '1px dashed var(--pb-line)',
      }}
    >
      <div className="flex justify-end gap-4 flex-wrap" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: 'var(--pb-faint)' }}>
        {items.map((item, i) => (
          <span key={i}>
            {i > 0 && <span style={{ marginRight: 8 }}>|</span>}
            ▸ {item}
          </span>
        ))}
      </div>
    </div>
  )
}

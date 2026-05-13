interface SeoBreakdownProps {
  title: string
  description: string
  tags: string[]
}

interface SeoRule {
  label: string
  points: number
  pass: boolean
}

export function SeoBreakdown({ title, description, tags }: SeoBreakdownProps) {
  const rules: SeoRule[] = [
    { label: 'Title length 30-60 chars', points: 15, pass: title.length >= 30 && title.length <= 60 },
    { label: 'Description has timestamps', points: 15, pass: /\d{1,2}:\d{2}/.test(description) },
    { label: 'Keywords in title match tags', points: 15, pass: tags.some(t => title.toLowerCase().includes(t.toLowerCase())) },
    { label: 'Description 200+ chars', points: 10, pass: description.length >= 200 },
    { label: 'Power words in title', points: 7, pass: /how|why|best|ultimate|guide|secret|top/i.test(title) },
    { label: 'Links in description', points: 5, pass: /https?:\/\//.test(description) },
    { label: '8-15 tags', points: 10, pass: tags.length >= 8 && tags.length <= 15 },
  ]

  const score = rules.reduce((sum, r) => sum + (r.pass ? r.points : 0), 0)
  const maxScore = rules.reduce((sum, r) => sum + r.points, 0)
  const pct = Math.round((score / maxScore) * 100)

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-cms-text">SEO Score</span>
        <span className={`text-lg font-bold ${pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{pct}/100</span>
      </div>
      <div className="space-y-1">
        {rules.map(rule => (
          <div key={rule.label} className="flex items-center gap-2 text-xs">
            <span className={rule.pass ? 'text-green-400' : 'text-red-400'}>{rule.pass ? '✓' : '✕'}</span>
            <span className="text-cms-text-muted flex-1">{rule.label}</span>
            <span className={`font-medium ${rule.pass ? 'text-green-400' : 'text-cms-text-dim'}`}>+{rule.points}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

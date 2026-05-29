'use client'

interface InsightData {
  tone: 'up' | 'accent' | 'amber' | 'red'
  icon: string
  text: string
}

interface InsightsPanelProps {
  insights: InsightData[]
}

const TONE_COLOR: Record<string, string> = {
  up: '#46B17E',
  accent: '#F2683C',
  amber: '#E0A23C',
  red: '#D9614A',
}

export function InsightsPanel({ insights }: InsightsPanelProps) {
  if (insights.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Nenhum insight disponivel.</p>
  }
  return (
    <div className="flex flex-col gap-2">
      {insights.map((ins, i) => (
        <div
          key={i}
          data-insight-row
          className="flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
        >
          <span
            className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
            style={{ background: TONE_COLOR[ins.tone] || TONE_COLOR.accent }}
          />
          <span className="text-xs leading-relaxed text-foreground">{ins.text}</span>
        </div>
      ))}
    </div>
  )
}

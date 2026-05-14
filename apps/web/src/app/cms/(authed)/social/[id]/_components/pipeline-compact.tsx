interface PipelineStep {
  step: string
  status: string
  at?: string
}

interface PipelineCompactProps {
  steps: PipelineStep[]
}

const STEP_LABELS: Record<string, string> = {
  post_created: 'Post',
  short_link: 'Short Link',
  og_scrape: 'OG Scrape',
  deliver: 'Deliver',
}

const DOT_COLORS: Record<string, string> = {
  completed: 'bg-emerald-500',
  in_progress: 'bg-blue-500 animate-pulse',
  pending: 'bg-cms-border',
  failed: 'bg-red-500',
  warning: 'bg-amber-500',
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
  } catch {
    return ''
  }
}

export function PipelineCompact({ steps }: PipelineCompactProps) {
  return (
    <div className="flex items-start gap-0">
      {steps.map((step, i) => (
        <div key={step.step} className="flex items-start">
          <div className="flex flex-col items-center gap-1">
            <div className={`h-4 w-4 rounded-full ${DOT_COLORS[step.status] ?? 'bg-cms-border'}`} />
            <span className="text-[9px] text-cms-text-muted">{STEP_LABELS[step.step] ?? step.step}</span>
            {step.at && step.status === 'completed' && (
              <span className="text-[8px] text-cms-text-muted tabular-nums">{formatTime(step.at)}</span>
            )}
          </div>
          {i < steps.length - 1 && (
            <div
              data-testid="pipeline-line"
              className={`w-[40px] h-[1px] mt-2 ${step.status === 'completed' ? 'bg-emerald-500' : 'bg-cms-border'}`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

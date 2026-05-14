interface PipelineStepInfo {
  step: string
  status: string
}

interface ScrapeDetailsProps {
  endpoint: string
  status: number
  latencyMs: number
  timestamp: string
  pipelineSteps?: PipelineStepInfo[]
}

const STEP_COLORS: Record<string, string> = {
  completed: 'bg-emerald-500',
  in_progress: 'bg-blue-500 animate-pulse',
  pending: 'bg-cms-border',
  failed: 'bg-red-500',
  warning: 'bg-amber-500',
}

export function ScrapeDetails({ endpoint, status, latencyMs, timestamp, pipelineSteps }: ScrapeDetailsProps) {
  const statusLabel = status >= 200 && status < 300 ? `${status} OK` : `${status} Error`
  const statusColor = status >= 200 && status < 300 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
  const latencyFormatted = latencyMs >= 1000 ? `${(latencyMs / 1000).toFixed(1)}s` : `${latencyMs}ms`

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-3">
      <h3 className="text-sm font-semibold text-cms-text">Scrape Details</h3>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-cms-text-muted">Endpoint</span>
          <p className="font-mono text-cms-text mt-0.5 truncate" title={endpoint}>{endpoint}</p>
        </div>
        <div>
          <span className="text-cms-text-muted">Status</span>
          <p className="mt-0.5">
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${statusColor}`}>
              {statusLabel}
            </span>
          </p>
        </div>
        <div>
          <span className="text-cms-text-muted">Latencia</span>
          <p className="font-mono text-cms-text mt-0.5">{latencyFormatted}</p>
        </div>
        <div>
          <span className="text-cms-text-muted">Timestamp</span>
          <p className="text-cms-text-muted mt-0.5">{timestamp}</p>
        </div>
      </div>

      {pipelineSteps && pipelineSteps.length > 0 && (
        <div className="flex items-center gap-0 pt-2">
          {pipelineSteps.map((step, i) => (
            <div key={step.step} className="flex items-center">
              <div
                data-testid="pipeline-dot"
                className={`h-4 w-4 rounded-full ${STEP_COLORS[step.status] ?? 'bg-cms-border'}`}
                title={`${step.step}: ${step.status}`}
              />
              {i < pipelineSteps.length - 1 && (
                <div className={`w-[40px] h-[1px] ${step.status === 'completed' ? 'bg-emerald-500' : 'bg-cms-border'}`} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

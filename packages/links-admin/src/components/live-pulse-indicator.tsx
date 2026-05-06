'use client'
import { useClickStream } from '../hooks/use-click-stream'

export interface LivePulseIndicatorProps {
  linkId: string
  streamUrl: string
}

export function LivePulseIndicator({ linkId, streamUrl }: LivePulseIndicatorProps) {
  const { clicks, rate, isConnected } = useClickStream(linkId, streamUrl)

  return (
    <div className="flex items-center gap-3 rounded-lg border border bg-card px-3 py-2">
      {/* Pulse dot */}
      <span
        data-testid="pulse-dot"
        className={`inline-block h-3 w-3 rounded-full ${
          isConnected ? 'animate-pulse bg-green-500' : 'bg-muted'
        }`}
      />

      {/* Status */}
      <span className="text-xs font-medium text-muted-foreground">
        {isConnected ? 'Live' : 'Connecting...'}
      </span>

      {/* Click count */}
      {clicks > 0 && (
        <span className="text-sm font-bold tabular-nums text-foreground">{clicks}</span>
      )}

      {/* Rate */}
      <span className="text-xs text-muted-foreground">{rate} clicks/min</span>
    </div>
  )
}

import { CheckCircle, AlertCircle } from 'lucide-react'

interface SocialSummaryBarProps {
  autoLinksCount: number
  ogValidated: boolean
  platformCounts: Partial<Record<string, number>>
}

export function SocialSummaryBar({ autoLinksCount, ogValidated, platformCounts }: SocialSummaryBarProps) {
  const fb = platformCounts.facebook ?? 0
  const ig = platformCounts.instagram ?? 0
  const bs = platformCounts.bluesky ?? 0

  return (
    <div className="flex items-center gap-3 flex-wrap bg-purple-500/[0.05] border border-purple-500/15 rounded-md px-4 py-2">
      <span className="text-xs text-cms-text">
        {autoLinksCount} links criados automaticamente
      </span>
      <span className="text-muted-foreground">|</span>
      <span className="inline-flex items-center gap-1 text-xs">
        {ogValidated ? (
          <>
            <CheckCircle className="h-3 w-3 text-emerald-400" />
            <span className="text-emerald-400">OG validado</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-3 w-3 text-amber-400" />
            <span className="text-amber-400">OG pendente</span>
          </>
        )}
      </span>
      <span className="text-muted-foreground">|</span>
      <span className="text-xs text-cms-text">FB {fb}</span>
      <span className="text-muted-foreground">|</span>
      <span className="text-xs text-cms-text">IG {ig}</span>
      <span className="text-muted-foreground">|</span>
      <span className="text-xs text-cms-text">BS {bs}</span>
    </div>
  )
}

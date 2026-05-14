interface UrlChainProps {
  shortUrl: string
  destinationUrl: string
}

export function UrlChain({ shortUrl, destinationUrl }: UrlChainProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-mono text-xs bg-cms-bg border border-cms-border rounded-md px-3 py-1.5">
        {shortUrl}
      </span>
      <span className="text-cms-text-muted">&rarr;</span>
      <span className="text-[9px] uppercase text-amber-400 bg-amber-500/10 rounded px-1.5 py-0.5">
        301
      </span>
      <span className="text-cms-text-muted">&rarr;</span>
      <span className="font-mono text-xs bg-cms-bg border border-cms-border rounded-md px-3 py-1.5">
        {destinationUrl}
      </span>
      <span className="text-cms-text-muted">&rarr;</span>
      <span className="text-[9px] uppercase text-emerald-400 bg-emerald-500/10 rounded px-1.5 py-0.5">
        200
      </span>
    </div>
  )
}

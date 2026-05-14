'use client'

interface OgCompactProps {
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
}

export function OgCompact({ ogTitle, ogDescription, ogImage }: OgCompactProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {/* og:title */}
      <div className="rounded-md border border-cms-border p-2">
        <p className="mb-1 font-mono text-[10px] text-cyan-400">og:title</p>
        <p className="truncate font-mono text-xs text-cms-text">
          {ogTitle || <span className="italic text-cms-text-muted">Empty</span>}
        </p>
        <p className="mt-1 text-[10px] text-cms-text-muted">
          {(ogTitle ?? '').length}/60
        </p>
      </div>

      {/* og:description */}
      <div className="rounded-md border border-cms-border p-2">
        <p className="mb-1 font-mono text-[10px] text-cyan-400">
          og:description
        </p>
        <p className="line-clamp-2 font-mono text-xs text-cms-text">
          {ogDescription || (
            <span className="italic text-cms-text-muted">Empty</span>
          )}
        </p>
        <p className="mt-1 text-[10px] text-cms-text-muted">
          {(ogDescription ?? '').length}/155
        </p>
      </div>

      {/* og:image */}
      <div className="rounded-md border border-cms-border p-2">
        <p className="mb-1 font-mono text-[10px] text-cyan-400">og:image</p>
        {ogImage ? (
          <img
            src={ogImage}
            alt="OG preview"
            className="h-[25px] w-[48px] rounded object-cover"
          />
        ) : (
          <p className="text-xs text-red-400">Missing</p>
        )}
      </div>
    </div>
  )
}

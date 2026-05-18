interface SiteInfo {
  displayName: string
  bio: string
  avatarUrl: string | null
  brandColor: string
}

interface LinkEntry {
  id: string
  title: string
  shortUrl: string
  thumbnailUrl: string | null
  createdAt: string
}

interface LinkInBioProps {
  site: SiteInfo
  entries: LinkEntry[]
}

export function LinkInBio({ site, entries }: LinkInBioProps) {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center px-4 py-8">
      {/* Avatar + name + bio */}
      <div className="flex flex-col items-center mb-8">
        {site.avatarUrl ? (
          <img
            src={site.avatarUrl}
            alt={site.displayName}
            className="w-20 h-20 rounded-full border-2 mb-3 object-cover"
            style={{ borderColor: site.brandColor }}
          />
        ) : (
          <div
            className="w-20 h-20 rounded-full mb-3 flex items-center justify-center text-2xl font-bold text-white"
            style={{ backgroundColor: site.brandColor }}
          >
            {site.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="text-lg font-semibold text-white">{site.displayName}</h1>
        <p className="text-sm text-neutral-400 text-center mt-1">{site.bio}</p>
      </div>

      {/* Links list */}
      <div className="w-full max-w-md space-y-3">
        {entries.length === 0 ? (
          <p className="text-center text-sm text-neutral-600">No links yet</p>
        ) : (
          entries.map((entry) => (
            <a
              key={entry.id}
              href={entry.shortUrl}
              className="flex items-center gap-3 w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 hover:border-neutral-600 hover:bg-neutral-900 transition-colors group"
            >
              {entry.thumbnailUrl && (
                <img
                  src={entry.thumbnailUrl}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-200 truncate group-hover:text-white transition-colors">
                  {entry.title}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {formatRelativeDate(entry.createdAt)}
                </p>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="shrink-0 text-neutral-600 group-hover:text-neutral-400 transition-colors"
              >
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 text-[10px] text-neutral-700">
        Powered by <span style={{ color: site.brandColor }}>Links Engine</span>
      </div>
    </div>
  )
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

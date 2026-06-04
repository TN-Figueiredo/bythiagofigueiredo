interface SourceCardProps {
  contentType: string
  contentId: string
  title: string
  thumbnail?: string
  date?: string
}

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  blog: { label: 'Blog Post', color: 'bg-green-500/10 text-green-400' },
  newsletter: { label: 'Newsletter', color: 'bg-blue-500/10 text-blue-400' },
  campaign: { label: 'Campaign', color: 'bg-orange-500/10 text-orange-400' },
  video: { label: 'Video', color: 'bg-red-500/10 text-red-400' },
}

const CMS_PATHS: Record<string, (id: string) => string> = {
  blog: (id) => `/cms/blog/${id}/editor`,
  newsletter: (id) => `/cms/newsletters/${id}`,
  campaign: (id) => `/cms/campaigns/${id}/edit`,
  video: (id) => `/cms/youtube?video=${id}`,
}

export function SourceCard({ contentType, contentId, title, thumbnail, date }: SourceCardProps) {
  const badge = TYPE_BADGES[contentType] ?? { label: contentType, color: 'bg-cms-border text-cms-text-muted' }
  const cmsPath = CMS_PATHS[contentType]?.(contentId) ?? '#'

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
      <div className="flex gap-3">
        {thumbnail && (
          <img src={thumbnail} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-md object-cover shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <span className={`inline-block text-[9px] font-medium uppercase rounded px-1.5 py-0.5 mb-1 ${badge.color}`}>
            {badge.label}
          </span>
          <p className="text-sm font-medium text-cms-text line-clamp-2">{title}</p>
          {date && <p className="text-xs text-cms-text-muted mt-1">{date}</p>}
          <a href={cmsPath} className="text-xs text-purple-400 hover:underline mt-1 inline-block">
            Abrir no CMS
          </a>
        </div>
      </div>
    </div>
  )
}

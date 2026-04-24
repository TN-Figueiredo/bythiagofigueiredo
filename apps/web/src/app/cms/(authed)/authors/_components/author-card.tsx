import { StatusBadge, type StatusVariant, formatRelativeTime } from '@tn-figueiredo/cms-ui/client'

interface AuthorCardProps {
  id: string
  displayName: string
  slug: string
  role: string
  bio: string | null
  avatarUrl: string | null
  initials: string
  postsCount: number
  publishedCount: number
  campaignsCount: number
  lastActiveAt: string | null
}

const ROLE_VARIANT: Record<string, { variant: StatusVariant; label: string }> = {
  super_admin: { variant: 'active', label: 'Super Admin' },
  org_admin: { variant: 'scheduled', label: 'Admin' },
  editor: { variant: 'confirmed', label: 'Editor' },
  reporter: { variant: 'paused', label: 'Reporter' },
}

export function AuthorCard(props: AuthorCardProps) {
  const role = ROLE_VARIANT[props.role] ?? { variant: 'confirmed', label: 'Editor' }
  const activityColor = getActivityColor(props.lastActiveAt)

  return (
    <div className="bg-cms-surface border border-cms-border rounded-[var(--cms-radius)] p-4 hover:border-cms-accent transition-colors cursor-pointer">
      <div className="flex items-start gap-3 mb-3">
        {props.avatarUrl ? (
          <img src={props.avatarUrl} alt={props.displayName} className="w-14 h-14 rounded-full object-cover" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-cms-accent flex items-center justify-center text-lg font-semibold text-white">
            {props.initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-cms-text">{props.displayName}</div>
          <div className="text-[11px] text-cms-text-dim font-mono">@{props.slug}</div>
          <StatusBadge variant={role.variant} label={role.label} className="mt-1" />
        </div>
      </div>

      {props.bio && (
        <p className="text-xs text-cms-text-muted line-clamp-2 mb-3">{props.bio}</p>
      )}

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-cms-border-subtle text-center">
        <div><div className="text-sm font-semibold text-cms-text">{props.postsCount}</div><div className="text-[10px] text-cms-text-dim">Posts</div></div>
        <div><div className="text-sm font-semibold text-cms-text">{props.publishedCount}</div><div className="text-[10px] text-cms-text-dim">Published</div></div>
        <div><div className="text-sm font-semibold text-cms-text">{props.campaignsCount}</div><div className="text-[10px] text-cms-text-dim">Campaigns</div></div>
      </div>

      <div className="flex items-center gap-1.5 mt-3 text-[10px] text-cms-text-dim">
        <span className={`w-2 h-2 rounded-full ${activityColor}`}></span>
        {props.lastActiveAt ? `Active ${formatRelativeTime(props.lastActiveAt)}` : 'Never logged in'}
      </div>
    </div>
  )
}

function getActivityColor(lastActive: string | null): string {
  if (!lastActive) return 'bg-[var(--cms-text-dim)]'
  const diff = Date.now() - new Date(lastActive).getTime()
  if (diff < 5 * 60 * 1000) return 'bg-cms-green shadow-[0_0_4px_var(--cms-green)]'
  if (diff < 7 * 86400000) return 'bg-cms-amber'
  return 'bg-[var(--cms-text-dim)]'
}

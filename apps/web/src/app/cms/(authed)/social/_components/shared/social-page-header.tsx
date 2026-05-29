import type { ReactNode } from 'react'

interface SocialPageHeaderProps {
  breadcrumb: ReactNode
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function SocialPageHeader({ breadcrumb, title, subtitle, actions }: SocialPageHeaderProps) {
  return (
    <div className="mb-6 space-y-2">
      {breadcrumb}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-fraunces text-2xl font-semibold text-cms-text">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-cms-text-muted">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  )
}

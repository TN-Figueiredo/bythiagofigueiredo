import Link from 'next/link'

interface Crumb {
  label: string
  href?: string
}

interface SocialBreadcrumbProps {
  crumbs: Crumb[]
}

export function SocialBreadcrumb({ crumbs }: SocialBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-cms-text-dim">/</span>}
          {crumb.href ? (
            <Link href={crumb.href} className="text-cms-text-muted hover:text-cms-text transition-colors">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-cms-text font-medium">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

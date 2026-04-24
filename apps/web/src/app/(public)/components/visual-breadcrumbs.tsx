import Link from 'next/link'

type BreadcrumbItem = { label: string; href?: string }

type Props = {
  items: BreadcrumbItem[]
}

export function VisualBreadcrumbs({ items }: Props) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="font-mono text-xs text-pb-muted mb-4"
    >
      <ol className="flex items-center gap-1 flex-wrap">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true" className="text-pb-faint">/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-pb-ink transition-colors">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-pb-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from './sidebar-context'

interface SidebarNavItem {
  icon: string
  label: string
  href: string
  badge?: string | number
  minRole?: 'reporter' | 'editor' | 'org_admin' | 'super_admin'
}

interface SidebarSection {
  label?: string
  items: SidebarNavItem[]
}

const ROLE_RANK: Record<string, number> = { reporter: 0, editor: 1, org_admin: 2, super_admin: 3 }

const SECTIONS: SidebarSection[] = [
  {
    label: 'Overview',
    items: [
      { icon: '📊', label: 'Dashboard', href: '/cms' },
      { icon: '📅', label: 'Schedule', href: '/cms/schedule' },
    ],
  },
  {
    label: 'Content',
    items: [
      { icon: '📝', label: 'Posts', href: '/cms/blog' },
      { icon: '📰', label: 'Newsletters', href: '/cms/newsletters', minRole: 'editor' },
      { icon: '📢', label: 'Campaigns', href: '/cms/campaigns', minRole: 'editor' },
    ],
  },
  {
    label: 'People',
    items: [
      { icon: '👤', label: 'Authors', href: '/cms/authors', minRole: 'editor' },
      { icon: '📧', label: 'Subscribers', href: '/cms/newsletters/subscribers', minRole: 'org_admin' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { icon: '📈', label: 'Analytics', href: '/cms/analytics', minRole: 'editor' },
    ],
  },
]

const SETTINGS_ITEM: SidebarNavItem = { icon: '⚙️', label: 'Settings', href: '/cms/settings', minRole: 'org_admin' }

interface CmsSidebarProps {
  siteName: string
  siteInitials: string
  userDisplayName: string
  userRole: string
  siteSwitcher?: React.ReactNode
}

function hasAccess(userRole: string, minRole?: string): boolean {
  if (!minRole) return true
  return (ROLE_RANK[userRole] ?? 0) >= (ROLE_RANK[minRole] ?? 0)
}

export function CmsSidebar({ siteName, siteInitials, userDisplayName, userRole, siteSwitcher }: CmsSidebarProps) {
  const { mode } = useSidebar()
  const pathname = usePathname()

  if (mode === 'mobile') return null

  const isCollapsed = mode === 'collapsed'

  const filteredSections = SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((item) => hasAccess(userRole, item.minRole)),
  })).filter((s) => s.items.length > 0)

  return (
    <aside
      className={`flex flex-col h-screen bg-cms-surface border-r border-cms-border transition-[width] duration-200 shrink-0 ${isCollapsed ? 'w-12' : 'w-[var(--cms-sidebar-w)]'}`}
    >
      {/* Brand */}
      <div className={`flex items-center gap-2.5 border-b border-cms-border ${isCollapsed ? 'justify-center py-3' : 'px-5 py-4'}`}>
        <div className="w-7 h-7 rounded-md bg-cms-accent flex items-center justify-center text-xs font-bold text-white shrink-0">
          {siteInitials}
        </div>
        {!isCollapsed && <span className="text-sm font-semibold text-cms-text truncate">{siteName}</span>}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-2">
        {filteredSections.map((section) => (
          <div key={section.label} className="py-1">
            {section.label && !isCollapsed && (
              <div className="px-5 py-1 text-[10px] uppercase tracking-[1.5px] text-cms-text-dim">
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const isActive = item.href === '/cms' ? pathname === '/cms' : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-2.5 text-[13px] transition-all duration-150
                    ${isCollapsed ? 'justify-center py-2 mx-1 rounded-md' : 'px-5 py-2'}
                    ${isActive
                      ? 'text-cms-accent bg-cms-accent-subtle'
                      : 'text-cms-text-muted hover:text-cms-text hover:bg-cms-surface-hover'
                    }`}
                >
                  {isActive && !isCollapsed && (
                    <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-sm bg-cms-accent" />
                  )}
                  <span className={`text-sm shrink-0 ${isCollapsed ? '' : 'w-[18px] text-center'}`}>{item.icon}</span>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                  {!isCollapsed && item.badge != null && (
                    <span className="ml-auto text-[11px] px-1.5 py-px rounded-full bg-cms-accent-subtle text-cms-accent font-medium">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
        {/* Settings divider + item (admin+ only) */}
        {hasAccess(userRole, SETTINGS_ITEM.minRole) && (
        <div className="border-t border-cms-border mt-2 pt-2">
          <Link
            href={SETTINGS_ITEM.href}
            className={`flex items-center gap-2.5 text-[13px] text-cms-text-dim transition-all duration-150 hover:text-cms-text hover:bg-cms-surface-hover
              ${isCollapsed ? 'justify-center py-2 mx-1 rounded-md' : 'px-5 py-2'}
              ${pathname.startsWith(SETTINGS_ITEM.href) ? 'text-cms-accent bg-cms-accent-subtle' : ''}`}
          >
            <span className={`text-sm shrink-0 ${isCollapsed ? '' : 'w-[18px] text-center'}`}>{SETTINGS_ITEM.icon}</span>
            {!isCollapsed && <span>{SETTINGS_ITEM.label}</span>}
          </Link>
        </div>
        )}
      </nav>

      {/* Site switcher slot */}
      {siteSwitcher && !isCollapsed && (
        <div className="border-t border-cms-border px-3 py-2">{siteSwitcher}</div>
      )}

      {/* User footer */}
      <div className={`border-t border-cms-border ${isCollapsed ? 'flex justify-center py-3' : 'px-3 py-3'}`}>
        <div className={`flex items-center gap-2.5 ${isCollapsed ? '' : 'px-2 py-1.5 rounded-[var(--cms-radius)]'}`}>
          <div className="w-7 h-7 rounded-full bg-cms-accent flex items-center justify-center text-[11px] font-semibold text-white shrink-0">
            {userDisplayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="flex-1 text-xs min-w-0">
              <div className="text-cms-text font-medium truncate">{userDisplayName}</div>
              <div className="text-cms-text-dim text-[10px]">{userRole}</div>
            </div>
          )}
          {!isCollapsed && (
            <form action="/cms/logout" method="POST">
              <button type="submit" className="text-cms-text-dim hover:text-cms-text text-xs transition-colors" title="Sign out">
                ↗
              </button>
            </form>
          )}
        </div>
      </div>
    </aside>
  )
}

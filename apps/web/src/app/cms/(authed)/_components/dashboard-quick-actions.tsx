'use client'

import Link from 'next/link'

interface QuickAction {
  title: string
  href: string
  gradient: string
  icon: string
}

const ACTIONS: QuickAction[] = [
  {
    title: 'Novo Post',
    href: '/cms/blog?action=new',
    gradient: 'from-indigo-600 to-violet-600',
    icon: 'P',
  },
  {
    title: 'Nova Edição',
    href: '/cms/newsletters?action=new',
    gradient: 'from-emerald-600 to-teal-600',
    icon: 'N',
  },
  {
    title: 'Item Pipeline',
    href: '/cms/pipeline?action=new',
    gradient: 'from-amber-600 to-orange-600',
    icon: 'I',
  },
]

export function DashboardQuickActions() {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      data-testid="quick-actions"
    >
      {ACTIONS.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className={`group flex items-center gap-3 rounded-xl bg-gradient-to-br ${action.gradient} p-4 shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]`}
          data-testid={`quick-action-${action.title.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20 text-sm font-bold text-white backdrop-blur-sm">
            {action.icon}
          </span>
          <span className="text-sm font-semibold text-white">
            {action.title}
          </span>
        </Link>
      ))}
    </div>
  )
}

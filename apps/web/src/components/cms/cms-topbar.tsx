'use client'

import { useSidebar } from './sidebar-context'

interface CmsTopbarProps {
  title: string
  actions?: React.ReactNode
}

export function CmsTopbar({ title, actions }: CmsTopbarProps) {
  const { mode } = useSidebar()

  if (mode === 'mobile') {
    return (
      <header className="flex items-center justify-between px-4 py-3 border-b border-cms-border bg-cms-surface">
        <h1 className="text-base font-semibold text-cms-text">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
    )
  }

  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-cms-border bg-cms-surface">
      <h1 className="text-lg font-semibold text-cms-text">{title}</h1>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </header>
  )
}

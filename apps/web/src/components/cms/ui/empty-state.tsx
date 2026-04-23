import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: string
  title: string
  description: string
  actions?: ReactNode
  hints?: Array<{ icon: string; title: string; description: string }>
}

export function EmptyState({ icon, title, description, actions, hints }: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-5">
      <div className="text-5xl mb-4 opacity-40">{icon}</div>
      <h3 className="text-base font-semibold text-cms-text mb-2">{title}</h3>
      <p className="text-[13px] text-cms-text-muted max-w-md mx-auto mb-5">{description}</p>
      {actions && <div className="flex gap-3 justify-center mb-6">{actions}</div>}
      {hints && hints.length > 0 && (
        <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto mt-2">
          {hints.map((h) => (
            <div key={h.title} className="p-4 bg-cms-bg border border-dashed border-cms-border rounded-[10px] text-center">
              <div className="text-xl mb-1.5">{h.icon}</div>
              <div className="text-xs font-medium mb-1">{h.title}</div>
              <div className="text-[11px] text-cms-text-dim">{h.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

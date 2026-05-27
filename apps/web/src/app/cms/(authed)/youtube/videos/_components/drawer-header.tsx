'use client'

interface DrawerHeaderProps {
  title: string
  optimizationState: string
  onClose: () => void
}

export function DrawerHeader({ title, optimizationState, onClose }: DrawerHeaderProps) {
  return (
    <div className="flex items-start justify-between border-b border-cms-border px-4 py-3">
      <div className="flex-1 pr-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-cms-text">{title}</h3>
        {optimizationState !== 'unflagged' && (
          <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
            {optimizationState}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded p-1 text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text"
        aria-label="Fechar drawer"
      >
        ✕
      </button>
    </div>
  )
}

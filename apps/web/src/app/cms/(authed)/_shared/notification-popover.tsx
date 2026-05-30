'use client'
export function NotificationPopover({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute top-[52px] right-0 w-[408px] z-50 bg-cms-surface border border-cms-border rounded-[10px] shadow-lg p-4">
      <p className="text-cms-text-muted text-sm">Popover placeholder</p>
      <button onClick={onClose} className="text-cms-accent text-sm mt-2">Fechar</button>
    </div>
  )
}

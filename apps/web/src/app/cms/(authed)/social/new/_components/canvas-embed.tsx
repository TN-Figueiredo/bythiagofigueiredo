'use client'

interface CanvasEmbedProps {
  thumbnailUrl: string | null
  onOpenEditor: () => void
}

export function CanvasEmbed({ thumbnailUrl, onOpenEditor }: CanvasEmbedProps) {
  return (
    <div className="rounded-xl border border-cms-border bg-cms-surface overflow-hidden">
      <div className="relative aspect-video bg-cms-bg">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="Canvas preview" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-cms-text-dim">
            Sem arte
          </div>
        )}
      </div>
      <div className="p-3">
        <button
          type="button"
          onClick={onOpenEditor}
          className="w-full rounded-lg border border-cms-border px-3 py-2 text-sm font-medium text-cms-text hover:bg-cms-bg transition-colors"
        >
          Abrir editor
        </button>
      </div>
    </div>
  )
}

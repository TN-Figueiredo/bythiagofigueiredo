'use client'

interface StoryFrame {
  id: string
  thumbnailUrl: string | null
}

interface StoryFramesStripProps {
  frames: StoryFrame[]
  activeFrameId: string
  onSelectFrame: (frameId: string) => void
  onAddFrame: () => void
  onRemoveFrame: (frameId: string) => void
}

export function StoryFramesStrip({
  frames, activeFrameId, onSelectFrame, onAddFrame, onRemoveFrame,
}: StoryFramesStripProps) {
  return (
    <div className="flex items-center gap-2 border-t border-cms-border bg-cms-bg px-4 py-3 overflow-x-auto" role="listbox" aria-label="Frames do story">
      {frames.map((frame, i) => (
        <div
          key={frame.id}
          className={`group relative h-16 w-9 shrink-0 overflow-hidden rounded-md border-2 cursor-pointer transition-colors ${
            frame.id === activeFrameId ? 'border-cms-accent' : 'border-cms-border hover:border-cms-text/30'
          }`}
          onClick={() => onSelectFrame(frame.id)}
          role="option"
          aria-selected={frame.id === activeFrameId}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectFrame(frame.id) } }}
        >
          {frame.thumbnailUrl ? (
            <img src={frame.thumbnailUrl} alt={`Frame ${i + 1}`} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-[8px] text-cms-text-dim">{i + 1}</span>
          )}

          {frames.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemoveFrame(frame.id) }}
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
              aria-label={`Remover frame ${i + 1}`}
            >
              x
            </button>
          )}
        </div>
      ))}

      {frames.length < 10 && (
        <button
          type="button"
          onClick={onAddFrame}
          className="flex h-16 w-9 shrink-0 items-center justify-center rounded-md border-2 border-dashed border-cms-border text-cms-text-muted hover:border-cms-text/30 hover:text-cms-text transition-colors"
          aria-label="Adicionar frame"
        >
          +
        </button>
      )}
    </div>
  )
}

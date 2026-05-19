'use client'
import type { CardComposition, CardElement, VideoElement } from '@tn-figueiredo/links/qr'
import { TextInspector } from '@tn-figueiredo/links-admin/qr-card-builder/text-inspector'
import { ImageInspector } from '@tn-figueiredo/links-admin/qr-card-builder/image-inspector'
import { MultiInspector } from '@tn-figueiredo/links-admin/qr-card-builder/multi-inspector'
import { NumberField, SliderField, SectionTitle } from '@tn-figueiredo/links-admin/qr-card-builder/inspector-field'
import { ColorPicker } from '@tn-figueiredo/links-admin/qr-card-builder/color-picker'

interface SocialRightPanelProps {
  composition: CardComposition
  selectedIds: Set<string>
  onUpdateElement: (id: string, patch: Partial<CardElement>) => void
  onRemoveElement: (id: string) => void
  onReplaceImage: (elementId: string) => void
  onReplaceVideo: (elementId: string) => void
  onSplash: (elementId: string) => void
  playingVideos?: Set<string>
  onToggleVideoPlay?: (elementId: string) => void
  videoDurations?: Map<string, number>
}

function formatTime(s: number): string {
  const total = Math.max(0, s)
  const m = Math.floor(total / 60)
  const sec = Math.floor(total % 60)
  const tenths = Math.floor((total % 1) * 10)
  return `${m}:${sec.toString().padStart(2, '0')}.${tenths}`
}

function VideoInspector({ element, onUpdate, onReplaceVideo, isPlaying, onTogglePlay, duration }: {
  element: VideoElement
  onUpdate: (patch: Partial<VideoElement>) => void
  onReplaceVideo: () => void
  isPlaying: boolean
  onTogglePlay: () => void
  duration: number
}) {
  const maxTime = duration > 0 ? duration : 60
  const startTime = element.startTime ?? 0
  const endTime = element.endTime ?? null

  return (
    <div className="space-y-2">
      <SectionTitle>Source</SectionTitle>
      <div className="h-14 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[11px] text-neutral-500">
        {duration > 0 ? `Video — ${formatTime(duration)}` : 'Video'}
      </div>
      <button type="button" onClick={onReplaceVideo} className="w-full py-1.5 border border-dashed border-neutral-600 rounded text-[11px] text-neutral-400 hover:border-neutral-400">
        Replace video
      </button>

      <SectionTitle>Transform</SectionTitle>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField label="X" value={element.x} onChange={v => onUpdate({ x: v })} unit="px" />
        <NumberField label="Y" value={element.y} onChange={v => onUpdate({ y: v })} unit="px" />
        <NumberField label="W" value={Math.round(element.width)} onChange={v => {
          if (element.maintainAspectRatio) {
            const ratio = element.height / element.width
            onUpdate({ width: v, height: Math.round(v * ratio) })
          } else {
            onUpdate({ width: v })
          }
        }} min={10} unit="px" />
        <NumberField label="H" value={Math.round(element.height)} onChange={v => {
          if (element.maintainAspectRatio) {
            const ratio = element.width / element.height
            onUpdate({ height: v, width: Math.round(v * ratio) })
          } else {
            onUpdate({ height: v })
          }
        }} min={10} unit="px" />
      </div>

      <SectionTitle>Appearance</SectionTitle>
      <SliderField label="Border Radius" value={element.borderRadius} onChange={v => onUpdate({ borderRadius: v })} min={0} max={100} format={v => `${v}px`} />
      <ColorPicker label="Border Color" value={element.borderColor} onChange={c => onUpdate({ borderColor: c })} />
      <SliderField label="Border Width" value={element.borderWidth} onChange={v => onUpdate({ borderWidth: v })} min={0} max={20} format={v => `${v}px`} />
      <SliderField label="Rotation" value={element.rotation} onChange={v => onUpdate({ rotation: v })} min={0} max={360} format={v => `${v}°`} />
      <SliderField label="Opacity" value={element.opacity * 100} onChange={v => onUpdate({ opacity: v / 100 })} min={0} max={100} format={v => `${Math.round(v)}%`} />

      <SectionTitle>Playback</SectionTitle>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pause video' : 'Play video'}
          title={isPlaying ? 'Pause (K)' : 'Play (K)'}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-neutral-600 bg-neutral-800 text-[11px] text-neutral-300 hover:bg-neutral-700 transition-colors"
        >
          {isPlaying ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><rect x="2" y="2" width="3" height="8" rx="0.5" fill="currentColor"/><rect x="7" y="2" width="3" height="8" rx="0.5" fill="currentColor"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 2l7 4-7 4V2z" fill="currentColor"/></svg>
          )}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          onClick={() => onUpdate({ muted: !element.muted })}
          aria-label={element.muted ? 'Unmute video' : 'Mute video'}
          title={element.muted ? 'Unmute' : 'Mute'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] transition-colors ${element.muted ? 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:bg-neutral-700' : 'border-blue-600/50 bg-blue-900/20 text-blue-300 hover:bg-blue-900/30'}`}
        >
          {element.muted ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 2L3 4.5H1v3h2L6 10V2z" fill="currentColor"/><path d="M9 4l-2 2m0 0l2 2m-2-2l-2 2m2-2L5 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 2L3 4.5H1v3h2L6 10V2z" fill="currentColor"/><path d="M8 4.5a2.5 2.5 0 010 3M9.5 3a4.5 4.5 0 010 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
          )}
          {element.muted ? 'Muted' : 'Sound'}
        </button>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-neutral-300">
        <input type="checkbox" checked={element.loop} onChange={e => onUpdate({ loop: e.target.checked })} className="rounded" />
        Loop
      </label>

      {duration > 0 && (
        <>
          <SectionTitle>Trim</SectionTitle>
          <SliderField
            label="Start"
            value={Math.round(startTime * 10) / 10}
            onChange={v => {
              const clamped = Math.max(0, Math.min(v, endTime != null ? endTime - 0.1 : maxTime))
              onUpdate({ startTime: clamped })
            }}
            min={0}
            max={Math.round(maxTime * 10) / 10}
            step={0.1}
            format={v => formatTime(v)}
          />
          <SliderField
            label="End"
            value={Math.round((endTime ?? maxTime) * 10) / 10}
            onChange={v => {
              const clamped = Math.max(startTime + 0.1, v)
              onUpdate({ endTime: clamped >= maxTime - 0.2 ? null : clamped })
            }}
            min={Math.round((startTime + 0.1) * 10) / 10}
            max={Math.round(maxTime * 10) / 10}
            step={0.1}
            format={v => formatTime(v)}
          />
          {(startTime > 0 || endTime != null) && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-neutral-500">
                Clip: {formatTime(Math.max(0, (endTime ?? duration) - startTime))}
              </span>
              <button
                type="button"
                onClick={() => onUpdate({ startTime: 0, endTime: null })}
                className="text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                Reset
              </button>
            </div>
          )}
        </>
      )}

      <SectionTitle>Options</SectionTitle>
      <label className="flex items-center gap-2 text-[11px] text-neutral-300">
        <input type="checkbox" checked={element.locked} onChange={e => onUpdate({ locked: e.target.checked })} className="rounded" />
        Lock position
      </label>
    </div>
  )
}

export function SocialRightPanel({
  composition, selectedIds,
  onUpdateElement, onRemoveElement, onReplaceImage, onReplaceVideo, onSplash,
  playingVideos, onToggleVideoPlay, videoDurations,
}: SocialRightPanelProps) {
  const selectedElements = composition.elements.filter(el => selectedIds.has(el.id))

  if (selectedElements.length === 0) {
    return (
      <aside className="w-[280px] shrink-0 bg-neutral-900 border-l border-neutral-800 p-3 overflow-y-auto">
        <div className="mt-8 text-center">
          <p className="text-[11px] text-neutral-500">Select an element to edit its properties</p>
          <p className="text-[10px] text-neutral-600 mt-2">Tip: Use the left panel to add text, images, or load a template</p>
        </div>
      </aside>
    )
  }

  if (selectedElements.length > 1) {
    return (
      <aside className="w-[280px] shrink-0 bg-neutral-900 border-l border-neutral-800 p-3 overflow-y-auto">
        <MultiInspector
          elements={selectedElements}
          onUpdateAll={patch => selectedElements.forEach(el => onUpdateElement(el.id, patch))}
          onDeleteAll={() => selectedElements.forEach(el => onRemoveElement(el.id))}
          onLockAll={() => selectedElements.forEach(el => onUpdateElement(el.id, { locked: true }))}
          onAlign={() => {}}
        />
      </aside>
    )
  }

  const element = selectedElements[0]!

  return (
    <aside className="w-[280px] shrink-0 bg-neutral-900 border-l border-neutral-800 p-3 overflow-y-auto">
      <h3 className="text-sm font-medium text-neutral-200 truncate mb-3">
        {element.name || (element.type === 'text' ? 'Text' : element.type === 'video' ? 'Video' : 'Image')}
      </h3>
      {element.type === 'text' && (
        <TextInspector
          element={element}
          onUpdate={patch => onUpdateElement(element.id, patch)}
        />
      )}
      {element.type === 'image' && (
        <>
          <ImageInspector
            element={element}
            onUpdate={patch => onUpdateElement(element.id, patch)}
            onReplaceImage={() => onReplaceImage(element.id)}
          />
          <button
            type="button"
            onClick={() => onSplash(element.id)}
            title="Place this media as a blurred full-screen background (Instagram-style)"
            className="w-full mt-2 py-1.5 rounded border border-purple-600/50 bg-purple-900/20 text-[11px] text-purple-300 hover:bg-purple-900/40"
          >
            Splash Background
          </button>
        </>
      )}
      {element.type === 'video' && (
        <>
          <VideoInspector
            element={element}
            onUpdate={patch => onUpdateElement(element.id, patch as Partial<CardElement>)}
            onReplaceVideo={() => onReplaceVideo(element.id)}
            isPlaying={playingVideos ? playingVideos.has(element.id) : true}
            onTogglePlay={() => onToggleVideoPlay?.(element.id)}
            duration={videoDurations?.get(element.id) ?? 0}
          />
          <button
            type="button"
            onClick={() => onSplash(element.id)}
            title="Place this media as a blurred full-screen background (Instagram-style)"
            className="w-full mt-2 py-1.5 rounded border border-purple-600/50 bg-purple-900/20 text-[11px] text-purple-300 hover:bg-purple-900/40"
          >
            Splash Background
          </button>
        </>
      )}
    </aside>
  )
}

'use client'
import type { ImageElement } from '@tn-figueiredo/links/qr'
import { ColorPicker } from './color-picker'
import { NumberField, SliderField, SectionTitle } from './inspector-field'

interface ImageInspectorProps {
  element: ImageElement
  onUpdate: (patch: Partial<ImageElement>) => void
  onReplaceImage: () => void
}

const FIT_OPTIONS = [
  { value: 'fill', label: 'Fill' },
  { value: 'cover', label: 'Cover' },
  { value: 'contain', label: 'Contain' },
  { value: 'stretch', label: 'Stretch' },
] as const

export function ImageInspector({ element, onUpdate, onReplaceImage }: ImageInspectorProps) {
  return (
    <div className="space-y-2">
      <SectionTitle>Source</SectionTitle>
      <div className="h-14 rounded bg-cover bg-center" style={{ backgroundImage: `url(${element.src})`, background: `url(${element.src}) center/cover no-repeat, var(--surface-2)`, border: '1px solid var(--line)' }} />
      <button
        type="button"
        onClick={onReplaceImage}
        className="w-full py-1.5 rounded text-[11px] hover:opacity-80"
        style={{ border: '1px dashed var(--line)', color: 'var(--ink-dim)' }}
      >
        Replace image
      </button>

      <SectionTitle>Transform</SectionTitle>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField label="X" value={element.x} onChange={v => onUpdate({ x: v })} unit="px" />
        <NumberField label="Y" value={element.y} onChange={v => onUpdate({ y: v })} unit="px" />
        <NumberField label="W" value={element.width} onChange={v => {
          if (element.maintainAspectRatio) {
            const ratio = element.height / element.width
            onUpdate({ width: v, height: v * ratio })
          } else {
            onUpdate({ width: v })
          }
        }} min={10} unit="px" />
        <NumberField label="H" value={element.height} onChange={v => {
          if (element.maintainAspectRatio) {
            const ratio = element.width / element.height
            onUpdate({ height: v, width: v * ratio })
          } else {
            onUpdate({ height: v })
          }
        }} min={10} unit="px" />
      </div>

      <SectionTitle>Object Fit</SectionTitle>
      <div className="flex gap-1">
        {FIT_OPTIONS.map(opt => {
          const isActive = element.objectFit === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onUpdate({ objectFit: opt.value })}
              className="flex-1 py-1 rounded text-[10px]"
              style={{
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--ink-dim)',
                border: isActive ? 'none' : '1px solid var(--line)',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      <SectionTitle>Appearance</SectionTitle>
      <SliderField label="Border Radius" value={element.borderRadius} onChange={v => onUpdate({ borderRadius: v })} min={0} max={100} format={v => `${v}px`} />
      <ColorPicker label="Border Color" value={element.borderColor} onChange={c => onUpdate({ borderColor: c })} />
      <SliderField label="Border Width" value={element.borderWidth} onChange={v => onUpdate({ borderWidth: v })} min={0} max={20} format={v => `${v}px`} />

      <SectionTitle>Display</SectionTitle>
      <SliderField label="Rotation" value={element.rotation} onChange={v => onUpdate({ rotation: v })} min={0} max={360} format={v => `${v}°`} />
      <SliderField label="Opacity" value={element.opacity * 100} onChange={v => onUpdate({ opacity: v / 100 })} min={0} max={100} format={v => `${Math.round(v)}%`} />

      <SectionTitle>Options</SectionTitle>
      <label className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--ink)' }}>
        <input type="checkbox" checked={element.locked} onChange={e => onUpdate({ locked: e.target.checked })} className="rounded" />
        Lock position
      </label>
      <label className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--ink)' }}>
        <input type="checkbox" checked={element.maintainAspectRatio} onChange={e => onUpdate({ maintainAspectRatio: e.target.checked })} className="rounded" />
        Maintain aspect ratio
      </label>
    </div>
  )
}

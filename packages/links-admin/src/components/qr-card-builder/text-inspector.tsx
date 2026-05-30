'use client'
import { useEffect, useRef, useState } from 'react'
import { AlignLeft, AlignCenter, AlignRight, ChevronDown } from 'lucide-react'
import { FONT_CATEGORIES } from '@tn-figueiredo/links/qr'
import type { TextElement, FontCategory } from '@tn-figueiredo/links/qr'
import { ColorPicker } from './color-picker'
import { NumberField, SliderField, SectionTitle } from './inspector-field'

const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?'

function useFontLoader(fontFamily: string) {
  useEffect(() => {
    if (!fontFamily || fontFamily === 'Inter') return
    const id = `qr-font-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = `${GOOGLE_FONTS_URL}family=${encodeURIComponent(fontFamily)}:wght@100;200;300;400;500;600;700;800;900&display=swap`
    document.head.appendChild(link)
  }, [fontFamily])
}

const CATEGORY_LABELS: Record<FontCategory, string> = {
  'sans-serif': 'Sans Serif',
  'serif': 'Serif',
  'display': 'Display',
  'handwriting': 'Handwriting',
  'monospace': 'Monospace',
}

function FontPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useFontLoader(value)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded px-2 py-1.5 text-[11px] hover:opacity-90"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
      >
        <span style={{ fontFamily: value }}>{value}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--ink-dim)' }} />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded shadow-xl max-h-[320px] overflow-y-auto" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
          {(Object.keys(FONT_CATEGORIES) as FontCategory[]).map(cat => (
            <div key={cat}>
              <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider sticky top-0" style={{ color: 'var(--ink-dim)', background: 'var(--surface-2)' }}>
                {CATEGORY_LABELS[cat]}
              </div>
              {FONT_CATEGORIES[cat].map(font => (
                <FontOption key={font} font={font} selected={value === font} onSelect={() => { onChange(font); setOpen(false) }} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FontOption({ font, selected, onSelect }: { font: string; selected: boolean; onSelect: () => void }) {
  useFontLoader(font)
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left px-2 py-1.5 text-[12px] hover:opacity-80"
      style={{
        fontFamily: font,
        background: selected ? 'var(--accent-soft)' : 'transparent',
        color: selected ? 'var(--accent)' : 'var(--ink)',
      }}
    >
      {font}
    </button>
  )
}

interface TextInspectorProps {
  element: TextElement
  onUpdate: (patch: Partial<TextElement>) => void
}

export function TextInspector({ element, onUpdate }: TextInspectorProps) {
  useFontLoader(element.fontFamily)

  return (
    <div className="space-y-2">
      <SectionTitle>Content</SectionTitle>
      <textarea
        value={element.content}
        onChange={e => onUpdate({ content: e.target.value })}
        rows={3}
        className="w-full rounded px-2 py-1.5 text-[12px] resize-y"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
      />

      <SectionTitle>Transform</SectionTitle>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField label="X" value={element.x} onChange={v => onUpdate({ x: v })} unit="px" />
        <NumberField label="Y" value={element.y} onChange={v => onUpdate({ y: v })} unit="px" />
        <NumberField label="W" value={element.width} onChange={v => onUpdate({ width: v })} min={20} unit="px" />
      </div>

      <SectionTitle>Typography</SectionTitle>
      <div>
        <span className="text-[10px]" style={{ color: 'var(--ink-dim)' }}>Font</span>
        <FontPicker value={element.fontFamily} onChange={v => onUpdate({ fontFamily: v })} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField label="Size" value={element.fontSize} onChange={v => onUpdate({ fontSize: v })} min={8} max={400} unit="px" />
        <NumberField label="Wt" value={element.fontWeight} onChange={v => onUpdate({ fontWeight: v })} min={100} max={900} step={100} />
      </div>
      <NumberField label="LH" value={element.lineHeight} onChange={v => onUpdate({ lineHeight: v })} min={0.5} max={3} step={0.1} />
      <div className="flex items-center gap-1">
        <span className="text-[10px] w-6" style={{ color: 'var(--ink-dim)' }}>Align</span>
        {(['left', 'center', 'right'] as const).map(a => (
          <button
            key={a}
            type="button"
            onClick={() => onUpdate({ align: a })}
            className="p-1 rounded"
            style={{
              background: element.align === a ? 'var(--accent-soft)' : 'transparent',
              color: element.align === a ? 'var(--accent)' : 'var(--ink-dim)',
            }}
          >
            {a === 'left' ? <AlignLeft size={14} /> : a === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--ink)' }}>
        <input type="checkbox" checked={element.uppercase} onChange={e => onUpdate({ uppercase: e.target.checked })} className="rounded" />
        Uppercase
      </label>

      <SectionTitle>Color</SectionTitle>
      <ColorPicker label="Text color" value={element.color} onChange={c => onUpdate({ color: c })} />
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--ink)' }}>
          <input
            type="checkbox"
            checked={element.backgroundColor !== null}
            onChange={e => onUpdate({ backgroundColor: e.target.checked ? '#00000099' : null })}
            className="rounded"
          />
          Background
        </label>
        {element.backgroundColor !== null && (
          <>
            <ColorPicker label="BG color" value={element.backgroundColor} onChange={c => onUpdate({ backgroundColor: c })} />
            <SliderField label="Padding" value={element.backgroundPadding ?? 8} onChange={v => onUpdate({ backgroundPadding: v })} min={0} max={40} format={v => `${v}px`} />
            <SliderField label="Radius" value={element.backgroundRadius ?? 4} onChange={v => onUpdate({ backgroundRadius: v })} min={0} max={30} format={v => `${v}px`} />
          </>
        )}
      </div>

      <SectionTitle>Display</SectionTitle>
      <SliderField label="Rotation" value={element.rotation} onChange={v => onUpdate({ rotation: v })} min={0} max={360} format={v => `${v}°`} />
      <SliderField label="Opacity" value={element.opacity * 100} onChange={v => onUpdate({ opacity: v / 100 })} min={0} max={100} format={v => `${Math.round(v)}%`} />

      <SectionTitle>Options</SectionTitle>
      <label className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--ink)' }}>
        <input type="checkbox" checked={element.locked} onChange={e => onUpdate({ locked: e.target.checked })} className="rounded" />
        Lock position
      </label>
    </div>
  )
}

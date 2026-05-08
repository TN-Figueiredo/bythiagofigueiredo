'use client'
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { AVAILABLE_FONTS } from '@tn-figueiredo/links/qr'
import type { TextElement } from '@tn-figueiredo/links/qr'
import { ColorPicker } from './color-picker'
import { NumberField, SliderField, SectionTitle } from './inspector-field'

interface TextInspectorProps {
  element: TextElement
  onUpdate: (patch: Partial<TextElement>) => void
}

export function TextInspector({ element, onUpdate }: TextInspectorProps) {
  return (
    <div className="space-y-2">
      <SectionTitle>Content</SectionTitle>
      <textarea
        value={element.content}
        onChange={e => onUpdate({ content: e.target.value })}
        rows={3}
        className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-[12px] text-neutral-200 resize-y"
      />

      <SectionTitle>Transform</SectionTitle>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField label="X" value={element.x} onChange={v => onUpdate({ x: v })} unit="px" />
        <NumberField label="Y" value={element.y} onChange={v => onUpdate({ y: v })} unit="px" />
        <NumberField label="W" value={element.width} onChange={v => onUpdate({ width: v })} min={20} unit="px" />
      </div>

      <SectionTitle>Typography</SectionTitle>
      <div>
        <span className="text-[10px] text-neutral-400">Font</span>
        <select
          value={element.fontFamily}
          onChange={e => onUpdate({ fontFamily: e.target.value })}
          className="w-full mt-0.5 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-1 text-[11px] text-neutral-200"
        >
          {AVAILABLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField label="Size" value={element.fontSize} onChange={v => onUpdate({ fontSize: v })} min={8} max={400} unit="px" />
        <NumberField label="Wt" value={element.fontWeight} onChange={v => onUpdate({ fontWeight: v })} min={100} max={900} step={100} />
      </div>
      <NumberField label="LH" value={element.lineHeight} onChange={v => onUpdate({ lineHeight: v })} min={0.5} max={3} step={0.1} />
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-neutral-400 w-6">Align</span>
        {(['left', 'center', 'right'] as const).map(a => (
          <button
            key={a}
            type="button"
            onClick={() => onUpdate({ align: a })}
            className={`p-1 rounded ${element.align === a ? 'bg-blue-600/30 text-blue-300' : 'text-neutral-400 hover:text-white'}`}
          >
            {a === 'left' ? <AlignLeft size={14} /> : a === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[11px] text-neutral-300">
        <input type="checkbox" checked={element.uppercase} onChange={e => onUpdate({ uppercase: e.target.checked })} className="rounded" />
        Uppercase
      </label>

      <SectionTitle>Color</SectionTitle>
      <ColorPicker label="Text color" value={element.color} onChange={c => onUpdate({ color: c })} />

      <SectionTitle>Display</SectionTitle>
      <SliderField label="Rotation" value={element.rotation} onChange={v => onUpdate({ rotation: v })} min={0} max={360} format={v => `${v}°`} />
      <SliderField label="Opacity" value={element.opacity * 100} onChange={v => onUpdate({ opacity: v / 100 })} min={0} max={100} format={v => `${Math.round(v)}%`} />

      <SectionTitle>Options</SectionTitle>
      <label className="flex items-center gap-2 text-[11px] text-neutral-300">
        <input type="checkbox" checked={element.locked} onChange={e => onUpdate({ locked: e.target.checked })} className="rounded" />
        Lock position
      </label>
    </div>
  )
}

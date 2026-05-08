'use client'
import { Copy } from 'lucide-react'
import type { QrElement } from '@tn-figueiredo/links/qr'
import { ColorPicker } from './color-picker'
import { NumberField, SliderField, SectionTitle } from './inspector-field'

interface QrInspectorProps {
  element: QrElement
  shortUrl: string
  linkCode: string
  onUpdate: (patch: Partial<QrElement>) => void
}

export function QrInspector({ element, shortUrl, linkCode, onUpdate }: QrInspectorProps) {
  return (
    <div className="space-y-2">
      <SectionTitle>Encoded URL</SectionTitle>
      <div className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 flex items-center gap-1.5">
        <span className="flex-1 text-[11px] font-mono text-neutral-300 truncate">{shortUrl}</span>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(shortUrl)}
          className="p-0.5 text-neutral-500 hover:text-white"
          title="Copy URL"
        >
          <Copy size={12} />
        </button>
      </div>
      <div className="text-[9px] text-neutral-500">From link: {linkCode}</div>

      <SectionTitle>Transform</SectionTitle>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField label="X" value={element.x} onChange={v => onUpdate({ x: v })} unit="px" />
        <NumberField label="Y" value={element.y} onChange={v => onUpdate({ y: v })} unit="px" />
        <NumberField label="W" value={element.width} onChange={v => onUpdate({ width: v, height: v })} min={20} unit="px" />
        <NumberField label="H" value={element.height} onChange={v => onUpdate({ width: v, height: v })} min={20} unit="px" />
      </div>

      <SectionTitle>QR Appearance</SectionTitle>
      <ColorPicker label="Foreground" value={element.foregroundColor} onChange={c => onUpdate({ foregroundColor: c })} />
      <ColorPicker label="Background" value={element.backgroundColor} onChange={c => onUpdate({ backgroundColor: c })} />
      <div>
        <span className="text-[10px] text-neutral-400">Error Correction</span>
        <select
          value={element.errorCorrection}
          onChange={e => onUpdate({ errorCorrection: e.target.value as 'L' | 'M' | 'Q' | 'H' })}
          className="w-full mt-0.5 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-1 text-[11px] text-neutral-200"
        >
          <option value="L">L (7%)</option>
          <option value="M">M (15%)</option>
          <option value="Q">Q (25%)</option>
          <option value="H">H (30%)</option>
        </select>
      </div>
      <SliderField label="Corner Radius" value={element.cornerRadius} onChange={v => onUpdate({ cornerRadius: v })} min={0} max={20} format={v => `${v}px`} />

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

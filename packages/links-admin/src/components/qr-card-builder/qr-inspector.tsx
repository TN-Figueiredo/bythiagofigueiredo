'use client'
import { useMemo } from 'react'
import { Copy } from 'lucide-react'
import type { QrElement, QrDotStyle } from '@tn-figueiredo/links/qr'
import { QR_DOT_STYLES } from '@tn-figueiredo/links/qr'
import { ColorPicker } from './color-picker'
import { NumberField, SliderField, SectionTitle } from './inspector-field'
import { generateStyledQrSvg } from './qr-styled-svg'

interface QrInspectorProps {
  element: QrElement
  shortUrl: string
  linkCode: string
  onUpdate: (patch: Partial<QrElement>) => void
}

const STYLE_LABELS: Record<QrDotStyle, string> = {
  square: 'Square',
  dots: 'Dots',
  rounded: 'Rounded',
  classy: 'Classy',
}

export function QrInspector({ element, shortUrl, linkCode, onUpdate }: QrInspectorProps) {
  const stylePreviews = useMemo(() => {
    const previews: Record<string, string> = {}
    for (const s of QR_DOT_STYLES) {
      const svg = generateStyledQrSvg(shortUrl, element.foregroundColor, element.backgroundColor, element.errorCorrection, s, 64)
      previews[s] = `data:image/svg+xml,${encodeURIComponent(svg)}`
    }
    return previews
  }, [shortUrl, element.foregroundColor, element.backgroundColor, element.errorCorrection])

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
        {element.showLogo && element.errorCorrection !== 'H' && (
          <p className="text-[9px] text-amber-400 mt-0.5">Auto-elevated to H for logo visibility</p>
        )}
      </div>
      <div>
        <span className="text-[10px] text-neutral-400">Dot Style</span>
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {QR_DOT_STYLES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => onUpdate({ dotStyle: s })}
              className={`flex flex-col items-center gap-1 p-1.5 rounded border ${
                (element.dotStyle ?? 'square') === s
                  ? 'border-blue-500 bg-blue-600/10'
                  : 'border-neutral-700 hover:border-neutral-600'
              }`}
            >
              <img src={stylePreviews[s]} alt={s} className="w-8 h-8 rounded-sm" />
              <span className={`text-[9px] ${(element.dotStyle ?? 'square') === s ? 'text-blue-300' : 'text-neutral-500'}`}>
                {STYLE_LABELS[s]}
              </span>
            </button>
          ))}
        </div>
      </div>
      <SliderField label="Corner Radius" value={element.cornerRadius} onChange={v => onUpdate({ cornerRadius: v })} min={0} max={50} format={v => `${v}px`} />
      <SliderField label="Padding" value={element.padding} onChange={v => onUpdate({ padding: v })} min={0} max={40} format={v => `${v}px`} />

      <SectionTitle>Logo</SectionTitle>
      <label className="flex items-center gap-2 text-[11px] text-neutral-300">
        <input
          type="checkbox"
          checked={element.showLogo}
          onChange={e => onUpdate({ showLogo: e.target.checked })}
          className="rounded"
        />
        Show site logo
      </label>
      {element.showLogo && (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <SliderField label="Top" value={element.logoPadTop ?? 10} onChange={v => onUpdate({ logoPadTop: v })} min={0} max={60} format={v => `${v}px`} />
            <SliderField label="Bottom" value={element.logoPadBottom ?? 14} onChange={v => onUpdate({ logoPadBottom: v })} min={0} max={60} format={v => `${v}px`} />
            <SliderField label="Left" value={element.logoPadLeft ?? 12} onChange={v => onUpdate({ logoPadLeft: v })} min={0} max={60} format={v => `${v}px`} />
            <SliderField label="Right" value={element.logoPadRight ?? 8} onChange={v => onUpdate({ logoPadRight: v })} min={0} max={60} format={v => `${v}px`} />
          </div>
          <button
            type="button"
            onClick={() => onUpdate({ logoPadTop: 10, logoPadRight: 8, logoPadBottom: 14, logoPadLeft: 12 })}
            className="text-[9px] text-neutral-500 hover:text-neutral-300 underline"
          >
            Reset padding
          </button>
        </>
      )}

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

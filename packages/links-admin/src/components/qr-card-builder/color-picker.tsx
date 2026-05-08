'use client'
import { useState, useCallback, useRef, useEffect } from 'react'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  palette?: string[]
  label?: string
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1, 7), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  const v = max
  const s = max === 0 ? 0 : d / max
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return { h, s, v }
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  let r = 0, g = 0, b = 0
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

export function ColorSwatch({ color, onClick, size = 24 }: { color: string; onClick?: () => void; size?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-neutral-600 shrink-0"
      style={{ width: size, height: size, backgroundColor: color }}
      aria-label={`Color ${color}`}
    />
  )
}

export function ColorPicker({ value, onChange, palette = [], label }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const rgb = hexToRgb(value)
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
  const [hue, setHue] = useState(hsv.h)
  const [hexInput, setHexInput] = useState(value)

  useEffect(() => {
    setHexInput(value)
    const rgb2 = hexToRgb(value)
    const hsv2 = rgbToHsv(rgb2.r, rgb2.g, rgb2.b)
    if (hsv2.s > 0.01 || hsv2.v > 0.01) setHue(hsv2.h)
  }, [value])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleSvClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height))
    const { r, g, b } = hsvToRgb(hue, s, v)
    onChange(rgbToHex(r, g, b))
  }, [hue, onChange])

  const handleHueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const h = Number(e.target.value) / 360
    setHue(h)
    const { r, g, b } = hsvToRgb(h, hsv.s, hsv.v)
    onChange(rgbToHex(r, g, b))
  }, [hsv.s, hsv.v, onChange])

  const handleHexSubmit = useCallback(() => {
    if (/^#[0-9a-fA-F]{6}$/.test(hexInput)) {
      onChange(hexInput.toLowerCase())
    } else {
      setHexInput(value)
    }
  }, [hexInput, onChange, value])

  return (
    <div className="relative">
      {label && <div className="text-[10px] text-neutral-400 mb-1">{label}</div>}
      <div className="flex items-center gap-2">
        <ColorSwatch color={value} onClick={() => setOpen(!open)} />
        <input
          type="text"
          value={hexInput}
          onChange={e => setHexInput(e.target.value)}
          onBlur={handleHexSubmit}
          onKeyDown={e => e.key === 'Enter' && handleHexSubmit()}
          className="w-[72px] bg-neutral-800 border border-neutral-600 rounded px-1.5 py-0.5 text-[11px] font-mono text-neutral-200"
          aria-label={label ? `${label} hex value` : 'Color hex value'}
        />
      </div>
      {open && (
        <div
          ref={popoverRef}
          className="absolute z-50 top-full left-0 mt-1 bg-neutral-900 border border-neutral-700 rounded-lg p-3 shadow-xl"
          style={{ width: 220 }}
        >
          <div
            className="relative w-full h-[140px] rounded cursor-crosshair mb-2"
            style={{
              background: `linear-gradient(to right, #fff, hsl(${hue * 360}, 100%, 50%))`,
            }}
            onClick={handleSvClick}
          >
            <div className="absolute inset-0 rounded" style={{ background: 'linear-gradient(to top, #000, transparent)' }} />
            <div
              className="absolute w-3 h-3 rounded-full border-2 border-white shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={360}
            value={Math.round(hue * 360)}
            onChange={handleHueChange}
            className="w-full h-3 mb-2 rounded appearance-none"
            style={{
              background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            }}
            aria-label="Hue"
          />
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-neutral-500">HEX</span>
            <input
              type="text"
              value={hexInput}
              onChange={e => setHexInput(e.target.value)}
              onBlur={handleHexSubmit}
              onKeyDown={e => e.key === 'Enter' && handleHexSubmit()}
              className="flex-1 bg-neutral-800 border border-neutral-600 rounded px-1.5 py-0.5 text-[11px] font-mono text-neutral-200"
            />
          </div>
          {palette.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2 border-t border-neutral-700">
              {palette.map(c => (
                <ColorSwatch key={c} color={c} size={20} onClick={() => onChange(c)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

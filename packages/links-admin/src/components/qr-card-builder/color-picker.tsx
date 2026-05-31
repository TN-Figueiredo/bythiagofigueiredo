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
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        border: '1px solid var(--line-strong, #3a3630)',
        borderRadius: 6,
        flexShrink: 0,
      }}
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
    <div style={{ position: 'relative' }}>
      {label && <div style={{ marginBottom: 4, fontSize: 10, color: 'var(--ink-dim, #A39C8E)' }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ColorSwatch color={value} onClick={() => setOpen(!open)} />
        <input
          type="text"
          value={hexInput}
          onChange={e => setHexInput(e.target.value)}
          onBlur={handleHexSubmit}
          onKeyDown={e => e.key === 'Enter' && handleHexSubmit()}
          style={{
            width: 72,
            borderRadius: 6,
            padding: '2px 6px',
            fontFamily: 'monospace',
            fontSize: 11,
            background: 'var(--surface-2, #272219)',
            border: '1px solid var(--line-strong, #3a3630)',
            color: 'var(--ink, #ECE6DA)',
          }}
          aria-label={label ? `${label} hex value` : 'Color hex value'}
        />
      </div>
      {open && (
        <div
          ref={popoverRef}
          style={{
            position: 'absolute',
            zIndex: 50,
            top: '100%',
            left: 0,
            marginTop: 4,
            borderRadius: 8,
            padding: 12,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2)',
            width: 220,
            background: 'var(--surface, #161410)',
            border: '1px solid var(--line-strong, #3a3630)',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 140,
              borderRadius: 6,
              cursor: 'crosshair',
              marginBottom: 8,
              background: `linear-gradient(to right, #fff, hsl(${hue * 360}, 100%, 50%))`,
            }}
            onClick={handleSvClick}
          >
            <div style={{ position: 'absolute', inset: 0, borderRadius: 6, background: 'linear-gradient(to top, #000, transparent)' }} />
            <div
              style={{
                position: 'absolute',
                width: 12,
                height: 12,
                borderRadius: '50%',
                border: '2px solid white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
              }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={360}
            value={Math.round(hue * 360)}
            onChange={handleHueChange}
            style={{
              width: '100%',
              height: 12,
              marginBottom: 8,
              borderRadius: 6,
              appearance: 'none',
              WebkitAppearance: 'none',
              background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            }}
            aria-label="Hue"
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--ink-dim, #A39C8E)' }}>HEX</span>
            <input
              type="text"
              value={hexInput}
              onChange={e => setHexInput(e.target.value)}
              onBlur={handleHexSubmit}
              onKeyDown={e => e.key === 'Enter' && handleHexSubmit()}
              style={{
                flex: 1,
                borderRadius: 6,
                padding: '2px 6px',
                fontFamily: 'monospace',
                fontSize: 11,
                background: 'var(--surface-2, #272219)',
                border: '1px solid var(--line-strong, #3a3630)',
                color: 'var(--ink, #ECE6DA)',
              }}
            />
          </div>
          {palette.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingTop: 8, borderTop: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
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

'use client'
import { useEffect, useRef, useState } from 'react'
import { AlignLeft, AlignCenter, AlignRight, Move } from 'lucide-react'
import { FONT_CATEGORIES, BG_PALETTE } from '@tn-figueiredo/links/qr'
import type { TextElement, FontCategory } from '@tn-figueiredo/links/qr'
import { ColorPicker } from './color-picker'
import { SliderField } from './inspector-field'

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

const QUICK_FONTS = [
  { short: 'Frau', full: 'Fraunces' },
  { short: 'Inte', full: 'Inter' },
  { short: 'JetB', full: 'JetBrains Mono' },
]

const PALETTE = [...BG_PALETTE]

const labelStyle: React.CSSProperties = {
  fontSize: '11.5px', color: 'var(--ink-dim)', marginBottom: 6,
}

const pillBar: React.CSSProperties = {
  display: 'inline-flex', background: 'var(--surface-2)',
  borderRadius: 9, padding: 3, gap: 2,
}

function pillBtn(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '5px 10px', borderRadius: 7,
    border: 'none', fontSize: 12, fontWeight: 600,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'var(--pb-ink-on-accent, #1A140C)' : 'var(--ink-dim)',
    cursor: 'pointer', transition: '0.15s',
  }
}

interface TextInspectorProps {
  element: TextElement
  onUpdate: (patch: Partial<TextElement>) => void
}

export function TextInspector({ element, onUpdate }: TextInspectorProps) {
  useFontLoader(element.fontFamily)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Conteúdo ── */}
      <div>
        <div style={labelStyle}>Conteúdo</div>
        <textarea
          value={element.content}
          onChange={e => onUpdate({ content: e.target.value })}
          style={{
            width: '100%', minHeight: 60,
            background: 'var(--surface)', border: '1px solid var(--line-strong)',
            borderRadius: 8, padding: '9px 11px',
            color: 'var(--ink)', fontSize: 13, resize: 'vertical', lineHeight: 1.4,
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* ── Fonte (quick-pick pills) ── */}
      <div>
        <div style={labelStyle}>Fonte</div>
        <div style={pillBar}>
          {QUICK_FONTS.map(f => (
            <button
              key={f.full}
              type="button"
              onClick={() => onUpdate({ fontFamily: f.full })}
              style={pillBtn(element.fontFamily === f.full)}
            >
              {f.short}
            </button>
          ))}
        </div>
        <FullFontPicker value={element.fontFamily} onChange={v => onUpdate({ fontFamily: v })} />
      </div>

      {/* ── Tamanho ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '11.5px', color: 'var(--ink-dim)' }}>Tamanho</span>
          <span className="mono" style={{ fontSize: 11 }}>{element.fontSize}px</span>
        </div>
        <input
          type="range" min={18} max={140}
          value={element.fontSize}
          onChange={e => onUpdate({ fontSize: Number(e.target.value) })}
          style={{ width: '100%' }}
        />
      </div>

      {/* ── Cor (palette swatches) ── */}
      <div>
        <div style={labelStyle}>Cor</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PALETTE.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => onUpdate({ color: c })}
              style={{
                width: 26, height: 26, borderRadius: 7,
                background: c,
                border: element.color.toLowerCase() === c.toLowerCase()
                  ? '2px solid var(--accent)'
                  : '1px solid var(--line-strong)',
                cursor: 'pointer', padding: 0,
              }}
            />
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <ColorPicker label="" value={element.color} onChange={c => onUpdate({ color: c })} />
        </div>
      </div>

      {/* ── Alinhamento ── */}
      <div>
        <div style={labelStyle}>Alinhamento</div>
        <div style={pillBar}>
          {(['left', 'center', 'right'] as const).map(a => (
            <button
              key={a}
              type="button"
              onClick={() => onUpdate({ align: a })}
              style={pillBtn(element.align === a)}
            >
              {a === 'left' ? '←' : a === 'center' ? '↔' : '→'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Peso + Entrelinha (compact) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <SliderField label="Peso" value={element.fontWeight} onChange={v => onUpdate({ fontWeight: v })} min={100} max={900} step={100} format={v => `${v}`} />
        <SliderField label="Entrelinha" value={element.lineHeight} onChange={v => onUpdate({ lineHeight: v })} min={0.5} max={3} step={0.1} format={v => `${v.toFixed(1)}`} />
      </div>

      {/* ── Opções compactas ── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink)', cursor: 'pointer' }}>
          <input type="checkbox" checked={element.uppercase} onChange={e => onUpdate({ uppercase: e.target.checked })} />
          Maiúsculas
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink)', cursor: 'pointer' }}>
          <input type="checkbox" checked={element.locked} onChange={e => onUpdate({ locked: e.target.checked })} />
          Travar
        </label>
      </div>

      {/* ── Display sliders ── */}
      <SliderField label="Rotação" value={element.rotation} onChange={v => onUpdate({ rotation: v })} min={0} max={360} format={v => `${v}°`} />
      <SliderField label="Opacidade" value={element.opacity * 100} onChange={v => onUpdate({ opacity: v / 100 })} min={0} max={100} format={v => `${Math.round(v)}%`} />

      {/* ── Hint ── */}
      <div style={{
        marginTop: 4, paddingTop: 14,
        borderTop: '1px solid var(--line)',
        display: 'flex', gap: 7, alignItems: 'center',
        fontSize: 11, color: 'var(--ink-faint)',
      }}>
        <Move size={13} strokeWidth={1.7} />
        Arraste no canvas pra mover · alça laranja pra redimensionar
      </div>
    </div>
  )
}

/* ── Full font picker (expandable dropdown below quick pills) ── */

const CATEGORY_LABELS: Record<FontCategory, string> = {
  'sans-serif': 'Sans Serif',
  'serif': 'Serif',
  'display': 'Display',
  'handwriting': 'Handwriting',
  'monospace': 'Monospace',
}

function FullFontPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const isQuickFont = QUICK_FONTS.some(f => f.full === value)

  return (
    <div ref={ref} style={{ position: 'relative', marginTop: 6 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', borderRadius: 7, fontSize: 11.5,
          background: 'var(--surface-2)', border: '1px solid var(--line)',
          color: isQuickFont ? 'var(--ink-dim)' : 'var(--ink)',
          fontFamily: value, cursor: 'pointer',
        }}
      >
        <span>{value}</span>
        <span style={{ fontSize: 9, color: 'var(--ink-faint)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0,
          marginTop: 4, maxHeight: 280, overflowY: 'auto',
          background: 'var(--surface)', border: '1px solid var(--line-strong)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}>
          {(Object.keys(FONT_CATEGORIES) as FontCategory[]).map(cat => (
            <div key={cat}>
              <div style={{
                padding: '6px 10px', fontSize: 9, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'var(--ink-dim)', background: 'var(--surface)',
                position: 'sticky', top: 0,
              }}>
                {CATEGORY_LABELS[cat]}
              </div>
              {FONT_CATEGORIES[cat].map(font => (
                <FontRow key={font} font={font} selected={value === font} onSelect={() => { onChange(font); setOpen(false) }} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FontRow({ font, selected, onSelect }: { font: string; selected: boolean; onSelect: () => void }) {
  useFontLoader(font)
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: '100%', textAlign: 'left', padding: '6px 10px',
        fontSize: 12, fontFamily: font, border: 'none',
        background: selected ? 'var(--accent-soft)' : 'transparent',
        color: selected ? 'var(--accent)' : 'var(--ink)',
        cursor: 'pointer',
      }}
    >
      {font}
    </button>
  )
}

'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  AlignLeft, AlignCenter, AlignRight, Move, Type,
  Copy, Lock, Trash2, RotateCcw, Circle,
} from 'lucide-react'
import { FONT_CATEGORIES, BG_PALETTE } from '@tn-figueiredo/links/qr'
import type { TextElement, FontCategory } from '@tn-figueiredo/links/qr'
import { ToggleSwitch, PositionInput } from './inspector-field'
import { labelStyle, actionBtnStyle, pillBar, pillBtn, inputBoxStyle, hintStyle, sectionDivider, sectionLabel } from './inspector-styles'

/* ── Google Fonts loader ── */

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

/* ── Constants ── */

const QUICK_FONTS = [
  { short: 'Frau', full: 'Fraunces' },
  { short: 'Inte', full: 'Inter' },
  { short: 'JetB', full: 'JetBrains Mono' },
]

const PALETTE = [...BG_PALETTE]

/* ── Props ── */

interface TextInspectorProps {
  element: TextElement
  onUpdate: (patch: Partial<TextElement>) => void
  onDuplicate?: () => void
  onDelete?: () => void
}

/* ── Component ── */

export function TextInspector({ element, onUpdate, onDuplicate, onDelete }: TextInspectorProps) {
  useFontLoader(element.fontFamily)

  const [hexInput, setHexInput] = useState(element.color)
  useEffect(() => { setHexInput(element.color) }, [element.color])

  const commitHex = useCallback(() => {
    if (/^#[0-9a-fA-F]{6}$/.test(hexInput)) {
      onUpdate({ color: hexInput.toLowerCase() })
    } else {
      setHexInput(element.color)
    }
  }, [hexInput, element.color, onUpdate])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: -2 }}>
        <Type size={14} strokeWidth={2} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          {element.name || 'Novo texto'}
        </span>
      </div>

      {/* ── Action buttons row ── */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" style={actionBtnStyle} onClick={() => onDuplicate?.()}>
          <Copy size={13} strokeWidth={1.8} /> Duplicar
        </button>
        <button
          type="button"
          style={actionBtnStyle}
          onClick={() => onUpdate({ locked: !element.locked })}
        >
          <Lock size={13} strokeWidth={1.8} /> Travar
        </button>
        <button
          type="button"
          style={{ ...actionBtnStyle, flex: '0 0 38px' }}
          onClick={() => onDelete?.()}
          aria-label="Excluir"
        >
          <Trash2 size={13} strokeWidth={1.8} />
        </button>
      </div>

      {/* ── 1. Conteudo ── */}
      <div>
        <div style={labelStyle}>Conteudo</div>
        <textarea
          value={element.content}
          onChange={e => onUpdate({ content: e.target.value })}
          style={{
            width: '100%', minHeight: 60,
            ...inputBoxStyle,
            padding: '9px 11px',
            color: 'var(--ink)', fontSize: 13, resize: 'vertical', lineHeight: 1.4,
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* ── 2. Fonte ── */}
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
        <FontPreviewBox value={element.fontFamily} onChange={v => onUpdate({ fontFamily: v })} />
      </div>

      {/* ── 3. Tamanho ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '11.5px', color: 'var(--ink-dim)' }}>Tamanho</span>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--ink)' }}>
            {element.fontSize}px
          </span>
        </div>
        <input
          type="range" min={18} max={160}
          value={element.fontSize}
          onChange={e => onUpdate({ fontSize: Number(e.target.value) })}
          aria-label="Tamanho"
          style={{ width: '100%' }}
        />
      </div>

      {/* ── 4. Peso ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '11.5px', color: 'var(--ink-dim)' }}>Peso</span>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--ink)' }}>
            {element.fontWeight}
          </span>
        </div>
        <input
          type="range" min={300} max={900} step={100}
          value={element.fontWeight}
          onChange={e => onUpdate({ fontWeight: Number(e.target.value) })}
          aria-label="Peso"
          style={{ width: '100%' }}
        />
      </div>

      {/* ── 5. Entrelinha ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '11.5px', color: 'var(--ink-dim)' }}>Entrelinha</span>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--ink)' }}>
            {(element.lineHeight).toFixed(2)}
          </span>
        </div>
        <input
          type="range" min={80} max={200}
          value={Math.round(element.lineHeight * 100)}
          onChange={e => onUpdate({ lineHeight: Number(e.target.value) / 100 })}
          aria-label="Entrelinha"
          style={{ width: '100%' }}
        />
      </div>

      {/* ── 6. Cor ── */}
      <div>
        <div style={labelStyle}>Cor</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {PALETTE.map(c => {
            const isActive = element.color.toLowerCase() === c.toLowerCase()
            return (
              <button
                key={c}
                type="button"
                onClick={() => { onUpdate({ color: c }); setHexInput(c) }}
                style={{
                  width: 28, height: 28, borderRadius: 7, padding: 0,
                  background: c, cursor: 'pointer',
                  border: isActive
                    ? '3px solid var(--accent)'
                    : '1px solid var(--line-strong)',
                  boxShadow: isActive ? '0 0 0 1px var(--accent)' : 'none',
                }}
              />
            )
          })}
        </div>
        {/* Inline hex input */}
        <div style={{
          ...inputBoxStyle,
          padding: '6px 9px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
            background: element.color,
            border: '1px solid var(--line-strong)',
          }} />
          <input
            type="text"
            value={hexInput}
            onChange={e => setHexInput(e.target.value)}
            onBlur={commitHex}
            onKeyDown={e => e.key === 'Enter' && commitHex()}
            style={{
              flex: 1, fontFamily: 'var(--font-mono, monospace)', fontSize: 12,
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--ink)', padding: 0,
            }}
            aria-label="Valor hexadecimal da cor"
          />
        </div>
      </div>

      {/* ── 7. Alinhamento ── */}
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
              {a === 'left' ? <AlignLeft size={14} /> : a === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
            </button>
          ))}
        </div>
      </div>

      {/* ── 8. Maiusculas toggle ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12.5px', color: 'var(--ink)' }}>Maiusculas</span>
        <ToggleSwitch checked={element.uppercase} onChange={v => onUpdate({ uppercase: v })} />
      </div>

      {/* ── Transformar section ── */}
      <div style={sectionDivider}>
        <div style={sectionLabel}>
          Transformar
        </div>

        {/* ── 10. X / Y inputs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          <PositionInput label="X" value={element.x} onChange={v => onUpdate({ x: v })} />
          <PositionInput label="Y" value={element.y} onChange={v => onUpdate({ y: v })} />
          <PositionInput label="L" value={element.width} onChange={v => onUpdate({ width: v })} />
        </div>

        {/* ── 11. Rotação ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RotateCcw size={13} strokeWidth={1.7} style={{ color: 'var(--ink-dim)' }} />
              <span style={{ fontSize: '11.5px', color: 'var(--ink-dim)' }}>Rotação</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--ink)' }}>
              {element.rotation}&deg;
            </span>
          </div>
          <input
            type="range" min={-180} max={180}
            value={element.rotation}
            onChange={e => onUpdate({ rotation: Number(e.target.value) })}
            aria-label="Rotação"
            style={{ width: '100%' }}
          />
        </div>

        {/* ── 12. Opacidade ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Circle size={13} strokeWidth={1.7} style={{ color: 'var(--ink-dim)' }} />
              <span style={{ fontSize: '11.5px', color: 'var(--ink-dim)' }}>Opacidade</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--ink)' }}>
              {Math.round(element.opacity * 100)}%
            </span>
          </div>
          <input
            type="range" min={10} max={100}
            value={Math.round(element.opacity * 100)}
            onChange={e => onUpdate({ opacity: Number(e.target.value) / 100 })}
            aria-label="Opacidade"
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* ── Hint ── */}
      <div style={hintStyle}>
        <Move size={13} strokeWidth={1.7} style={{ flexShrink: 0 }} />
        Arraste no canvas pra mover &middot; alça laranja pra redimensionar
      </div>
    </div>
  )
}

/* ── Font preview box (opens full dropdown on click) ── */

function FontPreviewBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useFontLoader(value)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', marginTop: 6 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 11px', borderRadius: 8,
          background: 'var(--surface)', border: '1px solid var(--line-strong)',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontFamily: value, fontSize: 15, color: 'var(--ink)' }}>{value}</span>
        <span style={{ fontFamily: value, fontSize: 15, color: 'var(--ink-faint)' }}>Ag</span>
      </button>
      {open && <FontDropdown value={value} onSelect={font => { onChange(font); setOpen(false) }} />}
    </div>
  )
}

/* ── Font dropdown (reused from original — but FontPreviewBox supplies context) ── */

const CATEGORY_LABELS: Record<FontCategory, string> = {
  'sans-serif': 'Sans Serif',
  'serif': 'Serif',
  'display': 'Display',
  'handwriting': 'Handwriting',
  'monospace': 'Monospace',
}

function FontDropdown({ value, onSelect }: { value: string; onSelect: (font: string) => void }) {
  return (
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
            <FontRow key={font} font={font} selected={value === font} onSelect={() => onSelect(font)} />
          ))}
        </div>
      ))}
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

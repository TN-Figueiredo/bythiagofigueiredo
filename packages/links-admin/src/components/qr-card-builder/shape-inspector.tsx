'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  LayoutTemplate, Copy, Lock, Trash2, RotateCcw, Circle, Move,
} from 'lucide-react'
import { BG_PALETTE } from '@tn-figueiredo/links/qr'
import type { TextElement } from '@tn-figueiredo/links/qr'
import { PositionInput } from './inspector-field'

/* ── Shape sub-types ── */

export type ShapeType = 'line' | 'block' | 'outline'

const SHAPE_PREFIX = '__shape:'

export function getShapeType(content: string): ShapeType {
  if (content.startsWith(SHAPE_PREFIX)) {
    const raw = content.slice(SHAPE_PREFIX.length)
    if (raw === 'block') return 'block'
    if (raw === 'outline') return 'outline'
  }
  return 'line'
}

export function isShapeElement(el: { type: string; name?: string }): boolean {
  return el.type === 'text' && (el.name?.includes('Forma') ?? false)
}

/* ── Constants ── */

const PALETTE = [...BG_PALETTE]

const SHAPE_OPTS: { key: ShapeType; label: string }[] = [
  { key: 'line', label: 'Linha' },
  { key: 'block', label: 'Bloco' },
  { key: 'outline', label: 'Contorno' },
]

/* ── Shared styles (match text-inspector) ── */

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

const actionBtnStyle: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 5, padding: '7px 0', borderRadius: 7,
  border: '1px solid var(--line-strong)', background: 'var(--surface-2)',
  color: 'var(--ink-dim)', fontSize: 11, cursor: 'pointer',
}

const inputBoxStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line-strong)',
  borderRadius: 8,
}

/* ── Helpers ── */

/** Derive the effective color for display (fill or outline color). */
function shapeColor(el: TextElement, type: ShapeType): string {
  if (type === 'outline') return el.color
  return el.backgroundColor ?? el.color
}

/** Convert hex (#rrggbb) to rgba with given alpha */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/* ── Props ── */

interface ShapeInspectorProps {
  element: TextElement
  onUpdate: (patch: Partial<TextElement>) => void
  onDuplicate?: () => void
  onDelete?: () => void
}

/* ── Component ── */

export function ShapeInspector({ element, onUpdate, onDuplicate, onDelete }: ShapeInspectorProps) {
  const shapeType = getShapeType(element.content)
  const currentColor = shapeColor(element, shapeType)

  const [hexInput, setHexInput] = useState(currentColor)
  useEffect(() => { setHexInput(currentColor) }, [currentColor])

  const commitHex = useCallback(() => {
    if (/^#[0-9a-fA-F]{6}$/.test(hexInput)) {
      applyColor(hexInput.toLowerCase())
    } else {
      setHexInput(currentColor)
    }
  }, [hexInput, currentColor]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Apply a color change respecting shape type */
  const applyColor = useCallback((color: string) => {
    if (shapeType === 'outline') {
      onUpdate({ color, backgroundColor: hexToRgba(color, 0.08) })
    } else {
      onUpdate({ color, backgroundColor: color })
    }
    setHexInput(color)
  }, [shapeType, onUpdate])

  /** Switch shape type and adjust element properties accordingly */
  const switchType = useCallback((type: ShapeType) => {
    const color = currentColor.startsWith('rgba') ? element.color : currentColor
    const base: Partial<TextElement> = {
      content: `${SHAPE_PREFIX}${type}`,
      fontSize: 1,
      fontWeight: 400,
      lineHeight: 1,
      letterSpacing: '0em',
      align: 'center' as const,
      uppercase: false,
      backgroundPadding: 0,
    }

    switch (type) {
      case 'line':
        onUpdate({
          ...base,
          height: 6,
          backgroundColor: color,
          backgroundRadius: 0,
          color,
        })
        break
      case 'block':
        onUpdate({
          ...base,
          height: Math.max(element.height, 40),
          backgroundColor: color,
          backgroundRadius: element.backgroundRadius ?? 0,
          color,
        })
        break
      case 'outline':
        onUpdate({
          ...base,
          height: Math.max(element.height, 40),
          backgroundColor: hexToRgba(color, 0.08),
          backgroundRadius: element.backgroundRadius ?? 0,
          color,
        })
        break
    }
  }, [currentColor, element, onUpdate])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: -2 }}>
        <LayoutTemplate size={14} strokeWidth={2} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          Forma
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
        >
          <Trash2 size={13} strokeWidth={1.8} />
        </button>
      </div>

      {/* ── 1. Tipo ── */}
      <div>
        <div style={labelStyle}>Tipo</div>
        <div style={pillBar}>
          {SHAPE_OPTS.map(o => (
            <button
              key={o.key}
              type="button"
              onClick={() => switchType(o.key)}
              style={pillBtn(shapeType === o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2. Cor ── */}
      <div>
        <div style={labelStyle}>Cor</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {PALETTE.map(c => {
            const isActive = currentColor.toLowerCase() === c.toLowerCase()
            return (
              <button
                key={c}
                type="button"
                onClick={() => applyColor(c)}
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
            background: currentColor,
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
            aria-label="Color hex value"
          />
        </div>
      </div>

      {/* ── 3. Espessura (Linha only) ── */}
      {shapeType === 'line' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '11.5px', color: 'var(--ink-dim)' }}>Espessura</span>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--ink)' }}>
              {Math.round(element.height)}px
            </span>
          </div>
          <input
            type="range" min={2} max={40}
            value={Math.round(element.height)}
            onChange={e => onUpdate({ height: Number(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {/* ── 4. Altura (Bloco / Contorno) ── */}
      {shapeType !== 'line' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '11.5px', color: 'var(--ink-dim)' }}>Altura</span>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--ink)' }}>
              {Math.round(element.height)}px
            </span>
          </div>
          <input
            type="range" min={10} max={600}
            value={Math.round(element.height)}
            onChange={e => onUpdate({ height: Number(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {/* ── 5. Cantos (Bloco / Contorno) ── */}
      {shapeType !== 'line' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '11.5px', color: 'var(--ink-dim)' }}>Cantos</span>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--ink)' }}>
              {element.backgroundRadius ?? 0}px
            </span>
          </div>
          <input
            type="range" min={0} max={30}
            value={element.backgroundRadius ?? 0}
            onChange={e => onUpdate({ backgroundRadius: Number(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {/* ── Transformar section ── */}
      <div style={{
        borderTop: '1px solid var(--line)',
        marginTop: 2, paddingTop: 16,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--ink-dim)', marginBottom: 12,
        }}>
          Transformar
        </div>

        {/* ── X / Y / L inputs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          <PositionInput label="X" value={element.x} onChange={v => onUpdate({ x: v })} />
          <PositionInput label="Y" value={element.y} onChange={v => onUpdate({ y: v })} />
          <PositionInput label="L" value={element.width} onChange={v => onUpdate({ width: v })} />
        </div>

        {/* ── Rotacao ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RotateCcw size={13} strokeWidth={1.7} style={{ color: 'var(--ink-dim)' }} />
              <span style={{ fontSize: '11.5px', color: 'var(--ink-dim)' }}>Rotacao</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--ink)' }}>
              {element.rotation}deg
            </span>
          </div>
          <input
            type="range" min={-180} max={180}
            value={element.rotation}
            onChange={e => onUpdate({ rotation: Number(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>

        {/* ── Opacidade ── */}
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
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* ── Hint ── */}
      <div style={{
        fontSize: 11, color: 'var(--ink-faint)',
        display: 'flex', gap: 7, alignItems: 'center',
      }}>
        <Move size={13} strokeWidth={1.7} style={{ flexShrink: 0 }} />
        Arraste no canvas pra mover &middot; alca laranja pra redimensionar
      </div>
    </div>
  )
}

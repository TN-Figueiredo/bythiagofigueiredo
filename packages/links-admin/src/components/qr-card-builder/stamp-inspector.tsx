'use client'
import { Copy, Lock, Trash2, Type, RotateCcw, Circle, Move } from 'lucide-react'
import type { ImageElement } from '@tn-figueiredo/links/qr'
import { PositionInput } from './inspector-field'
import { actionBtnStyle, hintStyle, sectionDivider, sectionLabel } from './inspector-styles'

export function isStampElement(el: { type: string; name?: string }): boolean {
  return el.type === 'image' && (el.name?.startsWith('__stamp:') ?? false)
}

interface StampInspectorProps {
  element: ImageElement
  onUpdate: (patch: Partial<ImageElement>) => void
  onDuplicate?: () => void
  onDelete?: () => void
}

export function StampInspector({ element, onUpdate, onDuplicate, onDelete }: StampInspectorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: -2 }}>
        <Type size={14} strokeWidth={2} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          Carimbo TF
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" style={actionBtnStyle} onClick={() => onDuplicate?.()}>
          <Copy size={13} strokeWidth={1.8} /> Duplicar
        </button>
        <button type="button" style={actionBtnStyle} onClick={() => onUpdate({ locked: !element.locked })}>
          <Lock size={13} strokeWidth={1.8} /> Travar
        </button>
        <button type="button" style={{ ...actionBtnStyle, flex: '0 0 38px' }} onClick={() => onDelete?.()} aria-label="Excluir">
          <Trash2 size={13} strokeWidth={1.8} />
        </button>
      </div>

      {/* Description */}
      <div style={{ fontSize: 12, color: 'var(--ink-dim)', lineHeight: 1.6 }}>
        Elemento de marca, herdado do template. Pode ocultar pela camada se quiser.
      </div>

      {/* Transformar */}
      <div style={sectionDivider}>
        <div style={sectionLabel}>Transformar</div>

        {/* X / Y */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <PositionInput label="X" value={element.x} onChange={v => onUpdate({ x: v })} />
          </div>
          <div style={{ flex: 1 }}>
            <PositionInput label="Y" value={element.y} onChange={v => onUpdate({ y: v })} />
          </div>
        </div>

        {/* Rotação */}
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
            style={{ width: '100%' }}
            aria-label="Rotação"
          />
        </div>

        {/* Opacidade */}
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
            aria-label="Opacidade"
          />
        </div>
      </div>

      {/* Hint */}
      <div style={hintStyle}>
        <Move size={13} strokeWidth={1.7} style={{ flexShrink: 0 }} />
        Arraste no canvas pra mover &middot; alça laranja pra redimensionar
      </div>
    </div>
  )
}

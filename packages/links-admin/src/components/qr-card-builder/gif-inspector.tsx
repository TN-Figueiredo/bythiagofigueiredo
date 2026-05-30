'use client'
import {
  FileVideo2, Copy, Lock, Trash2, RotateCcw, Circle, Move, Info,
} from 'lucide-react'
import type { ImageElement } from '@tn-figueiredo/links/qr'

/* ── Shared styles (mirrors text/image inspectors) ── */

const labelStyle: React.CSSProperties = {
  fontSize: '11.5px', color: 'var(--ink-dim)', marginBottom: 6,
}

const actionBtnStyle: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 5, padding: '7px 0', borderRadius: 7,
  border: '1px solid var(--line-strong)', background: 'var(--surface-2)',
  color: 'var(--ink-dim)', fontSize: 11, cursor: 'pointer',
}

/* ── Emoji quick-pick grid ── */

const EMOJI_PICKS = [
  '✨', '🔥', '👀', '🎬',
  '📍', '🇹🇭', '💬', '⬆️',
]

/* ── Props ── */

interface GifInspectorProps {
  element: ImageElement
  onUpdate: (patch: Partial<ImageElement>) => void
  onDuplicate?: () => void
  onDelete?: () => void
}

/* ── Component ── */

export function GifInspector({
  element,
  onUpdate,
  onDuplicate,
  onDelete,
}: GifInspectorProps) {
  /* Derive scale percentage from element width vs a baseline (100 = original) */
  const scalePercent = Math.round(((element.width) / 100) * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: -2 }}>
        <FileVideo2 size={14} strokeWidth={2} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          {element.name || 'GIF'}
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

      {/* ── GIF / figurinha section ── */}
      <div>
        <div style={labelStyle}>GIF / figurinha</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {EMOJI_PICKS.map((emoji, i) => (
            <button
              key={emoji}
              type="button"
              onClick={() => { /* placeholder — no-op */ }}
              style={{
                width: 34, height: 34,
                fontSize: 18,
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                background: i === 0 ? 'var(--accent-soft)' : 'var(--surface)',
                border: i === 0
                  ? '1.5px solid var(--accent)'
                  : '1px solid var(--line-strong)',
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* ── Info callout ── */}
      <div style={{
        display: 'flex', gap: 8,
        padding: '10px 12px',
        background: 'var(--surface-2)',
        borderRadius: 8,
      }}>
        <Info
          size={14}
          strokeWidth={1.8}
          style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}
        />
        <span style={{ fontSize: '11.5px', color: 'var(--ink-dim)', lineHeight: 1.5 }}>
          Busque por GIF (GIPHY) ou solte o seu. Fica animado por cima do video/foto.
        </span>
      </div>

      {/* ── Tamanho slider ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '11.5px', color: 'var(--ink-dim)' }}>Tamanho</span>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--ink)' }}>
            {scalePercent}%
          </span>
        </div>
        <input
          type="range" min={50} max={300}
          value={scalePercent}
          onChange={e => {
            const pct = Number(e.target.value)
            const newWidth = (pct / 100) * 100
            const ratio = element.height / element.width
            onUpdate({ width: newWidth, height: newWidth * ratio })
          }}
          style={{ width: '100%' }}
        />
      </div>

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
          <PositionInput
            label="L"
            value={element.width}
            onChange={v => {
              const ratio = element.height / element.width
              onUpdate({ width: v, height: v * ratio })
            }}
          />
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

/* ── Position input (X / Y / L) ── */

function PositionInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginBottom: 4 }}>{label}</div>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line-strong)',
        borderRadius: 7, padding: '0 6px 0 8px',
        display: 'flex', alignItems: 'center',
      }}>
        <input
          type="number"
          value={Math.round(value)}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            flex: 1, fontFamily: 'var(--font-mono, monospace)', fontSize: 12,
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--ink)', padding: '6px 0', width: 0,
          }}
        />
        <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>px</span>
      </div>
    </div>
  )
}

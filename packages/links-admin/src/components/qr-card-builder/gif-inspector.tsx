'use client'
import { useRef, useState } from 'react'
import {
  FileVideo2, Copy, Lock, Trash2, RotateCcw, Circle, Move, Info, Upload,
  Sparkles, Flame, Eye, Clapperboard, MapPin, Flag, MessageCircle, ArrowUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ImageElement } from '@tn-figueiredo/links/qr'
import { PositionInput } from './inspector-field'

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

/* ── Category icon grid (future GIPHY search categories) ── */

interface StickerCategory {
  id: string
  icon: LucideIcon
  label: string
}

const STICKER_PICKS: StickerCategory[] = [
  { id: 'sparkles', icon: Sparkles, label: 'Brilho' },
  { id: 'flame', icon: Flame, label: 'Fogo' },
  { id: 'eye', icon: Eye, label: 'Olhar' },
  { id: 'clapperboard', icon: Clapperboard, label: 'Acao' },
  { id: 'map-pin', icon: MapPin, label: 'Local' },
  { id: 'flag', icon: Flag, label: 'Bandeira' },
  { id: 'message-circle', icon: MessageCircle, label: 'Chat' },
  { id: 'arrow-up', icon: ArrowUp, label: 'Seta' },
]

/* ── Props ── */

interface GifInspectorProps {
  element: ImageElement
  onUpdate: (patch: Partial<ImageElement>) => void
  onReplaceImage?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}

/* ── Component ── */

export function GifInspector({
  element,
  onUpdate,
  onReplaceImage,
  onDuplicate,
  onDelete,
}: GifInspectorProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
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

      {/* ── Categoria section (future GIPHY search) ── */}
      <div>
        <div style={labelStyle}>Categoria</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {STICKER_PICKS.map(({ id, icon: Icon, label }) => {
            const active = selectedCategory === id
            return (
              <button
                key={id}
                type="button"
                title={label}
                onClick={() => setSelectedCategory(active ? null : id)}
                style={{
                  width: 34, height: 34,
                  borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  background: active ? 'var(--accent-soft)' : 'var(--surface)',
                  border: active
                    ? '1.5px solid var(--accent)'
                    : '1px solid var(--line-strong)',
                }}
              >
                <Icon
                  size={16}
                  strokeWidth={1.8}
                  style={{ color: active ? 'var(--accent)' : 'var(--ink-dim)' }}
                />
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Trocar GIF button ── */}
      <div>
        <button
          type="button"
          onClick={() => onReplaceImage?.()}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 0', borderRadius: 8,
            border: '1.5px dashed var(--line-strong)',
            background: 'var(--surface-2)',
            color: 'var(--ink-dim)', fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Upload size={14} strokeWidth={1.8} />
          Trocar GIF
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/gif,.gif"
          style={{ display: 'none' }}
          onChange={() => {
            onReplaceImage?.()
            if (fileRef.current) fileRef.current.value = ''
          }}
        />
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
          Clique em &lsquo;Trocar GIF&rsquo; para enviar o seu. Em breve: busca GIPHY integrada.
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


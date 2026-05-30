'use client'
import { useRef } from 'react'
import {
  Image, Copy, Lock, Trash2, RotateCcw, Circle, Move,
} from 'lucide-react'
import type { ImageElement } from '@tn-figueiredo/links/qr'
import { ToggleSwitch, PositionInput } from './inspector-field'

/* ── Shared styles (mirrors text-inspector) ── */

const actionBtnStyle: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 5, padding: '7px 0', borderRadius: 7,
  border: '1px solid var(--line-strong)', background: 'var(--surface-2)',
  color: 'var(--ink-dim)', fontSize: 11, cursor: 'pointer',
}

const inputBoxStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line-strong)',
  borderRadius: 7, padding: '0 6px 0 8px',
  display: 'flex', alignItems: 'center',
}

/* ── Props ── */

interface ImageInspectorProps {
  element: ImageElement
  onUpdate: (patch: Partial<ImageElement>) => void
  onReplaceImage: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}

/* ── Component ── */

export function ImageInspector({
  element,
  onUpdate,
  onReplaceImage,
  onDuplicate,
  onDelete,
}: ImageInspectorProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: -2 }}>
        <Image size={14} strokeWidth={2} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          {element.name || 'Imagem'}
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

      {/* ── Image preview area ── */}
      <div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{
            position: 'relative', width: '100%', aspectRatio: '1 / 1',
            border: '1.5px dashed var(--line-strong)',
            background: 'var(--surface-2)', borderRadius: 10,
            cursor: 'pointer', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: 0,
          }}
        >
          {element.src && (
            <img
              src={element.src}
              alt=""
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover', borderRadius: 10,
              }}
            />
          )}
          {/* overlay caption */}
          <div style={{
            position: 'relative', zIndex: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 4,
            background: element.src ? 'rgba(0,0,0,0.55)' : 'transparent',
            borderRadius: 8, padding: '12px 18px',
          }}>
            <Image
              size={22}
              strokeWidth={1.5}
              style={{ color: element.src ? 'rgba(255,255,255,0.7)' : 'var(--ink-faint)' }}
            />
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: element.src ? '#fff' : 'var(--ink)',
            }}>
              Trocar imagem
            </span>
            <span style={{
              fontSize: 11,
              color: element.src ? 'rgba(255,255,255,0.6)' : 'var(--ink-faint)',
            }}>
              arraste ou clique
            </span>
          </div>
        </button>

        {/* hidden file input — triggers same handler as existing replace */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={() => {
            onReplaceImage()
            if (fileRef.current) fileRef.current.value = ''
          }}
        />

        {/* hint below preview */}
        <p style={{
          fontSize: 11.5, lineHeight: 1.5,
          color: 'var(--ink-dim)', marginTop: 8,
        }}>
          Puxada do og:image do post. Solte a sua pra trocar.
        </p>
      </div>

      {/* ── Object Fit ── */}
      <div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', marginBottom: 6 }}>
          Ajuste
        </div>
        <div style={{
          display: 'inline-flex', background: 'var(--surface-2)',
          borderRadius: 9, padding: 3, gap: 2,
        }}>
          {FIT_OPTIONS.map(opt => {
            const isActive = element.objectFit === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUpdate({ objectFit: opt.value })}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', borderRadius: 7,
                  border: 'none', fontSize: 12, fontWeight: 600,
                  background: isActive ? 'var(--accent)' : 'transparent',
                  color: isActive ? 'var(--pb-ink-on-accent, #1A140C)' : 'var(--ink-dim)',
                  cursor: 'pointer', transition: '0.15s',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Border controls ── */}
      <div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', marginBottom: 6 }}>
          Borda
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {/* Border radius */}
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginBottom: 4 }}>Raio</div>
            <div style={inputBoxStyle}>
              <input
                type="number"
                value={Math.round(element.borderRadius)}
                onChange={e => onUpdate({ borderRadius: Number(e.target.value) })}
                min={0}
                max={100}
                style={{
                  flex: 1, fontFamily: 'var(--font-mono, monospace)', fontSize: 12,
                  background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--ink)', padding: '6px 0', width: 0,
                }}
              />
              <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>px</span>
            </div>
          </div>

          {/* Border width */}
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginBottom: 4 }}>Largura</div>
            <div style={inputBoxStyle}>
              <input
                type="number"
                value={Math.round(element.borderWidth)}
                onChange={e => onUpdate({ borderWidth: Number(e.target.value) })}
                min={0}
                max={20}
                style={{
                  flex: 1, fontFamily: 'var(--font-mono, monospace)', fontSize: 12,
                  background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--ink)', padding: '6px 0', width: 0,
                }}
              />
              <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>px</span>
            </div>
          </div>
        </div>

        {/* Border color inline */}
        <div style={{
          ...inputBoxStyle,
          padding: '6px 9px', marginTop: 8,
          gap: 8,
        }}>
          <input
            type="color"
            value={element.borderColor}
            onChange={e => onUpdate({ borderColor: e.target.value })}
            style={{
              width: 18, height: 18, borderRadius: 5, flexShrink: 0,
              border: '1px solid var(--line-strong)',
              padding: 0, cursor: 'pointer',
            }}
          />
          <span style={{
            fontFamily: 'var(--font-mono, monospace)', fontSize: 12,
            color: 'var(--ink)',
          }}>
            {element.borderColor}
          </span>
        </div>
      </div>

      {/* ── Aspect ratio lock ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12.5, color: 'var(--ink)' }}>Manter proporcao</span>
        <ToggleSwitch
          checked={element.maintainAspectRatio}
          onChange={v => onUpdate({ maintainAspectRatio: v })}
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

        {/* ── X / Y / L (width) inputs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          <PositionInput label="X" value={element.x} onChange={v => onUpdate({ x: v })} />
          <PositionInput label="Y" value={element.y} onChange={v => onUpdate({ y: v })} />
          <PositionInput
            label="L"
            value={element.width}
            onChange={v => {
              if (element.maintainAspectRatio) {
                const ratio = element.height / element.width
                onUpdate({ width: v, height: v * ratio })
              } else {
                onUpdate({ width: v })
              }
            }}
          />
        </div>

        {/* ── Rotacao ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RotateCcw size={13} strokeWidth={1.7} style={{ color: 'var(--ink-dim)' }} />
              <span style={{ fontSize: 11.5, color: 'var(--ink-dim)' }}>Rotacao</span>
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
              <span style={{ fontSize: 11.5, color: 'var(--ink-dim)' }}>Opacidade</span>
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

/* ── Object-fit options ── */

const FIT_OPTIONS = [
  { value: 'fill', label: 'Fill' },
  { value: 'cover', label: 'Cover' },
  { value: 'contain', label: 'Contain' },
  { value: 'stretch', label: 'Stretch' },
] as const


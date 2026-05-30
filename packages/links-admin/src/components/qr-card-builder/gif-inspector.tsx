'use client'
import { useEffect, useRef, useState } from 'react'
import {
  FileVideo2, Copy, Lock, Trash2, RotateCcw, Circle, Move, Upload, Search,
} from 'lucide-react'
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

/* ── GIPHY integration ── */

const GIPHY_KEY = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65'

interface GiphyGif {
  id: string
  images: {
    fixed_width: { url: string; width: string; height: string }
    original: { url: string }
  }
}

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
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<GiphyGif[]>([])
  const [searching, setSearching] = useState(false)

  /* Derive scale percentage from element width vs a baseline (100 = original) */
  const scalePercent = Math.round(((element.width) / 100) * 100)

  async function fetchGifs(q: string) {
    setSearching(true)
    try {
      const endpoint = q.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=12&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=12&rating=g`
      const res = await fetch(endpoint)
      const json = await res.json()
      setGifs(json.data ?? [])
    } catch {
      setGifs([])
    } finally {
      setSearching(false)
    }
  }

  /* Load trending on mount + auto-focus search */
  useEffect(() => {
    fetchGifs('')
    searchRef.current?.focus()
  }, [])

  /* Debounced search */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchGifs(query), 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

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

      {/* ── GIPHY search ── */}
      <div>
        <div style={labelStyle}>Buscar GIF</div>
        <div style={{ position: 'relative' }}>
          <Search
            size={13}
            strokeWidth={1.8}
            style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--ink-faint)', pointerEvents: 'none',
            }}
          />
          <input
            ref={searchRef}
            type="text"
            placeholder="Buscar GIF..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 10px 8px 30px', borderRadius: 8,
              border: '1px solid var(--line-strong)',
              background: 'var(--surface)',
              color: 'var(--ink)', fontSize: 12,
              outline: 'none',
            }}
          />
        </div>

        {/* ── GIF results grid ── */}
        <div style={{
          marginTop: 8, maxHeight: 300, overflowY: 'auto',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
        }}>
          {searching && gifs.length === 0 && (
            <div style={{
              gridColumn: '1 / -1', textAlign: 'center',
              fontSize: 11, color: 'var(--ink-faint)', padding: '16px 0',
            }}>
              Buscando...
            </div>
          )}
          {!searching && gifs.length === 0 && (
            <div style={{
              gridColumn: '1 / -1', textAlign: 'center',
              fontSize: 11, color: 'var(--ink-faint)', padding: '16px 0',
            }}>
              Nenhum resultado
            </div>
          )}
          {gifs.map(gif => (
            <button
              key={gif.id}
              type="button"
              onClick={() => onUpdate({ src: gif.images.original.url })}
              style={{
                padding: 0, margin: 0, border: 'none',
                background: 'none', cursor: 'pointer',
                borderRadius: 6, overflow: 'hidden',
                maxHeight: 100, lineHeight: 0,
              }}
            >
              <img
                src={gif.images.fixed_width.url}
                alt=""
                loading="lazy"
                style={{
                  width: '100%', borderRadius: 6,
                  objectFit: 'cover', display: 'block',
                }}
              />
            </button>
          ))}
        </div>

        {/* ── GIPHY attribution ── */}
        <div style={{
          fontSize: 9, color: 'var(--ink-faint)',
          textAlign: 'center', marginTop: 4,
        }}>
          Powered by GIPHY
        </div>
      </div>

      {/* ── Enviar GIF button ── */}
      <div>
        <button
          type="button"
          onClick={() => onReplaceImage?.()}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '11px 0', borderRadius: 9,
            border: '1px solid var(--accent)',
            background: 'var(--accent)',
            color: 'var(--pb-ink-on-accent, #1A140C)',
            fontSize: 12.5, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Upload size={14} strokeWidth={1.8} />
          Enviar GIF
        </button>
      </div>

      {/* Hidden file input for replace */}
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


'use client'

import { useState, useCallback } from 'react'
import { X, Plus, RefreshCw, Sparkles } from 'lucide-react'
import { type SourceId } from '@tn-figueiredo/links-admin'

const SOURCES: Array<{ id: SourceId; label: string }> = [
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'social', label: 'Social' },
  { id: 'blog', label: 'Blog' },
  { id: 'qr', label: 'QR / impresso' },
]

function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 7; i++) result += chars[Math.floor(Math.random() * chars.length)]
  return result
}

interface CreateLinkModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    destination_url: string
    title?: string
    source_type?: SourceId
    code?: string
  }) => Promise<{ ok: true; linkId: string } | { ok: false; error: string }>
}

export function CreateLinkModal({ open, onClose, onSubmit }: CreateLinkModalProps) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [source, setSource] = useState<SourceId>('newsletter')
  const [slug, setSlug] = useState(generateSlug)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!url.trim()) {
      setError('URL obrigatória')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await onSubmit({
        destination_url: url.trim(),
        title: title.trim() || undefined,
        source_type: source,
        code: slug.trim() || undefined,
      })
      if (!result.ok) {
        setError(result.error)
      } else {
        setUrl('')
        setTitle('')
        setSlug(generateSlug())
        setSource('newsletter')
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }, [url, title, source, slug, onSubmit, onClose])

  if (!open) return null

  const inputStyle = {
    width: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--line-strong)',
    borderRadius: 9,
    padding: '11px 13px',
    color: 'var(--ink)',
    fontSize: '13.5px',
    outline: 'none',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Criar novo link"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, 100%)',
          background: 'var(--surface)',
          border: '1px solid var(--line-strong)',
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600, fontFamily: 'Fraunces, serif', color: 'var(--ink)' }}>
            Novo link rastreado
          </h3>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--ink-dim)', cursor: 'pointer' }}
          >
            <X size={19} strokeWidth={1.7} />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* URL */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginBottom: 7 }}>Destino (URL)</div>
            <input
              type="url"
              placeholder="https://bythiagofigueiredo.com/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-required="true"
              style={inputStyle}
            />
          </div>

          {/* Title */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginBottom: 7 }}>Título</div>
            <input
              type="text"
              placeholder="Ex: Lançamento do curso"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Source + Slug row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginBottom: 7 }}>Origem</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SOURCES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSource(s.id)}
                    style={{
                      padding: '6px 11px', borderRadius: 8,
                      border: source === s.id ? '1px solid var(--accent)' : '1px solid var(--line-strong)',
                      background: source === s.id ? 'var(--accent)' : 'var(--surface-2)',
                      color: source === s.id ? 'var(--pb-ink-on-accent, #1A140C)' : 'var(--ink-dim)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginBottom: 7 }}>Slug</div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                ...inputStyle, padding: '11px 8px 11px 13px',
              }}>
                <span className="mono" style={{ fontSize: 13, color: 'var(--accent)' }}>/{slug}</span>
                <button
                  type="button"
                  onClick={() => setSlug(generateSlug())}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer' }}
                  aria-label="Gerar novo slug"
                >
                  <RefreshCw size={13} strokeWidth={1.7} />
                </button>
              </div>
            </div>
          </div>

          {/* Info strip */}
          <div style={{
            display: 'flex', gap: 8, padding: '10px 12px',
            background: 'var(--surface-2)', borderRadius: 9,
            fontSize: '11.5px', color: 'var(--ink-dim)',
          }}>
            <Sparkles size={14} strokeWidth={1.7} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
            Click IDs ligados · redirect 301 · QR gerado automaticamente.
          </div>

          {/* Error */}
          {error && (
            <p role="alert" style={{ borderRadius: 9, background: 'rgba(217,97,74,0.1)', padding: '8px 12px', fontSize: 12, color: 'var(--red)', margin: 0 }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--line)',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          background: 'var(--bg-side, var(--surface))',
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 15px', fontSize: '13.5px', fontWeight: 600,
              borderRadius: 9, border: '1px solid var(--line-strong)',
              background: 'transparent', color: 'var(--ink-dim)',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !url.trim()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 15px', fontSize: '13.5px', fontWeight: 600,
              borderRadius: 9, border: '1px solid var(--accent)',
              background: 'var(--accent)', color: 'var(--pb-ink-on-accent, #1A140C)',
              cursor: 'pointer',
              opacity: (loading || !url.trim()) ? 0.45 : 1,
              pointerEvents: (loading || !url.trim()) ? 'none' : 'auto',
            }}
          >
            <Plus size={16} strokeWidth={1.7} />
            Criar link
          </button>
        </div>
      </div>
    </div>
  )
}

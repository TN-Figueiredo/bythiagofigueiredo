'use client'

import { useState, useCallback } from 'react'
import { X, Link2, Loader2 } from 'lucide-react'
import { SOURCE_COLORS, type SourceId } from '@tn-figueiredo/links-admin'

const SOURCES: Array<{ id: SourceId; label: string }> = [
  { id: 'manual', label: 'Manual' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'social', label: 'Social' },
  { id: 'blog', label: 'Blog' },
  { id: 'campaign', label: 'Campanha' },
  { id: 'qr', label: 'QR' },
]

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
  const [source, setSource] = useState<SourceId>('manual')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!url.trim()) {
      setError('URL obrigatoria')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await onSubmit({
        destination_url: url.trim(),
        title: title.trim() || undefined,
        source_type: source,
        code: code.trim() || undefined,
      })
      if (!result.ok) {
        setError(result.error)
      } else {
        setUrl('')
        setTitle('')
        setCode('')
        setSource('manual')
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }, [url, title, source, code, onSubmit, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Criar novo link"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#161410] p-6 shadow-2xl"
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link2 className="h-5 w-5 text-[#F2683C]" />
            <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: 'Fraunces, serif' }}>Novo link</h2>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-4">
          {/* URL */}
          <div>
            <label htmlFor="link-url" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              URL de destino
            </label>
            <input
              id="link-url"
              type="url"
              placeholder="https://example.com/page"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-required="true"
              className="w-full rounded-[9px] bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Title */}
          <div>
            <label htmlFor="link-title" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Titulo (opcional)
            </label>
            <input
              id="link-title"
              type="text"
              placeholder="Nome do link"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-[9px] bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Custom code */}
          <div>
            <label htmlFor="link-code" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Codigo curto (opcional)
            </label>
            <input
              id="link-code"
              type="text"
              placeholder="codigo-personalizado"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-[9px] bg-muted px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Source */}
          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Origem
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SOURCES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={source === s.id}
                  onClick={() => setSource(s.id)}
                  className={`flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    source === s.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ background: SOURCE_COLORS[s.id] }}
                  />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Criar link
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

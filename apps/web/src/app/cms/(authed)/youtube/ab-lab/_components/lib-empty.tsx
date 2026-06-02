'use client'

import { Library, Upload, FlaskConical } from 'lucide-react'

interface LibEmptyProps {
  onUpload: () => void
  onCreateTest: () => void
}

/**
 * Empty state for the thumbnail library.
 * Shows when entries.length === 0.
 */
export function LibEmpty({ onUpload, onCreateTest }: LibEmptyProps) {
  return (
    <div className="lib-empty fade-in flex flex-col items-center text-center" style={{ padding: '60px 24px' }}>
      {/* Icon — 64x64 rounded-18px per design */}
      <div
        className="lib-empty-ico grid place-items-center"
        style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          background: 'var(--cms-accent-soft, rgba(255,130,64,0.10))',
          marginBottom: 18,
        }}
      >
        <Library
          size={28}
          strokeWidth={1.5}
          style={{ color: 'var(--cms-accent, #E8823C)' }}
          aria-hidden="true"
        />
      </div>

      {/* Title */}
      <h3
        className="lib-empty-title"
        style={{
          fontSize: 19,
          fontWeight: 600,
          letterSpacing: '-0.3px',
          color: 'var(--cms-text)',
          margin: '0 0 8px 0',
        }}
      >
        Sua biblioteca de thumbs esta vazia
      </h3>

      {/* Subtitle */}
      <p
        className="lib-empty-sub"
        style={{
          fontSize: 13.5,
          lineHeight: 1.55,
          color: 'var(--cms-text-muted, #A89B86)',
          maxWidth: 440,
          margin: '0 0 24px 0',
        }}
      >
        Thumbnails vencedoras de testes A/B sao salvas automaticamente aqui.
        Voce tambem pode enviar thumbs manualmente para reusar em futuros testes.
      </p>

      {/* CTAs */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onUpload}
          className="btn primary sm"
        >
          <Upload size={14} aria-hidden="true" />
          Enviar primeira thumb
        </button>
        <button
          type="button"
          onClick={onCreateTest}
          className="btn sm"
        >
          <FlaskConical size={14} aria-hidden="true" />
          Criar um teste A/B
        </button>
      </div>
    </div>
  )
}

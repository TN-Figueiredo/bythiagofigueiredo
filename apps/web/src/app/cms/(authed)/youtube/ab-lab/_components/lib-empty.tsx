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
    <div className="fade-in flex flex-col items-center text-center py-16 px-4">
      {/* Icon in accent-soft circle */}
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 96,
          height: 96,
          background: 'var(--cms-accent-soft, rgba(255,130,64,0.12))',
          marginBottom: 20,
        }}
      >
        <Library
          size={64}
          strokeWidth={1.2}
          style={{ color: 'var(--cms-accent, #E8823C)' }}
          aria-hidden="true"
        />
      </div>

      {/* Title */}
      <h3
        style={{
          fontSize: 19,
          fontWeight: 600,
          color: 'var(--cms-text)',
          margin: '0 0 8px 0',
        }}
      >
        Sua biblioteca de thumbs esta vazia
      </h3>

      {/* Subtitle */}
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--cms-text-dim, #7C7060)',
          maxWidth: 400,
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

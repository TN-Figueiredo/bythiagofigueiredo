'use client'

import { useState, useRef } from 'react'
import { X, Check } from 'lucide-react'
import { YtPortal } from '../../_components/yt-portal'
import { useModalFocusTrap } from '@/app/cms/(authed)/_shared/editor/use-modal-focus-trap'
import type { DisplayLabel } from './ab-constants'

export interface PipelineFrame {
  id: string
  blobUrl: string
  titleSuggestion: string | null
  creativeDirection: string | null
  sourcePipelineId: string
}

interface PipelinePickerDialogProps {
  frames: PipelineFrame[]
  targetVariantLabel: DisplayLabel
  onSelect: (frame: PipelineFrame) => void
  onClose: () => void
}

export function PipelinePickerDialog({
  frames,
  targetVariantLabel,
  onSelect,
  onClose,
}: PipelinePickerDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useModalFocusTrap(dialogRef, true, onClose)

  const selected = frames.find(f => f.id === selectedId)

  const handleImport = () => {
    if (selected) {
      onSelect(selected)
      onClose()
    }
  }

  return (
    <YtPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(6px)',
        }}
        onClick={onClose}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Importar thumb do Pipeline"
          className="flex flex-col mx-4"
          style={{
            width: 'min(560px, 100%)',
            maxHeight: 'calc(100vh - 80px)',
            background: 'var(--cms-surface)',
            border: '1px solid var(--cms-border, #332D25)',
            borderRadius: 18,
            boxShadow: 'var(--shadow-pop, 0 24px 60px -20px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4))',
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between py-4 px-5 shrink-0"
            style={{ borderBottom: '1px solid var(--cms-border, #332D25)' }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--cms-text)', margin: 0 }}>
              Importar do Pipeline
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 shrink-0"
              style={{ background: 'transparent', border: 'none', color: 'var(--cms-text-dim)', cursor: 'pointer' }}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-5" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {frames.length === 0 ? (
              <p
                className="text-center py-8"
                style={{ fontSize: 13, color: 'var(--cms-text-dim)' }}
              >
                Nenhuma thumb disponivel no Pipeline para este video.
              </p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 12,
                }}
              >
                {frames.map(frame => {
                  const isSel = frame.id === selectedId
                  return (
                    <button
                      key={frame.id}
                      type="button"
                      onClick={() => setSelectedId(isSel ? null : frame.id)}
                      className="picker-item text-left"
                      style={{
                        position: 'relative',
                        borderRadius: 12,
                        border: `2px solid ${isSel ? 'var(--cms-accent, #E8823C)' : 'var(--cms-border, #332D25)'}`,
                        background: isSel ? 'var(--cms-accent-soft, rgba(255,130,64,0.08))' : 'var(--cms-surface-2, #272219)',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'border-color var(--t-fast, 0.12s) var(--ease-out, ease-out)',
                      }}
                      aria-pressed={isSel}
                    >
                      {/* Thumbnail */}
                      <div style={{ aspectRatio: '16/9', position: 'relative' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={frame.blobUrl}
                          alt={frame.titleSuggestion ?? 'Pipeline frame'}
                          className="w-full h-full object-cover"
                          style={{ display: 'block' }}
                        />
                        {/* Check mark when selected */}
                        {isSel && (
                          <div
                            className="flex items-center justify-center"
                            style={{
                              position: 'absolute',
                              top: 6,
                              right: 6,
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: 'var(--cms-accent, #E8823C)',
                              color: 'var(--cms-on-accent, #1A120A)',
                            }}
                          >
                            <Check size={13} strokeWidth={3} aria-hidden="true" />
                          </div>
                        )}
                      </div>

                      {/* Meta */}
                      {(frame.titleSuggestion || frame.creativeDirection) && (
                        <div style={{ padding: '8px 10px' }}>
                          {frame.titleSuggestion && (
                            <p
                              className="truncate"
                              style={{
                                fontSize: 11,
                                fontWeight: 500,
                                color: 'var(--cms-text)',
                                margin: 0,
                              }}
                            >
                              {frame.titleSuggestion}
                            </p>
                          )}
                          {frame.creativeDirection && (
                            <p
                              className="line-clamp-2"
                              style={{
                                fontSize: 10,
                                color: 'var(--cms-text-dim)',
                                margin: '2px 0 0 0',
                                lineHeight: 1.4,
                              }}
                            >
                              {frame.creativeDirection}
                            </p>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-3 py-3 px-5 shrink-0"
            style={{
              borderTop: '1px solid var(--cms-border, #332D25)',
              background: 'var(--cms-bg-side, var(--cms-bg))',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!selected}
              className="btn primary sm"
            >
              Importar pra {targetVariantLabel}
            </button>
          </div>
        </div>
      </div>
    </YtPortal>
  )
}

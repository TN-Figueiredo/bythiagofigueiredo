'use client'

import { useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { pauseAbTest } from '../actions'
import { YtPortal } from '../../_components/yt-portal'
import { useModalFocusTrap } from '../../../_shared/editor/use-modal-focus-trap'
import { Pause, X } from 'lucide-react'

interface AbPauseDialogProps {
  testId: string
  onClose: () => void
}

export function AbPauseDialog({ testId, onClose }: AbPauseDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const dialogRef = useRef<HTMLDivElement>(null)

  useModalFocusTrap(dialogRef, true, onClose)

  function handleConfirm() {
    startTransition(async () => {
      await pauseAbTest(testId)
      router.refresh()
      onClose()
    })
  }

  return (
    <YtPortal>
      {/* Scrim */}
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
        <div
          className="absolute inset-0"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Pausar teste"
          className="relative w-full max-w-[420px] rounded-[14px] border border-cms-border bg-cms-surface overflow-hidden"
          style={{ boxShadow: 'var(--shadow-pop, 0 24px 60px -20px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4))' }}
        >
          {/* Header */}
          <div className="flex items-center gap-[11px] py-[18px] px-[20px] border-b border-cms-border">
            <span
              className="flex items-center justify-center rounded-[9px]"
              style={{ width: 32, height: 32, background: 'rgba(224, 162, 60, 0.12)' }}
            >
              <Pause size={16} className="text-cms-amber" aria-hidden="true" />
            </span>
            <h2 className="text-[15px] font-bold text-cms-text flex-1 m-0">Pausar teste</h2>
            <button
              type="button"
              onClick={onClose}
              className="ic-btn"
              aria-label="Fechar"
            >
              <X size={15} />
            </button>
          </div>

          {/* Body */}
          <div className="py-[18px] px-[20px] space-y-[10px] text-[13px] text-cms-text-dim leading-[1.55]">
            <p className="m-0">Pausar vai restaurar a thumbnail original imediatamente.</p>
            <p className="m-0">O ciclo atual sera fechado. Todos os dados coletados ficam preservados.</p>
            <p className="m-0">Voce pode retomar a qualquer momento — o teste continua de onde parou.</p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-[10px] py-[14px] px-[20px] border-t border-cms-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="btn sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="btn sm"
              style={{
                background: 'var(--cms-amber, #d97706)',
                color: '#1A120A',
                borderColor: 'transparent',
              }}
            >
              {isPending ? 'Pausando...' : 'Pausar teste'}
            </button>
          </div>
        </div>
      </div>
    </YtPortal>
  )
}

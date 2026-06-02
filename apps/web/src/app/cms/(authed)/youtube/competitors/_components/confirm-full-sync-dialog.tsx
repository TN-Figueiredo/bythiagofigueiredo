'use client'

import { useTransition, useRef } from 'react'
import { YtPortal } from '../../_components/yt-portal'
import { useModalFocusTrap } from '../../../_shared/editor/use-modal-focus-trap'
import { RefreshCw, X } from 'lucide-react'

interface ConfirmFullSyncDialogProps {
  channelName: string
  youtubeVideoCount: number | null
  onConfirm: () => Promise<void>
  onClose: () => void
}

export function ConfirmFullSyncDialog({ channelName, youtubeVideoCount, onConfirm, onClose }: ConfirmFullSyncDialogProps) {
  const [isPending, startTransition] = useTransition()
  const dialogRef = useRef<HTMLDivElement>(null)

  useModalFocusTrap(dialogRef, true, onClose)

  function handleConfirm() {
    startTransition(async () => {
      await onConfirm()
    })
  }

  const estimate = youtubeVideoCount
    ? Math.max(5, Math.round((youtubeVideoCount / 50) * 0.8))
    : 15

  return (
    <YtPortal>
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
          aria-label="Buscar historico completo"
          className="relative w-full max-w-[420px] rounded-[14px] border border-cms-border bg-cms-surface overflow-hidden"
          style={{ boxShadow: 'var(--shadow-pop, 0 24px 60px -20px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4))' }}
        >
          <div className="flex items-center gap-[11px] py-[18px] px-[20px] border-b border-cms-border">
            <span
              className="flex items-center justify-center rounded-[9px]"
              style={{ width: 32, height: 32, background: 'var(--accent-soft, rgba(255,130,64,0.10))' }}
            >
              <RefreshCw size={16} style={{ color: 'var(--accent)' }} aria-hidden="true" />
            </span>
            <h2 className="text-[15px] font-bold text-cms-text flex-1 m-0">Buscar historico completo</h2>
            <button type="button" onClick={onClose} className="ic-btn" aria-label="Fechar">
              <X size={15} />
            </button>
          </div>

          <div className="py-[18px] px-[20px] space-y-[10px] text-[13px] text-cms-text-dim leading-[1.55]">
            <p className="m-0">
              Buscar todos os videos de <strong className="text-cms-text">{channelName}</strong>.
            </p>
            <p className="m-0">
              {youtubeVideoCount
                ? `Este canal tem ~${youtubeVideoCount.toLocaleString('pt-BR')} videos. `
                : ''}
              Levara aproximadamente {estimate} segundos.
            </p>
          </div>

          <div className="flex items-center justify-end gap-[10px] py-[14px] px-[20px] border-t border-cms-border">
            <button type="button" onClick={onClose} disabled={isPending} className="btn sm">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="btn sm"
              style={{ background: 'var(--accent)', color: 'var(--on-accent, #1A120A)', borderColor: 'transparent' }}
            >
              {isPending ? 'Sincronizando...' : 'Continuar'}
            </button>
          </div>
        </div>
      </div>
    </YtPortal>
  )
}

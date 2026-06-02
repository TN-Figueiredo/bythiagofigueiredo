'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { VariantDbEntry } from '@/lib/youtube/ab-types'
import { endAbTest } from '../actions'
import { YtPortal } from '../../_components/yt-portal'
import { useModalFocusTrap } from '../../../_shared/editor/use-modal-focus-trap'
import { Square, X } from 'lucide-react'

interface AbEndTestDialogProps {
  testId: string
  variants: VariantDbEntry[]
  confidenceThreshold: number
  onClose: () => void
}

type EndOption = 'leading' | 'original' | 'archive'

export function AbEndTestDialog({ testId, variants, confidenceThreshold, onClose }: AbEndTestDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<EndOption>('leading')
  const dialogRef = useRef<HTMLDivElement>(null)

  useModalFocusTrap(dialogRef, true, onClose)

  const originalVariant = variants.find((v) => v.is_original)
  const nonOriginalVariants = variants.filter((v) => !v.is_original)

  const leadingVariant =
    nonOriginalVariants.length > 0 ? nonOriginalVariants[0] : originalVariant

  const confirmLabel =
    selected === 'leading'
      ? 'Aplicar e encerrar'
      : selected === 'original'
        ? 'Manter original e encerrar'
        : 'Arquivar teste'

  function handleConfirm() {
    startTransition(async () => {
      if (selected === 'leading' && leadingVariant && !leadingVariant.is_original) {
        await endAbTest(testId, leadingVariant.id)
      } else if (selected === 'original' && originalVariant) {
        await endAbTest(testId, originalVariant.id)
      } else {
        await endAbTest(testId)
      }
      router.refresh()
      onClose()
    })
  }

  const options: Array<{ value: EndOption; title: string; desc: string; thumb?: string | null }> = [
    {
      value: 'leading',
      title: 'Aplicar variante lider',
      desc: 'Define a melhor thumbnail como permanente',
      thumb: leadingVariant?.blob_url,
    },
    {
      value: 'original',
      title: 'Manter original',
      desc: 'Restaura a thumbnail original',
      thumb: originalVariant?.blob_url,
    },
    {
      value: 'archive',
      title: 'Arquivar sem aplicar',
      desc: 'Encerra o teste e mantem o que esta no ar',
    },
  ]

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
          aria-label="Encerrar teste"
          className="relative w-full max-w-[440px] rounded-[14px] border border-cms-border bg-cms-surface overflow-hidden"
          style={{ boxShadow: 'var(--shadow-pop, 0 24px 60px -20px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4))' }}
        >
          {/* Header */}
          <div className="flex items-center gap-[11px] py-[18px] px-[20px] border-b border-cms-border">
            <span
              className="flex items-center justify-center rounded-[9px]"
              style={{ width: 32, height: 32, background: 'var(--cms-red-soft, rgba(239,68,68,0.1))' }}
            >
              <Square size={16} className="text-cms-red" aria-hidden="true" />
            </span>
            <h2 className="text-[15px] font-bold text-cms-text flex-1 m-0">Encerrar teste</h2>
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
          <div className="py-[18px] px-[20px]">
            <p className="text-[12.5px] text-cms-text-dim mb-[14px] m-0">Escolha como encerrar este teste:</p>
            <div className="space-y-[8px]">
              {options.map(opt => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-[10px] rounded-[10px] border p-[12px] transition-[border-color,background] duration-150 ${
                    selected === opt.value
                      ? 'border-cms-accent bg-cms-accent/10'
                      : 'border-cms-border hover:bg-cms-surface-hover'
                  }`}
                >
                  <input
                    type="radio"
                    name="end-option"
                    value={opt.value}
                    checked={selected === opt.value}
                    onChange={() => setSelected(opt.value)}
                    className="mt-[2px] accent-[var(--cms-accent)]"
                  />
                  <div className="flex flex-1 items-start justify-between gap-[10px]">
                    <div>
                      <p className="text-[13px] font-semibold text-cms-text m-0">{opt.title}</p>
                      <p className="text-[11.5px] text-cms-text-dim m-0 mt-[2px]">{opt.desc}</p>
                    </div>
                    {opt.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={opt.thumb}
                        alt={opt.title}
                        width={56}
                        height={32}
                        className="shrink-0 rounded-[5px] object-cover"
                      />
                    )}
                  </div>
                </label>
              ))}
            </div>
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
              className="btn sm primary"
            >
              {isPending ? 'Encerrando...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </YtPortal>
  )
}

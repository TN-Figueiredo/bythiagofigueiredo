'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useModalFocusTrap } from './use-modal-focus-trap'

export interface CadenceSlotOption {
  date: string          // YYYY-MM-DD
  dayOfWeek: string     // e.g. "dom", "seg" or "Sun", "Mon"
  formattedDate: string // e.g. "1 Jun 2026"
  time: string          // e.g. "08:00"
  timezone: string      // e.g. "BRT"
  occupied: boolean
  occupiedEdition?: { id: string; displayId: string; subject: string }
}

interface SlotPickerModalProps {
  open: boolean
  editionDisplayId: string    // e.g. "#004"
  typeName: string            // e.g. "Tech Newsletter"
  patternDescription: string  // e.g. "Mensal, dia 1"
  availableSlots: CadenceSlotOption[]
  hasMore: boolean
  onLoadMore: () => void
  onConfirmSlot: (date: string, isSwap: boolean) => void
  onSwitchToSpecial: () => void
  onCancel: () => void
  loading?: boolean
  allSlotsFull?: boolean
  strings?: {
    title?: string
    selectSlot?: string
    showMore?: string
    allSlotsFull?: string
    scheduleAsSpecial?: string
    or?: string
    confirm?: string
    confirmSwap?: string
    cancel?: string
    occupied?: string
    swap?: string
  }
}

export function SlotPickerModal({
  open,
  editionDisplayId,
  typeName,
  patternDescription,
  availableSlots,
  hasMore,
  onLoadMore,
  onConfirmSlot,
  onSwitchToSpecial,
  onCancel,
  loading = false,
  allSlotsFull = false,
  strings = {},
}: SlotPickerModalProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setSelectedDate(null)
  }, [open])

  useModalFocusTrap(dialogRef, open, onCancel)

  const selectedSlot = selectedDate ? availableSlots.find((s) => s.date === selectedDate) : null
  const isSwap = !!selectedSlot?.occupied

  const handleConfirm = useCallback(() => {
    if (!selectedDate) return
    onConfirmSlot(selectedDate, isSwap)
  }, [selectedDate, isSwap, onConfirmSlot])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onCancel()
    },
    [onCancel],
  )

  if (!open) return null

  const titleId = 'slot-picker-modal-title'

  const t = {
    title: strings.title ?? `Agendar edição ${editionDisplayId}`,
    selectSlot: strings.selectSlot ?? 'Selecione um slot:',
    showMore: strings.showMore ?? 'Ver mais',
    allSlotsFull: strings.allSlotsFull ?? 'Todos os slots desta cadência estão ocupados.',
    scheduleAsSpecial: strings.scheduleAsSpecial ?? 'Agendar como edição especial →',
    or: strings.or ?? 'ou',
    confirm: strings.confirm ?? 'Confirmar',
    confirmSwap: strings.confirmSwap ?? 'Trocar',
    cancel: strings.cancel ?? 'Cancelar',
    occupied: strings.occupied ?? 'Ocupado',
    swap: strings.swap ?? 'Substituir — edição atual volta para Pronto',
  }

  const allOccupied = availableSlots.length > 0 && availableSlots.every((s) => s.occupied)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-xl"
      >
        {/* Header */}
        <h3
          id={titleId}
          className="text-[15px] font-semibold text-gray-200"
        >
          {t.title}
        </h3>
        <p className="mt-0.5 text-[12px] text-gray-400">
          {typeName}
          <span className="mx-1.5 text-gray-600">·</span>
          {patternDescription}
        </p>

        {/* Body */}
        <div className="mt-4">
          {loading ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/30 px-3 py-3">
                  <span className="h-4 w-4 rounded-full bg-gray-700 animate-pulse" />
                  <span className="h-4 flex-1 rounded bg-gray-700 animate-pulse" />
                </div>
              ))}
            </div>
          ) : allSlotsFull || (availableSlots.length === 0) ? (
            <p className="rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-3 text-[13px] text-gray-400">
              {t.allSlotsFull}
            </p>
          ) : (
            <>
              <p className="mb-2 text-[11px] font-medium text-gray-400">{t.selectSlot}</p>
              <div
                role="radiogroup"
                aria-labelledby={titleId}
                className="space-y-1 max-h-[320px] overflow-y-auto"
              >
                {availableSlots.map((slot) => {
                  const isSelected = selectedDate === slot.date
                  return (
                    <label
                      key={slot.date}
                      className={[
                        'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                        isSelected
                          ? slot.occupied
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-indigo-500 bg-indigo-500/10'
                          : slot.occupied
                            ? 'border-gray-700 bg-gray-800/30 hover:border-amber-600/50 hover:bg-gray-800'
                            : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name="cadence-slot"
                        value={slot.date}
                        checked={isSelected}
                        onChange={() => setSelectedDate(slot.date)}
                        className="sr-only"
                      />

                      <span
                        aria-hidden="true"
                        className={[
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                          isSelected
                            ? slot.occupied ? 'border-amber-500 bg-amber-500' : 'border-indigo-500 bg-indigo-500'
                            : 'border-gray-600 bg-transparent',
                        ].join(' ')}
                      >
                        {isSelected && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>

                      <span className="flex flex-1 items-center justify-between gap-2 min-w-0">
                        <span className="flex flex-col min-w-0">
                          <span
                            className={[
                              'text-[13px] font-medium truncate',
                              isSelected
                                ? slot.occupied ? 'text-amber-300' : 'text-indigo-300'
                                : 'text-gray-200',
                            ].join(' ')}
                          >
                            {slot.formattedDate}
                          </span>
                          {slot.occupied && slot.occupiedEdition && (
                            <span className="text-[11px] text-gray-500 truncate">
                              {slot.occupiedEdition.displayId} — {slot.occupiedEdition.subject || 'Sem título'}
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-gray-400">
                          {slot.occupied && (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                              {t.occupied}
                            </span>
                          )}
                          <span className="capitalize">{slot.dayOfWeek}</span>
                          <span className="text-gray-600">·</span>
                          <span>{slot.time}</span>
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>

              {/* Swap hint when occupied slot selected */}
              {isSwap && (
                <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-400">
                  {t.swap}
                </p>
              )}

              {hasMore && (
                <button
                  type="button"
                  onClick={onLoadMore}
                  className="mt-2 text-[13px] font-medium text-indigo-400 hover:text-indigo-300"
                >
                  {t.showMore}
                </button>
              )}
            </>
          )}

          {/* Divider + escape hatch */}
          <div className="mt-4 flex items-center gap-2">
            <span className="h-px flex-1 bg-gray-700" aria-hidden="true" />
            <span className="text-[11px] text-gray-500">{t.or}</span>
            <span className="h-px flex-1 bg-gray-700" aria-hidden="true" />
          </div>
          <button
            type="button"
            onClick={onSwitchToSpecial}
            className="mt-2 w-full text-center text-[12px] text-gray-400 hover:text-gray-200"
          >
            {t.scheduleAsSpecial}
          </button>
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-[13px] text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedDate}
            className={[
              'rounded-lg px-4 py-1.5 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50',
              isSwap
                ? 'bg-amber-600 hover:bg-amber-500'
                : 'bg-indigo-500 hover:bg-indigo-400',
            ].join(' ')}
          >
            {isSwap ? t.confirmSwap : t.confirm}
          </button>
        </div>
      </div>
    </div>
  )
}

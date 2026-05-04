'use client'

import { X, Plus, AlertTriangle, CheckCircle2, Clock, Send, XCircle } from 'lucide-react'
import type { ScheduleSlot, CadenceSlotState } from '../../_hub/hub-types'
import type { NewsletterHubStrings } from '../../_i18n/types'

interface DateDetailPopoverProps {
  date: string
  slot: ScheduleSlot | undefined
  locale: 'en' | 'pt-BR'
  strings?: NewsletterHubStrings
  onSchedule: () => void
  onClose: () => void
}

function stateIcon(state: CadenceSlotState) {
  switch (state) {
    case 'missed': return <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
    case 'failed': return <XCircle className="h-3.5 w-3.5 text-red-400" />
    case 'sent': return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
    case 'sending': return <Send className="h-3.5 w-3.5 text-yellow-400" />
    case 'filled': return <Clock className="h-3.5 w-3.5 text-indigo-400" />
    case 'empty_future': return <Plus className="h-3.5 w-3.5 text-gray-500" />
    case 'cancelled': return <XCircle className="h-3.5 w-3.5 text-gray-500" />
  }
}

function stateLabel(state: CadenceSlotState, strings?: NewsletterHubStrings): string {
  return strings?.slotStates?.[state === 'empty_future' ? 'emptyFuture' : state]
    ?? { missed: 'Missed', failed: 'Failed', sent: 'Sent', sending: 'Sending', filled: 'Scheduled', empty_future: 'Available', cancelled: 'Cancelled' }[state]
}

function formatDateHeading(dateStr: string, locale: 'en' | 'pt-BR'): string {
  const d = new Date(dateStr + 'T12:00:00')
  if (locale === 'pt-BR') {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  }
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function DateDetailPopover({ date, slot, locale, strings, onSchedule, onClose }: DateDetailPopoverProps) {
  const cadenceSlots = slot?.cadenceSlots ?? []
  const specialEditions = slot?.specialEditions ?? []
  const totalItems = cadenceSlots.length + specialEditions.length
  const hasEmptySlots = cadenceSlots.some(cs => cs.state === 'empty_future')
  const today = new Date().toISOString().slice(0, 10)
  const isPast = date < today

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-700 bg-gray-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-100">
            {formatDateHeading(date, locale)}
          </h3>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[360px] overflow-y-auto px-4 py-3">
          {totalItems === 0 ? (
            <p className="text-center text-[12px] text-gray-500">
              {locale === 'pt-BR' ? 'Nada agendado para este dia' : 'Nothing scheduled for this day'}
            </p>
          ) : (
            <div className="space-y-2">
              {cadenceSlots.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    {locale === 'pt-BR' ? 'Slots de cadência' : 'Cadence slots'}
                  </p>
                  {cadenceSlots.map((cs, idx) => (
                    <div
                      key={`cs-${idx}`}
                      className="flex items-center gap-2.5 rounded-lg border border-gray-800 bg-gray-800/30 px-3 py-2"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={cs.state === 'empty_future'
                          ? { border: `2px solid ${cs.typeColor}` }
                          : { backgroundColor: cs.typeColor }
                        }
                      />
                      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-medium text-gray-200 truncate">
                            {cs.state === 'empty_future' || cs.state === 'missed'
                              ? cs.typeName
                              : cs.editionSubject || cs.typeName
                            }
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {cs.editionDisplayId && cs.state !== 'empty_future' && cs.state !== 'missed' && (
                            <span className="text-[10px] font-mono text-gray-500">{cs.editionDisplayId}</span>
                          )}
                          <span className="text-[10px] text-gray-500">{cs.typeName}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {stateIcon(cs.state)}
                        <span className={`text-[10px] font-medium ${
                          cs.state === 'missed' || cs.state === 'failed' ? 'text-red-400' :
                          cs.state === 'sent' ? 'text-green-400' :
                          cs.state === 'sending' ? 'text-yellow-400' :
                          cs.state === 'filled' ? 'text-indigo-400' :
                          'text-gray-500'
                        }`}>
                          {stateLabel(cs.state, strings)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {specialEditions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    {locale === 'pt-BR' ? 'Edições especiais' : 'Special editions'}
                  </p>
                  {specialEditions.map((se) => (
                    <div
                      key={`se-${se.id}`}
                      className="flex items-center gap-2.5 rounded-lg border border-gray-800 bg-gray-800/30 px-3 py-2"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: se.typeColor }}
                      />
                      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                        <span className="text-[12px] font-medium text-gray-200 truncate">
                          {se.subject || (locale === 'pt-BR' ? '(sem título)' : '(untitled)')}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-gray-500">{se.displayId}</span>
                          {se.typeName && <span className="text-[10px] text-gray-500">{se.typeName}</span>}
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-gray-400">
                        ★ {locale === 'pt-BR' ? 'Especial' : 'Special'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {!isPast && (
          <div className="border-t border-gray-800 px-4 py-3">
            <button
              type="button"
              onClick={onSchedule}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500/10 px-3 py-2 text-[12px] font-medium text-indigo-400 hover:bg-indigo-500/20 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {hasEmptySlots
                ? (locale === 'pt-BR' ? 'Preencher slot vazio' : 'Fill empty slot')
                : (locale === 'pt-BR' ? 'Agendar edição neste dia' : 'Schedule edition on this day')
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

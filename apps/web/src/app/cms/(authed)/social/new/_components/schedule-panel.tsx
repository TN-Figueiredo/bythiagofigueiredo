'use client'

import { useMemo } from 'react'

interface SchedulePanelProps {
  selectedDate: string
  selectedTime: string
  onSelectDate: (date: string) => void
  onSelectTime: (time: string) => void
  bestTimes?: Record<string, string[]>
}

const HOURS = Array.from({ length: 15 }, (_, i) => {
  const h = i + 7  // 07:00 to 21:00
  return `${String(h).padStart(2, '0')}:00`
})

export function SchedulePanel({ selectedDate, selectedTime, onSelectDate, onSelectTime, bestTimes }: SchedulePanelProps) {
  const days = useMemo(() => {
    const result: Array<{ date: string; label: string; dayName: string }> = []
    const now = new Date()
    for (let i = 0; i < 7; i++) {
      const d = new Date(now)
      d.setDate(now.getDate() + i)
      result.push({
        date: d.toISOString().split('T')[0],
        label: i === 0 ? 'Hoje' : i === 1 ? 'Amanha' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        dayName: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
      })
    }
    return result
  }, [])

  const bestTimeSet = useMemo(() => {
    if (!bestTimes) return new Set<string>()
    return new Set(Object.values(bestTimes).flat())
  }, [bestTimes])

  return (
    <div className="space-y-4 animate-[ab-fade-up_300ms_ease-out]">
      {/* Day chips */}
      <div>
        <p className="mb-2 text-xs font-medium text-cms-text-dim">Dia</p>
        <div className="flex gap-2 overflow-x-auto">
          {days.map(day => (
            <button
              key={day.date}
              onClick={() => onSelectDate(day.date)}
              className={`flex shrink-0 flex-col items-center rounded-lg border px-3 py-2 transition-colors ${
                selectedDate === day.date
                  ? 'border-cms-accent bg-cms-accent/10 text-cms-accent'
                  : 'border-cms-border text-cms-text-muted hover:border-cms-text/20'
              }`}
            >
              <span className="text-[10px] uppercase">{day.dayName}</span>
              <span className="text-sm font-medium">{day.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Time chips */}
      <div>
        <p className="mb-2 text-xs font-medium text-cms-text-dim">Horario</p>
        <div className="flex flex-wrap gap-1.5">
          {HOURS.map(hour => {
            const isBest = bestTimeSet.has(hour)
            return (
              <button
                key={hour}
                onClick={() => onSelectTime(hour)}
                className={`relative rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  selectedTime === hour
                    ? 'border-cms-accent bg-cms-accent/10 text-cms-accent'
                    : 'border-cms-border text-cms-text-muted hover:border-cms-text/20'
                }`}
              >
                {hour}
                {isBest && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400" title="Melhor horario" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

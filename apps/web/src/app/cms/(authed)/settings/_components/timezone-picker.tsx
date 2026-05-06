'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'

interface TimezonePickerProps {
  value: string
  onChange: (tz: string) => void
  disabled?: boolean
}

interface TimezoneOption {
  name: string
  abbr: string
  offset: string
  offsetMinutes: number
}

const COMMON_TIMEZONES = [
  'America/Sao_Paulo',
  'America/New_York',
  'Europe/London',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
]

function getTimezoneInfo(tz: string): TimezoneOption {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'short',
  }).formatToParts(now)
  const abbr = parts.find((p) => p.type === 'timeZoneName')?.value ?? tz

  const utcMs = now.getTime()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const tzParts = formatter.formatToParts(now)
  const get = (type: string) =>
    tzParts.find((p) => p.type === type)?.value ?? '0'
  const tzMs = Date.UTC(
    parseInt(get('year')),
    parseInt(get('month')) - 1,
    parseInt(get('day')),
    parseInt(get('hour')),
    parseInt(get('minute')),
  )

  const utcFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const utcParts = utcFormatter.formatToParts(now)
  const getU = (type: string) =>
    utcParts.find((p) => p.type === type)?.value ?? '0'
  const realUtcMs = Date.UTC(
    parseInt(getU('year')),
    parseInt(getU('month')) - 1,
    parseInt(getU('day')),
    parseInt(getU('hour')),
    parseInt(getU('minute')),
  )

  const diffMin = Math.round((tzMs - realUtcMs) / 60000)
  const sign = diffMin >= 0 ? '+' : '-'
  const absMin = Math.abs(diffMin)
  const h = Math.floor(absMin / 60)
  const m = absMin % 60
  const offset = m > 0 ? `UTC${sign}${h}:${String(m).padStart(2, '0')}` : `UTC${sign}${h}`

  return { name: tz, abbr, offset, offsetMinutes: diffMin }
}

export function TimezonePicker({ value, onChange, disabled }: TimezonePickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const allTimezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone')
    } catch {
      return COMMON_TIMEZONES
    }
  }, [])

  const tzInfoCache = useMemo(() => {
    const map = new Map<string, TimezoneOption>()
    for (const tz of allTimezones) {
      map.set(tz, getTimezoneInfo(tz))
    }
    return map
  }, [allTimezones])

  const selectedInfo = useMemo(
    () => tzInfoCache.get(value) ?? getTimezoneInfo(value),
    [value, tzInfoCache],
  )

  const commonOptions = useMemo(
    () => COMMON_TIMEZONES.map((tz) => tzInfoCache.get(tz) ?? getTimezoneInfo(tz)),
    [tzInfoCache],
  )

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    const results: TimezoneOption[] = []
    for (const [, info] of tzInfoCache) {
      if (
        info.name.toLowerCase().includes(q) ||
        info.abbr.toLowerCase().includes(q) ||
        info.offset.toLowerCase().includes(q)
      ) {
        results.push(info)
        if (results.length >= 30) break
      }
    }
    return results.sort((a, b) => a.offsetMinutes - b.offsetMinutes)
  }, [search, tzInfoCache])

  const handleSelect = useCallback(
    (tz: string) => {
      onChange(tz)
      setOpen(false)
      setSearch('')
    },
    [onChange],
  )

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const showFiltered = search.trim().length > 0

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="flex w-full items-center justify-between rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:border-slate-500 disabled:opacity-50"
        data-testid="timezone-picker-trigger"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">{selectedInfo.name}</span>
          <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-xs text-indigo-400">
            {selectedInfo.abbr}
          </span>
          <span className="text-xs text-slate-500">{selectedInfo.offset}</span>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-md border border-slate-600 bg-slate-800 shadow-xl"
          data-testid="timezone-picker-dropdown"
        >
          <div className="border-b border-slate-700 p-2">
            <div className="flex items-center gap-2 rounded border border-slate-600 bg-slate-900 px-2 py-1.5">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className="shrink-0 text-slate-500"
              >
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
                <path
                  d="M9.5 9.5L12.5 12.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search timezone..."
                className="w-full bg-transparent text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
                data-testid="timezone-picker-search"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {!showFiltered && (
              <div className="py-1">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Common
                </div>
                {commonOptions.map((info) => (
                  <TimezoneRow
                    key={info.name}
                    info={info}
                    selected={info.name === value}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}

            {showFiltered && (
              <div className="py-1">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Results
                </div>
                {filteredOptions.length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-500">
                    No timezones found
                  </div>
                )}
                {filteredOptions.map((info) => (
                  <TimezoneRow
                    key={info.name}
                    info={info}
                    selected={info.name === value}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}

            {!showFiltered && (
              <div className="border-t border-slate-700 px-3 py-2">
                <span className="text-[10px] text-slate-500">
                  Type to search 400+ IANA timezones
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TimezoneRow({
  info,
  selected,
  onSelect,
}: {
  info: TimezoneOption
  selected: boolean
  onSelect: (tz: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(info.name)}
      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors hover:bg-slate-700/50 ${
        selected
          ? 'border-l-2 border-indigo-500 bg-indigo-500/10'
          : 'border-l-2 border-transparent'
      }`}
      data-testid={`timezone-option-${info.name}`}
    >
      <div className="flex items-center gap-2">
        <span className={selected ? 'text-slate-100' : 'text-slate-300'}>
          {info.name}
        </span>
        <span
          className={`rounded px-1 py-0.5 text-[10px] ${
            selected
              ? 'bg-indigo-500/20 text-indigo-300'
              : 'bg-slate-700 text-slate-400'
          }`}
        >
          {info.abbr}
        </span>
      </div>
      <span className="text-xs text-slate-500">{info.offset}</span>
    </button>
  )
}

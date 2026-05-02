'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface TypeSelectorProps {
  types: Array<{ id: string; name: string; color: string }>
  selectedTypeId: string | null
  onChange: (typeId: string | null) => void
  disabled?: boolean
}

export function TypeSelector({ types, selectedTypeId, onChange, disabled }: TypeSelectorProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selected = types.find((t) => t.id === selectedTypeId)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div className="relative" ref={dropdownRef}>
      <button type="button" onClick={() => !disabled && setOpen(!open)} disabled={disabled}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-white/5 disabled:opacity-50"
        style={{
          background: selected ? `${selected.color}20` : 'rgba(99,102,241,0.15)',
          color: selected ? selected.color : '#818cf8',
        }}>
        {selected && <span className="h-1.5 w-1.5 rounded-full" style={{ background: selected.color }} />}
        {selected?.name ?? 'No type'}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-[#111827] border border-[#374151] rounded-lg shadow-lg py-1 min-w-44">
          {types.map((t) => (
            <button key={t.id} type="button"
              onClick={() => { onChange(t.id); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors text-left ${t.id === selectedTypeId ? 'text-white' : 'text-[#d1d5db]'}`}>
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: t.color }} />
              {t.name}
              {t.id === selectedTypeId && <span className="ml-auto text-[#818cf8]">&#10003;</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

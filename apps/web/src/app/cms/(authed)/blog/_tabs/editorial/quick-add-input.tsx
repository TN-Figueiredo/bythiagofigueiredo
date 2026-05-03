'use client'

import { useCallback, useRef, useState, useTransition } from 'react'

interface QuickAddInputProps {
  placeholder: string
  onAdd: (title: string) => Promise<void>
}

export function QuickAddInput({ placeholder, onAdd }: QuickAddInputProps) {
  const [value, setValue] = useState('')
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return
    setValue('')
    startTransition(async () => {
      await onAdd(trimmed)
    })
  }, [value, onAdd])

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          handleSubmit()
        }
      }}
      placeholder={placeholder}
      className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-2.5 py-1.5 text-[11px] text-gray-300 placeholder-gray-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
    />
  )
}

'use client'

import { useCallback, useRef, useState } from 'react'

interface QuickAddInputProps {
  placeholder: string
  onAdd: (title: string) => Promise<void>
  disabled?: boolean
}

export function QuickAddInput({ placeholder, onAdd, disabled }: QuickAddInputProps) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim()
    if (!trimmed || submitting) return
    setValue('')
    setSubmitting(true)
    try {
      await onAdd(trimmed)
    } finally {
      setSubmitting(false)
      inputRef.current?.focus()
    }
  }, [value, onAdd, submitting])

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      disabled={disabled || submitting}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          void handleSubmit()
        }
      }}
      placeholder={placeholder}
      className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-2.5 py-1.5 text-[11px] text-gray-300 placeholder-gray-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 disabled:opacity-50"
    />
  )
}

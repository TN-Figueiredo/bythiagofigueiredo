'use client'

import { useState, useRef, useEffect } from 'react'

const COLOR_PRESETS = [
  '#7c3aed', '#ea580c', '#2563eb', '#16a34a', '#dc2626',
  '#ca8a04', '#0891b2', '#db2777', '#4f46e5', '#059669',
]

interface TypeModalProps {
  open: boolean
  mode: 'create' | 'edit'
  initial?: { name: string; tagline: string; color: string; locale: string }
  onSubmit: (data: { name: string; tagline: string; color: string; locale: string }) => void
  onCancel: () => void
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function TypeModal({ open, mode, initial, onSubmit, onCancel }: TypeModalProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [tagline, setTagline] = useState(initial?.tagline ?? '')
  const [color, setColor] = useState(initial?.color ?? '#7c3aed')
  const [locale, setLocale] = useState(initial?.locale ?? 'pt-BR')
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return

    const focusable = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    focusable?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel()
        return
      }
      if (e.key !== 'Tab') return
      const focusableEls = dialog!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      const first = focusableEls[0]
      const last = focusableEls[focusableEls.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({ name: name.trim(), tagline: tagline.trim(), color, locale })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="type-modal-title"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
      >
        <h3 id="type-modal-title" className="text-lg font-semibold text-gray-900">
          {mode === 'create' ? 'New Newsletter Type' : 'Edit Newsletter Type'}
        </h3>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="e.g. Weekly Digest"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="Short description for subscribers"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Locale</label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="pt-BR">Portugues (BR)</option>
              <option value="en">English</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 ${color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-7 w-7 rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

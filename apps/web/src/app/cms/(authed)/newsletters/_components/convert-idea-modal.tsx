'use client'

import { useState, useRef, useEffect } from 'react'

interface ConvertIdeaModalProps {
  open: boolean
  ideaTitle: string
  ideaCreatedAt: string
  types: Array<{ id: string; name: string; color: string }>
  onConfirm: (typeId: string, subject: string) => void
  onCancel: () => void
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function ConvertIdeaModal({ open, ideaTitle, ideaCreatedAt, types, onConfirm, onCancel }: ConvertIdeaModalProps) {
  const [subject, setSubject] = useState(ideaTitle)
  const [selectedTypeId, setSelectedTypeId] = useState(types[0]?.id ?? '')
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="convert-idea-modal-title"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
      >
        <h3 id="convert-idea-modal-title" className="text-lg font-semibold text-gray-900">Convert Idea to Edition</h3>
        <p className="mt-1 text-xs text-gray-400">
          Created {new Date(ideaCreatedAt).toLocaleDateString()}
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Newsletter Type</label>
            <div className="space-y-2">
              {types.map((type) => (
                <label
                  key={type.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${
                    selectedTypeId === type.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={type.id}
                    checked={selectedTypeId === type.id}
                    onChange={() => setSelectedTypeId(type.id)}
                    className="sr-only"
                  />
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: type.color }} />
                  <span className="text-sm font-medium">{type.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedTypeId, subject)}
            disabled={!subject.trim() || !selectedTypeId}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            Convert to Draft
          </button>
        </div>
      </div>
    </div>
  )
}

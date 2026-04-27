'use client'

import { useState } from 'react'

interface DeleteConfirmModalProps {
  open: boolean
  title: string
  description: string
  impactLevel: 'low' | 'medium' | 'high'
  onConfirm: (confirmText?: string) => void
  onCancel: () => void
}

export function DeleteConfirmModal({ open, title, description, impactLevel, onConfirm, onCancel }: DeleteConfirmModalProps) {
  const [confirmText, setConfirmText] = useState('')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{description}</p>

        {impactLevel === 'high' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-red-700 mb-1">
              Type DELETE to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded border border-red-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-red-500"
              placeholder="DELETE"
            />
          </div>
        )}

        {impactLevel === 'medium' && (
          <div className="mt-3 rounded bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs text-amber-700">This edition has content or is scheduled. This action cannot be undone.</p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(impactLevel === 'high' ? confirmText : undefined)}
            disabled={impactLevel === 'high' && confirmText !== 'DELETE'}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

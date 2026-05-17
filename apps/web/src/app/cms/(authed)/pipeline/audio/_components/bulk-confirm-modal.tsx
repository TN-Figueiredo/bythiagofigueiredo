'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type BulkAction = 'tag' | 'category' | 'status' | 'delete'

export interface BulkConfirmModalProps {
  action: BulkAction
  count: number
  onConfirm: (value?: string | string[]) => void
  onCancel: () => void
}

const CATEGORY_OPTIONS = [
  'cinematic',
  'ambient',
  'electronic',
  'impact',
  'drop',
  'riser',
] as const

const STATUS_OPTIONS = ['downloaded', 'pending', 'retired'] as const

export function BulkConfirmModal({
  action,
  count,
  onConfirm,
  onCancel,
}: BulkConfirmModalProps) {
  const [inputValue, setInputValue] = useState('')
  const [selectValue, setSelectValue] = useState<string>(
    action === 'category' ? CATEGORY_OPTIONS[0] : STATUS_OPTIONS[0],
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const selectRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    if (action === 'tag') {
      inputRef.current?.focus()
    } else if (action === 'category' || action === 'status') {
      selectRef.current?.focus()
    }
  }, [action])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    },
    [onCancel],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleSubmit = () => {
    if (action === 'delete') {
      onConfirm()
    } else if (action === 'tag') {
      const tags = inputValue
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      onConfirm(tags)
    } else {
      onConfirm(selectValue)
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const title =
    action === 'delete'
      ? `Delete ${count} assets?`
      : action === 'tag'
        ? `Set Tags for ${count} assets`
        : action === 'category'
          ? `Set Category for ${count} assets`
          : `Set Status for ${count} assets`

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-confirm-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--gem-surface)',
          border: '1px solid var(--gem-border)',
          borderRadius: 10,
          padding: '24px',
          maxWidth: 380,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <h2
          id="bulk-confirm-title"
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--gem-text)',
          }}
        >
          {title}
        </h2>

        {action === 'tag' && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Enter tags (comma-separated)"
            style={{
              background: 'var(--gem-well)',
              border: '1px solid var(--gem-border)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 14,
              color: 'var(--gem-text)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
        )}

        {action === 'category' && (
          <select
            ref={selectRef}
            value={selectValue}
            onChange={(e) => setSelectValue(e.target.value)}
            style={{
              background: 'var(--gem-well)',
              border: '1px solid var(--gem-border)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 14,
              color: 'var(--gem-text)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}

        {action === 'status' && (
          <select
            ref={selectRef}
            value={selectValue}
            onChange={(e) => setSelectValue(e.target.value)}
            style={{
              background: 'var(--gem-well)',
              border: '1px solid var(--gem-border)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 14,
              color: 'var(--gem-text)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}

        {action === 'delete' && (
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: 'var(--gem-muted)',
              lineHeight: 1.5,
            }}
          >
            This action cannot be undone. {count} selected asset
            {count !== 1 ? 's' : ''} will be permanently removed.
          </p>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'var(--gem-dim)',
              border: '1px solid var(--gem-border)',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--gem-muted)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            style={{
              background:
                action === 'delete' ? 'var(--gem-danger)' : 'var(--gem-accent)',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {action === 'delete' ? 'Delete' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  )
}

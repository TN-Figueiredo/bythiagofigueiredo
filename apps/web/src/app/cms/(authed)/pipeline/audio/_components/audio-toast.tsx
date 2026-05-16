'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'delete'
  message: string
  onUndo?: () => void
}

interface ToastItemProps {
  toast: Toast
  onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [countdown, setCountdown] = useState(5)
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    const duration = toast.type === 'success' ? 3000 : 5000
    const dismiss = setTimeout(() => onDismiss(toast.id), duration)

    if (toast.type === 'delete') {
      timerRef.current = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    }

    return () => { clearTimeout(dismiss); clearInterval(timerRef.current) }
  }, [toast, onDismiss])

  const borderColor = toast.type === 'error'
    ? 'color-mix(in srgb, var(--gem-danger) 30%, var(--gem-border))'
    : toast.type === 'delete'
      ? 'color-mix(in srgb, var(--gem-warn) 30%, var(--gem-border))'
      : 'var(--gem-border)'

  return (
    <div
      role="alert"
      style={{
        background: 'var(--gem-surface)', border: `1px solid ${borderColor}`,
        borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
        animation: 'fade-in-up 0.3s ease-out', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        fontSize: 11, color: 'var(--gem-text)', minWidth: 240, maxWidth: 360,
      }}
    >
      <span style={{ flexShrink: 0, fontSize: 12 }}>
        {toast.type === 'success' && <span style={{ color: 'var(--gem-done)' }}>✓</span>}
        {toast.type === 'error' && <span style={{ color: 'var(--gem-danger)' }}>✕</span>}
        {toast.type === 'delete' && <span style={{ color: 'var(--gem-warn)' }}>🗑</span>}
      </span>
      <span style={{ flex: 1 }}>{toast.message}</span>
      {toast.type === 'error' && (
        <button
          onClick={() => onDismiss(toast.id)}
          style={{
            fontSize: 10, color: 'var(--gem-danger)', background: 'none',
            border: 'none', cursor: 'pointer', fontWeight: 600,
          }}
        >
          Retry
        </button>
      )}
      {toast.type === 'delete' && toast.onUndo && (
        <button
          onClick={toast.onUndo}
          style={{
            fontSize: 10, color: 'var(--gem-warn)', background: 'none',
            border: 'none', cursor: 'pointer', fontWeight: 600,
          }}
        >
          Undo ({countdown}s)
        </button>
      )}
    </div>
  )
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev.slice(-2), { ...toast, id }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, dismissToast }
}

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', gap: 8, zIndex: 200,
      }}
    >
      {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  )
}

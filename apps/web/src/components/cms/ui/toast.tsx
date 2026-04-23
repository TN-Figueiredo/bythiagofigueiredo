'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  variant: ToastVariant
  message: string
  action?: { label: string; onClick: () => void }
}

interface ToastContextValue {
  toast: (variant: ToastVariant, message: string, action?: Toast['action']) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const BORDER_COLOR: Record<ToastVariant, string> = {
  success: 'border-l-cms-green',
  error: 'border-l-cms-red',
  warning: 'border-l-cms-amber',
  info: 'border-l-cms-accent',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((variant: ToastVariant, message: string, action?: Toast['action']) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev.slice(-2), { id, variant, message, action }])
    if (variant !== 'error' && variant !== 'warning') {
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000)
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-md:left-4 max-md:right-4 max-md:bottom-16 max-md:items-center">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-[var(--cms-radius)] border border-cms-border border-l-[3px] ${BORDER_COLOR[t.variant]} bg-cms-surface shadow-lg animate-[slideUp_200ms_ease-out] min-w-[280px] max-w-[420px]`}>
            <span className="text-[13px] text-cms-text flex-1">{t.message}</span>
            {t.action && (
              <button onClick={t.action.onClick} className="text-xs text-cms-accent font-medium hover:underline">
                {t.action.label}
              </button>
            )}
            <button onClick={() => dismiss(t.id)} className="text-cms-text-dim hover:text-cms-text text-sm">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'

interface CoworkDeepLinkProps {
  instruction: string
  label?: string
  variant?: 'button' | 'icon' | 'inline'
  shortcut?: string
  className?: string
  disabled?: boolean
}

export function CoworkDeepLink({
  instruction,
  label = 'Abrir no Cowork',
  variant = 'button',
  shortcut,
  className,
  disabled,
}: CoworkDeepLinkProps) {
  const [pending, setPending] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurFiredRef = useRef(false)
  const clickGuardRef = useRef(false)

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => cleanup, [cleanup])

  const handleClick = useCallback(() => {
    if (disabled) return
    if (clickGuardRef.current) return
    clickGuardRef.current = true
    setPending(true)
    blurFiredRef.current = false

    const onBlur = () => {
      blurFiredRef.current = true
      window.removeEventListener('blur', onBlur)
      cleanup()
      setPending(false)
      clickGuardRef.current = false
    }

    window.addEventListener('blur', onBlur)

    window.open(
      `claude://cowork/new?q=${encodeURIComponent(instruction)}`,
      '_self',
    )

    timerRef.current = setTimeout(() => {
      window.removeEventListener('blur', onBlur)
      if (!blurFiredRef.current) {
        navigator.clipboard
          .writeText(instruction)
          .then(() => toast.success('Instrução copiada — cole no Cowork'))
          .catch(() => toast.error('Falha ao copiar instrução'))
      }
      setPending(false)
      setTimeout(() => { clickGuardRef.current = false }, 1000)
    }, 500)
  }, [instruction, disabled, cleanup])

  const tooltip = instruction.length > 120 ? instruction.slice(0, 120) + '...' : instruction

  const disabledClasses = disabled ? ' opacity-50 pointer-events-none' : ''

  if (variant === 'icon') {
    return (
      <button
        type="button"
        title={tooltip}
        aria-label={label}
        aria-disabled={disabled || undefined}
        onClick={handleClick}
        className={(className ?? 'px-2 py-0.5 text-[10px] rounded transition-colors') + disabledClasses}
        style={
          className
            ? undefined
            : {
                background: 'color-mix(in srgb, var(--gem-accent) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--gem-accent) 30%, transparent)',
                color: 'var(--gem-accent)',
              }
        }
      >
        🤖 Cowork
      </button>
    )
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        title={tooltip}
        aria-label={label}
        aria-disabled={disabled || undefined}
        onClick={handleClick}
        className={
          (className ??
          'text-sm text-indigo-400 hover:text-indigo-300 underline-offset-2 hover:underline') + disabledClasses
        }
      >
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      title={tooltip}
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={handleClick}
      className={
        (className ??
        'rounded bg-gradient-to-r from-indigo-600 to-indigo-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-indigo-400') + disabledClasses
      }
    >
      <span className="inline-flex items-center gap-1.5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        {label}
        {shortcut && (
          <span
            className="text-[8px] px-1 rounded ml-1 border border-white/30 font-mono"
          >
            {shortcut}
          </span>
        )}
      </span>
    </button>
  )
}

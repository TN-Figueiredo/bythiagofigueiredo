'use client'

import { useCallback } from 'react'

interface CmsSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
  locked?: boolean
  /** Size variant: default (38x22) or compact (34x20) */
  size?: 'default' | 'compact'
  className?: string
}

/**
 * Accessible toggle switch.
 * Renders as `<button role="switch" aria-checked>` with keyboard support.
 *
 * - Locked variant: `aria-disabled="true"` + `tabindex="-1"`
 * - Touch target: 44px minimum on mobile via padding
 * - Responds to Space/Enter keypress
 */
export function CmsSwitch({
  checked,
  onChange,
  label,
  disabled = false,
  locked = false,
  size = 'default',
  className = '',
}: CmsSwitchProps) {
  const isDisabled = disabled || locked

  const handleClick = useCallback(() => {
    if (!isDisabled) onChange(!checked)
  }, [isDisabled, checked, onChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isDisabled) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        onChange(!checked)
      }
    },
    [isDisabled, checked, onChange]
  )

  const sizeClasses =
    size === 'compact'
      ? 'h-5 w-[34px] min-h-11 min-w-11 sm:min-h-5 sm:min-w-[34px]'
      : 'h-[22px] w-[38px] min-h-11 min-w-11 sm:min-h-[22px] sm:min-w-[38px]'

  const thumbSize = size === 'compact' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const thumbTranslate =
    size === 'compact'
      ? checked
        ? 'translate-x-[14px]'
        : 'translate-x-0.5'
      : checked
        ? 'translate-x-4'
        : 'translate-x-0.5'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={isDisabled || undefined}
      tabIndex={isDisabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={[
        'relative grid place-items-center rounded-full border transition-colors duration-150 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-cms-accent',
        sizeClasses,
        checked
          ? 'border-cms-accent bg-cms-accent'
          : 'border-cms-border bg-cms-surface-hover',
        isDisabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-150',
          thumbSize,
          thumbTranslate,
          checked ? 'bg-white' : 'bg-cms-text-dim',
        ].join(' ')}
      />
    </button>
  )
}

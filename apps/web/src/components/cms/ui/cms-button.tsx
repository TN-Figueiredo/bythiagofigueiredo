import { forwardRef, type ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

interface CmsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const BASE = 'inline-flex items-center justify-center gap-1.5 rounded-[var(--cms-radius)] font-medium cursor-pointer transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-cms-accent text-white hover:bg-cms-accent-hover',
  ghost: 'bg-transparent text-cms-text-muted border border-cms-border hover:text-cms-text hover:bg-cms-surface-hover',
  danger: 'bg-transparent text-cms-red border border-cms-red/30 hover:bg-cms-red-subtle',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-[13px]',
}

export const CmsButton = forwardRef<HTMLButtonElement, CmsButtonProps>(
  ({ variant = 'ghost', size = 'md', className = '', ...props }, ref) => (
    <button ref={ref} className={`${BASE} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`} {...props} />
  )
)
CmsButton.displayName = 'CmsButton'

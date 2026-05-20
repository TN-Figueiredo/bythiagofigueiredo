'use client'

import { SunIcon, MoonIcon } from './icons'

interface ThemeToggleProps {
  theme: string
  onToggle: () => void
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark'
  return (
    <button
      onClick={onToggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="w-7 h-7 rounded-full border border-[var(--pb-line)] flex items-center justify-center text-[var(--pb-faint)] transition-colors hover:text-[var(--pb-accent)] hover:border-[var(--pb-accent)]"
    >
      {isDark ? <SunIcon size={13} /> : <MoonIcon size={13} />}
    </button>
  )
}

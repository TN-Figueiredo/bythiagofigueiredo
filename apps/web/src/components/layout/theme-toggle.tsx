'use client'

import { useState, useTransition } from 'react'

type Props = {
  currentTheme: 'dark' | 'light'
  size?: number
}

export function ThemeToggle({ currentTheme, size = 32 }: Props) {
  const [theme, setTheme] = useState<'dark' | 'light'>(currentTheme)
  const [pending, startTransition] = useTransition()

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    startTransition(async () => {
      await fetch('/api/theme', {
        method: 'POST',
        body: JSON.stringify({ theme: next }),
        headers: { 'Content-Type': 'application/json' },
      })
      document.documentElement.dataset.theme = next
      document.documentElement.classList.toggle('dark', next === 'dark')
    })
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width: size,
        height: size,
        border: '1px dashed var(--pb-line)',
        background: 'transparent',
        borderRadius: 6,
        color: 'var(--pb-muted)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.5,
        transition: 'color 0.15s ease, border-color 0.15s ease',
      }}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  )
}

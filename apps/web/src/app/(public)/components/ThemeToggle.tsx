'use client'

import { useState, useTransition } from 'react'

type Props = { currentTheme: 'dark' | 'light' }

export function ThemeToggle({ currentTheme }: Props) {
  // useState so the icon updates immediately after click (prop alone is server-rendered, static)
  const [theme, setTheme] = useState<'dark' | 'light'>(currentTheme)
  const [pending, startTransition] = useTransition()

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next) // optimistic update — icon flips immediately
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
      className="text-pb-muted hover:text-pb-ink transition-colors text-sm font-mono px-2 py-1 rounded"
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  )
}

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface QuickAction {
  title: string
  href: string
  gradient: string
  icon: string
  shortcut: string
  domain: string
}

const ACTIONS: QuickAction[] = [
  {
    title: 'Novo Post',
    href: '/cms/blog?action=new',
    gradient: 'from-[var(--color-blog)] to-[#2dd4bf]',
    icon: 'P',
    shortcut: 'P',
    domain: 'blog',
  },
  {
    title: 'Novo Video',
    href: '/cms/youtube?action=new',
    gradient: 'from-[var(--color-video)] to-[#f97316]',
    icon: 'V',
    shortcut: 'V',
    domain: 'video',
  },
  {
    title: 'Nova Edicao',
    href: '/cms/newsletters?action=new',
    gradient: 'from-[var(--color-newsletter)] to-[var(--acc)]',
    icon: 'N',
    shortcut: 'N',
    domain: 'newsletter',
  },
  {
    title: 'Item Pipeline',
    href: '/cms/up-next?action=new',
    gradient: 'from-[var(--acc)] to-[#a78bfa]',
    icon: 'I',
    shortcut: 'I',
    domain: 'pipeline',
  },
]

export function DashboardQuickActions() {
  const router = useRouter()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input/textarea or using modifier keys
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return
      }

      const key = e.key.toUpperCase()
      const action = ACTIONS.find((a) => a.shortcut === key)
      if (action) {
        e.preventDefault()
        router.push(action.href)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router])

  return (
    <nav
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      data-testid="quick-actions"
      aria-label="Acoes rapidas"
    >
      {ACTIONS.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className={`group flex items-center gap-3 rounded-xl bg-gradient-to-br ${action.gradient} p-4 shadow-sm shadow-black/10 motion-safe:transition-transform motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]`}
          data-testid={`quick-action-${action.title.toLowerCase().replace(/\s+/g, '-')}`}
          aria-label={`${action.title} (atalho: ${action.shortcut})`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-sm font-bold text-white backdrop-blur-sm">
            {action.icon}
          </span>
          <span className="flex-1 text-sm font-semibold text-white">
            {action.title}
          </span>
          <kbd className="hidden rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white/60 sm:inline">
            {action.shortcut}
          </kbd>
        </Link>
      ))}
    </nav>
  )
}

'use client'

import { localePath } from '@/lib/i18n/locale-path'
import { ThemeToggle } from '@/components/ui/theme-toggle'

interface HubHeaderProps {
  locale?: string
}

export function HubHeader({ locale = 'en' }: HubHeaderProps) {
  return (
    <header className="fixed top-0 right-0 left-0 z-50 px-6 py-4">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <a href={localePath('/', locale)} className="text-base font-bold tracking-tight">
          @thiagonfigueiredo
        </a>
        <ThemeToggle />
      </div>
    </header>
  )
}

'use client'

import { usePathname } from 'next/navigation'
import type { HeaderCurrent } from './header-types'

export function useActiveNav(): HeaderCurrent {
  const pathname = usePathname() ?? '/'
  const bare = pathname.replace(/^\/pt\/?/, '/')

  if (bare === '/') return 'home'
  if (bare.startsWith('/blog')) return 'blog'
  if (bare.startsWith('/newsletters')) return 'newsletters'
  if (bare.startsWith('/about')) return 'about'
  if (bare.startsWith('/contact')) return 'contact'

  return 'home'
}

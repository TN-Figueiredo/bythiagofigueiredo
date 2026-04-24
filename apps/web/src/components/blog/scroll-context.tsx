'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { TocEntry } from './types'

type ScrollState = {
  activeSection: string | null
  progress: number
  sectionProgress: Map<string, number>
  visible: boolean
}

const ScrollContext = createContext<ScrollState>({
  activeSection: null,
  progress: 0,
  sectionProgress: new Map(),
  visible: false,
})

export function useScrollState() {
  return useContext(ScrollContext)
}

type Props = {
  sections: TocEntry[]
  children: ReactNode
}

export function ScrollProvider({ sections, children }: Props) {
  const [state, setState] = useState<ScrollState>({
    activeSection: null,
    progress: 0,
    sectionProgress: new Map(),
    visible: false,
  })

  useEffect(() => {
    const h2Sections = sections.filter((s) => s.depth === 2)
    const elements = h2Sections
      .map((s) => document.getElementById(s.slug))
      .filter(Boolean) as HTMLElement[]

    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((e) => e.isIntersecting)
        if (visibleEntry) {
          setState((prev) => ({ ...prev, activeSection: visibleEntry.target.id }))
        }
      },
      { rootMargin: '-80px 0px -60% 0px' },
    )

    elements.forEach((el) => observer.observe(el))

    const handleScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const globalProgress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0

      const sectionProgress = new Map<string, number>()
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i]!
        const next = elements[i + 1]
        const sectionTop = el.offsetTop - 100
        const sectionBottom = next ? next.offsetTop - 100 : document.documentElement.scrollHeight
        const sectionHeight = sectionBottom - sectionTop

        if (scrollTop >= sectionBottom) {
          sectionProgress.set(el.id, 1)
        } else if (scrollTop > sectionTop) {
          sectionProgress.set(el.id, (scrollTop - sectionTop) / sectionHeight)
        } else {
          sectionProgress.set(el.id, 0)
        }
      }

      const visible = globalProgress > 0.08 && globalProgress < 0.96

      setState((prev) => ({
        ...prev,
        progress: globalProgress,
        sectionProgress,
        visible,
      }))
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', handleScroll)
    }
  }, [sections])

  return <ScrollContext.Provider value={state}>{children}</ScrollContext.Provider>
}

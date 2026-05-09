'use client'

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import type { TocEntry } from './types'

type ScrollState = {
  activeSection: string | null
  progress: number
  sectionProgress: Map<string, number>
  visible: boolean
  resolvedSections: TocEntry[]
}

const ScrollContext = createContext<ScrollState>({
  activeSection: null,
  progress: 0,
  sectionProgress: new Map(),
  visible: false,
  resolvedSections: [],
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
    resolvedSections: sections,
  })

  const prevProgressRef = useRef<Map<string, number>>(new Map())
  const [scanTrigger, setScanTrigger] = useState(0)

  useEffect(() => {
    const handlePatched = () => setScanTrigger((n) => n + 1)
    window.addEventListener('headings-patched', handlePatched)
    return () => window.removeEventListener('headings-patched', handlePatched)
  }, [])

  useEffect(() => {
    const h2Sections = sections.filter((s) => s.depth === 2)
    let elements = h2Sections
      .map((s) => document.getElementById(s.slug))
      .filter(Boolean) as HTMLElement[]

    if (elements.length === 0) {
      const mainContent = document.getElementById('main-content')
      if (mainContent) {
        const domHeadings = mainContent.querySelectorAll<HTMLElement>('h2[id], h3[id]')
        if (domHeadings.length > 0) {
          const domSections: TocEntry[] = Array.from(domHeadings).map((el) => ({
            slug: el.id,
            text: el.textContent?.replace(/#$/, '').trim() ?? '',
            depth: (el.tagName === 'H2' ? 2 : 3) as 2 | 3,
          }))
          setState((prev) => ({ ...prev, resolvedSections: domSections }))
          elements = Array.from(domHeadings).filter((el) => el.tagName === 'H2') as HTMLElement[]
        }
      }
    }

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

    let ticking = false
    const handleScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const scrollTop = window.scrollY
        const docHeight = document.documentElement.scrollHeight - window.innerHeight
        const globalProgress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0

        const prev = prevProgressRef.current
        let mapChanged = false

        for (let i = 0; i < elements.length; i++) {
          const el = elements[i]!
          const next = elements[i + 1]
          const sectionTop = el.offsetTop - 100
          const sectionBottom = next ? next.offsetTop - 100 : document.documentElement.scrollHeight
          const sectionHeight = sectionBottom - sectionTop

          let value: number
          if (scrollTop >= sectionBottom) {
            value = 1
          } else if (scrollTop > sectionTop) {
            value = (scrollTop - sectionTop) / sectionHeight
          } else {
            value = 0
          }
          if (prev.get(el.id) !== value) mapChanged = true
          prev.set(el.id, value)
        }

        const visible = globalProgress > 0.08 && globalProgress < 0.96

        const nextProgress = mapChanged ? new Map(prev) : prev

        setState((prev) => {
          if (prev.progress === globalProgress && prev.visible === visible && !mapChanged) return prev
          return { ...prev, progress: globalProgress, sectionProgress: mapChanged ? nextProgress : prev.sectionProgress, visible }
        })
        ticking = false
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', handleScroll)
    }
  }, [sections, scanTrigger])

  return <ScrollContext.Provider value={state}>{children}</ScrollContext.Provider>
}

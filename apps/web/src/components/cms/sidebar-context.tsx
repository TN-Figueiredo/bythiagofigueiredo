'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

type SidebarMode = 'expanded' | 'collapsed' | 'mobile'

interface SidebarContextValue {
  mode: SidebarMode
  isExpanded: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue>({ mode: 'expanded', isExpanded: true, toggle: () => {} })

export function useSidebar() {
  return useContext(SidebarContext)
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SidebarMode>('expanded')

  useEffect(() => {
    function onResize() {
      const w = window.innerWidth
      if (w < 768) setMode('mobile')
      else if (w < 1280) setMode('collapsed')
      else setMode('expanded')
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const toggle = useCallback(() => {
    setMode((prev) => (prev === 'expanded' ? 'collapsed' : 'expanded'))
  }, [])

  return (
    <SidebarContext.Provider value={{ mode, isExpanded: mode === 'expanded', toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}

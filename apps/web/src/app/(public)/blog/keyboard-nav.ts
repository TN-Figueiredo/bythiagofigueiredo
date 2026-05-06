'use client'

import { useEffect, useCallback, useState } from 'react'

export function useKeyboardNav(totalCards: number) {
  const [activeIndex, setActiveIndex] = useState(-1)

  const navigate = useCallback((direction: 'next' | 'prev') => {
    setActiveIndex(prev => {
      if (direction === 'next') return Math.min(prev + 1, totalCards - 1)
      if (direction === 'prev') return Math.max(prev - 1, -1)
      return prev
    })
  }, [totalCards])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      switch (e.key) {
        case 'j':
          e.preventDefault()
          navigate('next')
          break
        case 'k':
          e.preventDefault()
          navigate('prev')
          break
        case 'Enter':
          if (activeIndex >= 0) {
            e.preventDefault()
            const card = document.querySelector(`[data-card-index="${activeIndex}"] a`) as HTMLElement
            card?.click()
          }
          break
        case '/':
          e.preventDefault()
          ;(document.querySelector('[data-search-input]') as HTMLInputElement)?.focus()
          break
        case 'Escape': {
          const focused = document.activeElement as HTMLElement
          if (focused?.tagName === 'INPUT') focused.blur()
          setActiveIndex(-1)
          break
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeIndex, navigate])

  useEffect(() => {
    if (activeIndex >= 0) {
      const el = document.querySelector(`[data-card-index="${activeIndex}"]`) as HTMLElement
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeIndex])

  return { activeIndex, setActiveIndex }
}

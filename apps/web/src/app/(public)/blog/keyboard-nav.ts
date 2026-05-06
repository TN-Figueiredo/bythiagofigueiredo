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
      const target = e.target
      if (target instanceof HTMLElement) {
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
        if (target.getAttribute('role') === 'textbox') return
      }

      // j/k/Enter only activate when focus is inside the blog grid or on body (no focused interactive element)
      const grid = document.querySelector('[data-blog-grid]')
      const activeEl = document.activeElement
      const isInsideGrid = grid?.contains(activeEl ?? null) ?? false
      const isOnBody = !activeEl || activeEl === document.body || !(activeEl instanceof HTMLElement)

      switch (e.key) {
        case 'j':
          if (!isInsideGrid && !isOnBody) return
          e.preventDefault()
          navigate('next')
          break
        case 'k':
          if (!isInsideGrid && !isOnBody) return
          e.preventDefault()
          navigate('prev')
          break
        case 'Enter':
          if (activeIndex >= 0) {
            e.preventDefault()
            const card = document.querySelector(`[data-card-index="${activeIndex}"] a`)
            if (card instanceof HTMLElement) card.click()
          }
          break
        case '/':
          e.preventDefault()
          {
            const searchInput = document.querySelector('[data-search-input]')
            if (searchInput instanceof HTMLInputElement) searchInput.focus()
          }
          break
        case 'Escape': {
          const focused = document.activeElement
          if (focused instanceof HTMLElement && focused.tagName === 'INPUT') focused.blur()
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
      const el = document.querySelector(`[data-card-index="${activeIndex}"]`)
      if (el instanceof HTMLElement) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeIndex])

  return { activeIndex, setActiveIndex }
}

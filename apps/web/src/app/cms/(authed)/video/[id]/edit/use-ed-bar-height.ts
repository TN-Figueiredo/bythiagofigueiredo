'use client'

import { useEffect, useState, type RefObject } from 'react'

/** Measures a target element's height and returns it as a px string for the --ed-bar-h CSS var. */
export function useEdBarHeight(ref: RefObject<HTMLElement | null>): string {
  const [h, setH] = useState('56px')
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? el.getBoundingClientRect().height
      if (height > 0) setH(`${Math.round(height)}px`)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return h
}

import { useEffect, useRef, useCallback } from 'react'

/**
 * Manages edge-fade classes on a horizontally-scrollable tab bar.
 *
 * - Adds `.scrolled` when scrollLeft > 8 (shows left fade)
 * - Adds `.at-end` when scrolled to the end (hides right fade)
 *
 * Returns a ref to attach to the scrollable container element.
 */
export function useTabEdgeFades<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return

    const { scrollLeft, scrollWidth, clientWidth } = el
    const threshold = 8

    if (scrollLeft > threshold) {
      el.classList.add('scrolled')
    } else {
      el.classList.remove('scrolled')
    }

    // At end when scroll position + visible width >= total scrollable width (with 2px tolerance)
    if (scrollLeft + clientWidth >= scrollWidth - 2) {
      el.classList.add('at-end')
    } else {
      el.classList.remove('at-end')
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Initial check
    update()

    // Scroll listener
    el.addEventListener('scroll', update, { passive: true })

    // ResizeObserver to re-check when container size changes
    const ro = new ResizeObserver(update)
    ro.observe(el)

    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [update])

  return ref
}

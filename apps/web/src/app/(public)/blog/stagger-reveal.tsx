'use client'

import { useEffect, useRef } from 'react'

export function useStaggerReveal(containerRef: React.RefObject<HTMLElement | null>) {
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const container = containerRef.current
    if (!container) return

    const cards = container.querySelectorAll<HTMLElement>('[data-stagger]')
    cards.forEach((card) => {
      card.style.opacity = '0'
      card.style.transform = 'translateY(20px)'
      card.style.transition = 'none'
    })

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const el = entry.target as HTMLElement
          const index = Number(el.dataset.stagger ?? 0)
          const delay = index * 60

          requestAnimationFrame(() => {
            el.style.transition = `opacity 0.3s ease-out ${delay}ms, transform 0.3s ease-out ${delay}ms`
            el.style.opacity = '1'
            el.style.transform = el.dataset.staggerTransform || 'translateY(0)'
          })

          observerRef.current?.unobserve(el)
        })
      },
      { threshold: 0.1 }
    )

    cards.forEach((card) => observerRef.current?.observe(card))

    return () => observerRef.current?.disconnect()
  }, [containerRef])
}

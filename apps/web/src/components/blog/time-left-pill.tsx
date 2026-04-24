'use client'

import { useState, useEffect } from 'react'
import { useScrollState } from './scroll-context'

type Props = {
  totalMinutes: number
  currentSection?: string
}

export function TimeLeftPill({ totalMinutes, currentSection }: Props) {
  const { progress, visible, activeSection } = useScrollState()
  const [show, setShow] = useState(false)

  const minutesLeft = Math.max(1, Math.round(totalMinutes * (1 - progress)))
  const sectionLabel = activeSection
    ? document.getElementById(activeSection)?.textContent?.trim()
    : currentSection

  useEffect(() => {
    if (!visible) { setShow(false); return }
    setShow(true)
    const timer = setTimeout(() => setShow(false), 3000)
    return () => clearTimeout(timer)
  }, [visible, progress])

  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout>
    const handleScroll = () => {
      if (visible) setShow(true)
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => setShow(false), 3000)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimer)
    }
  }, [visible])

  return (
    <div className="blog-time-pill" style={{ opacity: show ? 1 : 0, pointerEvents: show ? 'auto' : 'none' }}>
      <span>{minutesLeft} min</span> restantes
      {sectionLabel && <> · <span className="text-pb-ink font-sans">{sectionLabel}</span></>}
    </div>
  )
}

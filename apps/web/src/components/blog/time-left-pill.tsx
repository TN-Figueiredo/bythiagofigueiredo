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
  const [sectionLabel, setSectionLabel] = useState<string | undefined>(currentSection)

  const minutesLeft = Math.max(1, Math.round(totalMinutes * (1 - progress)))

  useEffect(() => {
    if (activeSection) {
      const el = document.getElementById(activeSection)
      setSectionLabel(el?.textContent?.trim() ?? currentSection)
    } else {
      setSectionLabel(currentSection)
    }
  }, [activeSection, currentSection])

  useEffect(() => {
    if (!visible) { setShow(false); return }
    setShow(true)
    let scrollTimer: ReturnType<typeof setTimeout>
    const hideTimer = setTimeout(() => setShow(false), 3000)

    const handleScroll = () => {
      setShow(true)
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => setShow(false), 3000)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      clearTimeout(hideTimer)
      clearTimeout(scrollTimer)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [visible])

  return (
    <div className="blog-time-pill" style={{ opacity: show ? 1 : 0, pointerEvents: show ? 'auto' : 'none' }} aria-live="polite">
      <span>{minutesLeft} min</span> restantes
      {sectionLabel && <> · <span className="text-pb-ink font-sans">{sectionLabel}</span></>}
    </div>
  )
}

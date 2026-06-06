'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface InspAccordionProps {
  icon: ReactNode
  title: string
  defaultOpen?: boolean
  badge?: ReactNode
  children: ReactNode
}

export function InspAccordion({ icon, title, defaultOpen = true, badge, children }: InspAccordionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="insp-card">
      <button
        type="button"
        className={`acc-head${open ? ' open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {icon}
        <span className="ih">{title}</span>
        <span className="grow" />
        {badge}
        <ChevronDown size={15} className="acc-chev lucide" />
      </button>
      <div className={`acc-wrap${open ? ' open' : ''}`}>
        <div className="acc-body">{children}</div>
      </div>
    </section>
  )
}

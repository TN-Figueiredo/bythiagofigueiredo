'use client'
/**
 * Frame of the pages that live INSIDE a channel (spec 5, A1.1): only the trail ("Canais › Leo Khev") and the time-zone note.
 * No section tabs and no niche bar: those belong to the Observatório's own pages, not to a channel's. The Link is imported
 * here, in the client module, so no Server Component hands a Link down as a prop (Next 16).
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ToastProvider } from './toasts'
import './trail-chrome.css'

export interface Crumb { text: string; href?: string }

export function TrailChrome({ crumbs, children }: { crumbs: Crumb[]; children: ReactNode }) {
  return (
    <div data-obs="" className="obs-ch-root">
      <ToastProvider>
        <div className="obs-ch-content">
          <div className="obs-tr-top">
            <nav className="crumbs" aria-label="Caminho">
              <ol>
                {crumbs.map((c, i) => {
                  const last = i === crumbs.length - 1
                  return (
                    <li key={i} aria-current={last ? 'page' : undefined}>
                      {!last && c.href ? <Link href={c.href}>{c.text}</Link> : c.text}
                    </li>
                  )
                })}
              </ol>
            </nav>
            <span className="obs-tr-tz">Horários em São Paulo</span>
          </div>
          <div className="obs-ch-screen">{children}</div>
        </div>
      </ToastProvider>
    </div>
  )
}

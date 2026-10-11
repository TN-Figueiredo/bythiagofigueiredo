'use client'
/**
 * A thumbnail of one version: the archived image (Vercel Blob) when there is one, otherwise the honest text.
 * The mockup's drawn placeholders are never shown as if they were the real image.
 * With `zoom` the thumbnail is a button (role="button", one Tab stop, Enter and space) with the magnifier in the corner: it opens the viewer
 * (spec 6.3, triggers 1 to 3). A version without an image is still a button: the viewer shows the explanatory frame, never a broken image.
 */
import type { KeyboardEvent } from 'react'
import { Icon } from '../_chrome/icons'
import type { ThumbImg } from './view-model'

/** What makes a thumbnail open the viewer: its accessible name and what to do with the element that was used (the focus goes back to it). */
export interface ThumbZoom { label: string; onOpen: (trigger: HTMLElement) => void }

/** `w`/`h` are the intrinsic size the box reserves before the image arrives (16:9); the CSS still sizes the box. */
export function Thumb({ t, dur, w = 320, h = 180, alt, zoom }: { t: ThumbImg; dur?: string | null; w?: number; h?: number; alt?: string; zoom?: ThumbZoom }) {
  const btn = zoom ? {
    role: 'button' as const, tabIndex: 0, 'aria-label': zoom.label,
    onClick: (e: { currentTarget: HTMLElement }) => zoom.onOpen(e.currentTarget),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zoom.onOpen(e.currentTarget) } },
  } : null
  const lupa = zoom ? <span className="th-lupa" aria-hidden="true"><Icon.zoom /></span> : null
  if (!t.src) return <div className={'th missing' + (zoom ? ' zoomable' : '')} data-thumb-missing="" {...btn}><span>{t.missing}</span>{lupa}</div>
  return (
    <div className={'th' + (zoom ? ' zoomable' : '')} data-thumb="" {...btn}>
      {/* eslint-disable-next-line @next/next/no-img-element -- archived blob of any host; next/image would need every blob host configured */}
      <img src={t.src} alt={alt ?? t.alt} width={w} height={h} loading="lazy" />
      {dur ? <span className="dur">{dur}</span> : null}
      {lupa}
    </div>
  )
}

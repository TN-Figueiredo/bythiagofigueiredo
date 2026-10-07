'use client'
/**
 * The row menu ⋯ of Canais (canais.html #menu). It is anchored to its button at every layout: the position is never
 * stored, it is measured from the button each time (open, every render, resize, any scroll, a size change of the
 * screen). `position: fixed` is not trusted to mean "the viewport" — an ancestor of the CMS shell captures it, which
 * in production threw the menu ~495 px to the right of the button — so the menu's own rect is measured and the
 * difference is corrected, whatever block resolves it.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import type { CanaisRow } from './view-model'
import { useCanAdminSite, siteAdminOnlyText } from '@/lib/cms/site-admin-context'

const GAP = 4, EDGE = 8
interface Box { left: number; top: number; right: number; bottom: number }

/** Where the menu goes, in viewport coordinates: below the button (right edges aligned), above when it does not fit below, always whole inside the viewport. */
export function placeMenu(btn: Box, menu: { w: number; h: number }, vp: { w: number; h: number }): { left: number; top: number } {
  const clamp = (v: number, max: number) => Math.max(EDGE, Math.min(v, max))
  const below = btn.bottom + GAP, above = btn.top - GAP - menu.h
  const top = below + menu.h <= vp.h - EDGE ? below : above >= EDGE ? above : clamp(below, vp.h - EDGE - menu.h)
  return { left: clamp(btn.right - menu.w, vp.w - EDGE - menu.w), top }
}

/** The ⋯ button of a channel in whichever view is on screen (table row or card). */
export const rowMenuButton = (id: string) => document.querySelector<HTMLElement>(`[data-obs-screen="canais"] [data-menu="${CSS.escape(id)}"]`)

export function RowMenu({ row, onClose, onOpen, onSync, onYoutube, onCopy, onRemove }: {
  row: CanaisRow
  /** Closes the menu; `focus` sends the focus back to the ⋯ button. */
  onClose: (focus: boolean) => void
  onOpen: () => void; onSync: () => void; onYoutube: () => void; onCopy: () => void; onRemove: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  // "Administrar o site" step: removing a channel is for admins; an editor reads why instead of a dead button.
  const canAdminSite = useCanAdminSite()
  useEffect(() => { close.current = onClose })

  const place = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (!el.style.left || !el.style.top) { el.style.left = '0px'; el.style.top = '0px' }
    const btn = rowMenuButton(row.id)
    if (!btn) { close.current(false); return }
    const b = btn.getBoundingClientRect()
    const vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight
    // the button scrolled out of sight: a menu with no visible anchor closes (a rect with no size says nothing: no layout)
    if ((b.width || b.height) && (b.bottom <= 0 || b.top >= vh || b.right <= 0 || b.left >= vw)) { close.current(false); return }
    const m = el.getBoundingClientRect()
    const want = placeMenu(b, { w: m.width, h: m.height }, { w: vw, h: vh })
    // m.left - style.left is the origin of whatever block resolves `fixed` here. The element always has a numeric
    // left/top (it is rendered at 0,0): with `auto` its rect would be its static position and the sum would be wrong.
    const left = parseFloat(el.style.left) + want.left - m.left, top = parseFloat(el.style.top) + want.top - m.top
    el.style.left = `${Math.round(left)}px`
    el.style.top = `${Math.round(top)}px`
  }, [row.id])

  // before every paint with the menu open: a render of the screen (the drawer arriving, a new sort) may move the button
  useLayoutEffect(() => { place() })
  useEffect(() => {
    const on = () => place()
    window.addEventListener('resize', on)
    document.addEventListener('scroll', on, { capture: true, passive: true })
    const root = document.querySelector('[data-obs-screen="canais"] .wrap'), btn = rowMenuButton(row.id)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(on)
    if (root) ro?.observe(root)
    if (btn) ro?.observe(btn)
    return () => { window.removeEventListener('resize', on); document.removeEventListener('scroll', on, { capture: true }); ro?.disconnect() }
  }, [place, row.id])
  // the first item takes the focus when the menu opens (menu button pattern)
  useEffect(() => { ref.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus({ preventScroll: true }) }, [row.id])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])')]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus() }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus() }
    if (e.key === 'Home') { e.preventDefault(); items[0]?.focus() }
    if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus() }
    if (e.key === 'Tab') onClose(false)
  }

  return (
    <div className="menu on" role="menu" aria-label="Ações do canal" ref={ref} data-menu-for={row.id} style={{ left: 0, top: 0 }} onKeyDown={onKey}>
      <button type="button" role="menuitem" onClick={onOpen}>Abrir detalhes</button>
      <button type="button" role="menuitem" disabled={row.backfill} title={row.backfill ? 'Ainda buscando vídeos: a sincronização só depois da busca' : undefined} onClick={onSync}>Sincronizar só este canal</button>
      <button type="button" role="menuitem" onClick={onYoutube}>Abrir no YouTube</button>
      <button type="button" role="menuitem" onClick={onCopy}><span className="cw">Copiar pedido para o Cowork</span></button>
      <hr />
      {canAdminSite
        ? <button type="button" role="menuitem" className="del" onClick={onRemove}>Remover canal…</button>
        : <p role="note" data-testid="admin-only-note" style={{ margin: 0, padding: '6px 12px', maxWidth: 220, fontSize: 11, lineHeight: 1.35, color: 'var(--muted)' }}>{siteAdminOnlyText('remover um canal')}</p>}
    </div>
  )
}

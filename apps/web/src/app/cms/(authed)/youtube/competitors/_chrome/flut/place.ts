// Where a floating surface goes, in viewport coordinates (port of the approved mockup's flut.js `posicionar`).
// Pure: the caller measures the trigger and the surface. Rules of the spec (telas v9, 19.1): prefers below, turns up
// when it does not fit, shifts sideways to stay off the edges, and when it fits on neither side takes the larger one
// with a capped height (the caller turns on inner scroll).
export interface Box { left: number; top: number; right: number; bottom: number }
export type Side = 'baixo' | 'cima' | 'lado'
export interface PlaceOpts {
  pref?: Side
  /** Horizontal alignment to the trigger when above or below. 'fim' = right edges aligned (the default). */
  align?: 'fim' | 'meio' | 'inicio'
  /** Centre the surface on this x instead (a chart tooltip follows the point, not the trigger's box). */
  cx?: number
  gap?: number
  /** pref 'lado': which side of the trigger is tried first (the other one second). Default 'direita'. */
  lado?: 'direita' | 'esquerda'
  /** pref 'lado': where it goes when it fits on neither side. Default 'baixo' (below, turning up if it must). */
  queda?: 'baixo' | 'cima'
  /** pref 'lado': false = never jump to the other side when the preferred one does not fit (it goes to `queda`). Default true. */
  outroLado?: boolean
}
export interface Placed { left: number; top: number; maxHeight: number | null; side: Side }

/** Distance kept from every edge of the viewport. */
export const EDGE = 8
/** Lowest height a squeezed surface keeps before it scrolls inside. */
const MIN_H = 80

export const maxWidthFor = (viewportW: number, maxW?: number): number => Math.min(maxW ?? Infinity, viewportW - 2 * EDGE)

export function place(anchor: Box, size: { w: number; h: number }, vp: { w: number; h: number }, o: PlaceOpts = {}): Placed {
  const G = o.gap ?? 6, { w } = size
  let h = size.h, pref: Side = o.pref ?? 'baixo'
  const clampY = (y: number) => Math.min(Math.max(EDGE, y), vp.h - h - EDGE)
  if (pref === 'lado') {
    const right = anchor.right + G, left = anchor.left - G - w
    const fitsRight = right + w <= vp.w - EDGE, fitsLeft = left >= EDGE
    const outro = o.outroLado !== false
    const x = (o.lado ?? 'direita') === 'esquerda' ? (fitsLeft ? left : outro && fitsRight ? right : null) : (fitsRight ? right : outro && fitsLeft ? left : null)
    if (x != null) {
      const maxHeight = h > vp.h - 2 * EDGE ? vp.h - 2 * EDGE : null
      if (maxHeight != null) h = maxHeight
      return { left: Math.round(x), top: Math.round(clampY(anchor.top)), maxHeight, side: 'lado' }
    }
    pref = o.queda ?? 'baixo' // fits on neither side: above or below
  }
  const below = vp.h - anchor.bottom - G - EDGE, above = anchor.top - G - EDGE
  const up = pref === 'cima' ? (h <= above ? true : h <= below ? false : above >= below) : (h <= below ? false : h <= above ? true : above > below)
  const room = up ? above : below
  let maxHeight: number | null = null
  if (h > room) { maxHeight = Math.min(Math.max(MIN_H, room), vp.h - 2 * EDGE); h = maxHeight }
  const aw = anchor.right - anchor.left
  const x = o.cx != null ? o.cx - w / 2 : o.align === 'meio' ? anchor.left + aw / 2 - w / 2 : o.align === 'inicio' ? anchor.left : anchor.right - w
  return {
    left: Math.round(Math.min(Math.max(EDGE, x), vp.w - w - EDGE)),
    top: Math.round(clampY(up ? anchor.top - G - h : anchor.bottom + G)),
    maxHeight, side: up ? 'cima' : 'baixo',
  }
}

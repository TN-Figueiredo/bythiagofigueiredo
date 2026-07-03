import type { Metadata } from 'next'
import type { ReactNode } from 'react'

/**
 * (embed) route group — third-party-embeddable surfaces (Surface 2:
 * /embed/waitlists/[slug]).
 *
 * Exists to ESCAPE the `(public)` shell: an iframe embed must render only its
 * own card — no TopStrip/GlobalHeader/PinboardFooter, no JSON-LD graph, and no
 * LGPD cookie banner (project rule: the banner lives ONLY in the (public)
 * layout; the embed sets no cookies and loads no analytics, so there is
 * nothing to consent to). The root layout still provides <html>/<body>,
 * globals.css (the --pb-* Pinboard tokens) and the font variables.
 *
 * `robots: noindex` — the embed is an iframe fragment, not a canonical page;
 * the hosted landing (/waitlists/[slug]) is the indexable surface.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function EmbedLayout({ children }: { children: ReactNode }) {
  return children
}

import type { ReactNode } from 'react'
import './_chrome/chrome.css'
import './_chrome/camadas.css'
import './_chrome/tokens-telas.css'

/**
 * Observatório layout: loads the chrome stylesheet. The niche/tab-dependent chrome (header, freshness, tabs with
 * counts, niche bar) is rendered by each page through <ObservatoryChromeServer>, because layouts do not receive
 * searchParams. The theme tokens are scoped to the chrome's own [data-obs] root, so the legacy dashboard that this
 * layout still wraps (until Task 23) keeps the CMS tokens untouched.
 */
export default function CompetitorsLayout({ children }: { children: ReactNode }) {
  return <div data-obs-layout="">{children}</div>
}

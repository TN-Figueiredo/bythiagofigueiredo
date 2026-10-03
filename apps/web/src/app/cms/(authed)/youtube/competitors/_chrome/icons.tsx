/** Chrome icons (port of chrome.js ICON). Stroke icons carry .obs-ch-i-s, filled ones .obs-ch-i-f; always aria-hidden. */
import type { ReactElement } from 'react'

const S = (d: ReactElement, w = 2) => (
  <svg className="obs-ch-i-s" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} aria-hidden="true" focusable="false">{d}</svg>
)

export const Icon = {
  plus: () => S(<path d="M12 5v14M5 12h14" />, 2.2),
  sync: () => S(<><path d="M20 11a8 8 0 0 0-14.6-4.5M4 13a8 8 0 0 0 14.6 4.5" /><path d="M4 4v4h4M20 20v-4h-4" /></>),
  dots: () => (
    <svg className="obs-ch-i-f" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
  ),
  warn: () => S(<><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18h.01" /></>),
  chev: () => (
    <svg className="obs-ch-chev obs-ch-i-s" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" /></svg>
  ),
  check: () => S(<path d="M5 12l5 5 9-10" />, 2.4),
  x: () => S(<path d="M6 6l12 12M18 6L6 18" />, 2.4),
  copy: () => S(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>),
  pin: () => S(<><path d="M9 3h6l-1 6 4 4H6l4-4z" /><path d="M12 13v8" /></>),
  info: () => S(<><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></>),
}

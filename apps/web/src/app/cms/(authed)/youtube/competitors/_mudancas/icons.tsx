/** Screen icons (port of the mockup's <symbol> sprite). Always aria-hidden; the text next to them carries the meaning. */
import type { CSSProperties, ReactElement } from 'react'

const PATHS: Record<string, ReactElement> = {
  title: <path d="M4 7V5h16v2M9 19h6M12 5v14" />,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></>,
  text: <path d="M4 6h16M4 10h16M4 14h10M4 18h7" />,
  up: <path d="M7 17 17 7M8 7h9v9" />,
  down: <path d="M7 7l10 10M17 8v9H8" />,
  flat: <path d="M5 9h14M5 15h14" />,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.5" /></>,
  bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  alert: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17v.5" /></>,
  revert: <><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>,
  arrowR: <path d="M5 12h14M13 6l6 6-6 6" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
}
export type IconName = keyof typeof PATHS

export function Ic({ name, style }: { name: IconName; style?: CSSProperties }) {
  return <svg className="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={style}>{PATHS[name]}</svg>
}

/** Icons of the per-video history (historico-video.html IC). Decorative: always aria-hidden. */
import type { ReactNode } from 'react'

export type HIconName = 'title' | 'thumb' | 'desc' | 'ext' | 'warn' | 'ab' | 'prev' | 'next' | 'chev'
  | 'neutro' | 'ganhou' | 'perdeu' | 'inconclusivo' | 'aguardando' | 'sem-serie' | 'sem-antes'

const P: Record<HIconName, { sw: string; cap?: boolean; join?: boolean; d: ReactNode }> = {
  title: { sw: '2.6', cap: true, d: <path d="M5 6h14M12 6v13" /> },
  thumb: { sw: '2.4', join: true, d: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6" /></> },
  desc: { sw: '2.6', cap: true, d: <path d="M4 7h16M4 12h16M4 17h10" /> },
  ext: { sw: '2', d: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /> },
  warn: { sw: '2', d: <path d="M12 3 2 20h20L12 3zM12 10v4M12 17h.01" /> },
  ab: { sw: '2', cap: true, d: <path d="M4 9h13l-3-3M20 15H7l3 3" /> },
  prev: { sw: '2', d: <path d="m15 18-6-6 6-6" /> },
  next: { sw: '2', d: <path d="m9 18 6-6-6-6" /> },
  chev: { sw: '2', d: <path d="m6 9 6 6 6-6" /> },
  neutro: { sw: '2.4', cap: true, d: <path d="M5 9h14M5 15h14" /> },
  ganhou: { sw: '2.4', cap: true, d: <path d="m5 15 7-7 7 7" /> },
  perdeu: { sw: '2.4', cap: true, d: <path d="m5 9 7 7 7-7" /> },
  inconclusivo: { sw: '2.2', cap: true, d: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 17h.01" /></> },
  aguardando: { sw: '2.2', cap: true, d: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> },
  'sem-serie': { sw: '2.2', cap: true, d: <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></> },
  'sem-antes': { sw: '2.2', cap: true, d: <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></> },
}

export function HIcon({ name, size }: { name: HIconName; size?: number }) {
  const p = P[name]
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.sw} strokeLinecap={p.cap ? 'round' : undefined}
      strokeLinejoin={p.join ? 'round' : undefined} aria-hidden="true" width={size} height={size}>
      {p.d}
    </svg>
  )
}

export const TYPE_COLOR = { title: 'var(--t-title)', thumb: 'var(--t-thumb)', desc: 'var(--t-desc)' } as const

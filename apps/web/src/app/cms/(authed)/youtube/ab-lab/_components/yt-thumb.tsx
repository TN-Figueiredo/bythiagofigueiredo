'use client'

import { Badge } from './ab-primitives'

interface YTThumbProps {
  thumbUrl?: string
  thumbBg?: string
  overlayText?: string
  duration?: string
  label?: string
  mini?: boolean
  className?: string
}

export function YTThumb({ thumbUrl, thumbBg, overlayText, duration, label, mini, className = '' }: YTThumbProps) {
  return (
    <div className={`relative aspect-video rounded-lg overflow-hidden bg-[#1a1814] ${className}`}>
      {thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbUrl} alt={overlayText ?? ''} referrerPolicy="no-referrer" className="size-full object-cover" />
      ) : thumbBg ? (
        <div className="size-full" style={{
          background: `linear-gradient(135deg, ${thumbBg}33 0%, ${thumbBg}11 50%, #1a181400 100%)`,
        }}>
          <div className="absolute inset-0" style={{
            background: `radial-gradient(circle at 40% 45%, ${thumbBg}44 0%, transparent 60%)`,
          }} />
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 8px, currentColor 8px, currentColor 9px)',
          }} />
          {!mini && overlayText && (
            <span className="absolute inset-0 flex items-center justify-center text-sm text-white/60 font-medium px-4 text-center line-clamp-2">
              {overlayText}
            </span>
          )}
        </div>
      ) : null}
      {!mini && duration && (
        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-3xs font-mono text-white">
          {duration}
        </span>
      )}
      {!mini && label && (
        <span className="absolute top-1.5 left-1.5">
          <Badge tone="accent">{label}</Badge>
        </span>
      )}
    </div>
  )
}

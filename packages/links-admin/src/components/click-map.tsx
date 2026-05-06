'use client'
import { useState } from 'react'
import type { GeoDataItem } from '../types'

// Simplified world map paths -- major countries only (reduces bundle size)
const COUNTRY_PATHS: Array<{ id: string; d: string; cx: number; cy: number }> = [
  { id: 'BR', d: 'M280 280 L320 270 L330 310 L310 340 L270 330 Z', cx: 300, cy: 305 },
  { id: 'US', d: 'M120 140 L220 140 L220 190 L120 190 Z', cx: 170, cy: 165 },
  { id: 'CA', d: 'M120 80 L220 80 L220 130 L120 130 Z', cx: 170, cy: 105 },
  { id: 'DE', d: 'M470 130 L490 130 L490 155 L470 155 Z', cx: 480, cy: 142 },
  { id: 'FR', d: 'M450 140 L470 140 L470 170 L450 170 Z', cx: 460, cy: 155 },
  { id: 'GB', d: 'M445 110 L460 110 L460 130 L445 130 Z', cx: 452, cy: 120 },
  { id: 'JP', d: 'M700 160 L720 155 L725 180 L710 185 Z', cx: 712, cy: 170 },
  { id: 'CN', d: 'M620 150 L700 140 L710 200 L630 210 Z', cx: 665, cy: 175 },
  { id: 'IN', d: 'M590 190 L630 190 L620 250 L590 240 Z', cx: 610, cy: 220 },
  { id: 'AU', d: 'M650 310 L730 300 L740 360 L660 370 Z', cx: 695, cy: 335 },
  { id: 'PT', d: 'M435 155 L442 155 L442 172 L435 172 Z', cx: 438, cy: 163 },
  { id: 'ES', d: 'M440 158 L465 158 L465 178 L440 178 Z', cx: 452, cy: 168 },
  { id: 'IT', d: 'M478 150 L490 150 L488 180 L476 175 Z', cx: 483, cy: 165 },
  { id: 'MX', d: 'M130 200 L190 195 L185 230 L130 235 Z', cx: 157, cy: 215 },
  { id: 'AR', d: 'M270 340 L300 335 L295 400 L265 395 Z', cx: 282, cy: 367 },
  { id: 'RU', d: 'M500 60 L700 50 L710 130 L510 135 Z', cx: 605, cy: 90 },
  { id: 'ZA', d: 'M480 330 L520 325 L525 360 L485 365 Z', cx: 502, cy: 347 },
  { id: 'KR', d: 'M695 155 L705 155 L705 170 L695 170 Z', cx: 700, cy: 162 },
]

export interface ClickMapProps {
  geoData: GeoDataItem[]
}

export function ClickMap({ geoData }: ClickMapProps) {
  const [tooltip, setTooltip] = useState<{
    country: string
    count: number
    x: number
    y: number
  } | null>(null)

  const countryMap = new Map(geoData.map((g) => [g.country, g.count]))
  const maxCount = Math.max(...geoData.map((g) => g.count), 1)

  return (
    <div className="relative">
      <svg data-testid="click-map" viewBox="0 0 800 420" className="h-64 w-full">
        {/* Background */}
        <rect x="0" y="0" width="800" height="420" fill="#f8fafc" rx="4" />

        {/* Country paths */}
        {COUNTRY_PATHS.map((country) => {
          const count = countryMap.get(country.id) ?? 0
          const opacity = count > 0 ? Math.max(count / maxCount, 0.15) : 0.05
          return (
            <path
              key={country.id}
              d={country.d}
              data-country={country.id}
              fill="#3b82f6"
              fillOpacity={opacity}
              stroke="#94a3b8"
              strokeWidth="0.5"
              className="cursor-pointer transition-opacity hover:stroke-blue-600 hover:stroke-2"
              onMouseEnter={() => {
                if (count > 0) {
                  setTooltip({ country: country.id, count, x: country.cx, y: country.cy })
                }
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          )
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute rounded bg-foreground px-2 py-1 text-xs text-background shadow-lg"
          style={{
            left: `${(tooltip.x / 800) * 100}%`,
            top: `${(tooltip.y / 420) * 100}%`,
            transform: 'translate(-50%, -120%)',
          }}
        >
          {tooltip.country}: {tooltip.count} clicks
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>0</span>
        <div className="flex h-2 w-24 overflow-hidden rounded">
          <div className="flex-1 bg-primary/10" />
          <div className="flex-1 bg-blue-300" />
          <div className="flex-1 bg-blue-500" />
          <div className="flex-1 bg-primary/90" />
        </div>
        <span>{maxCount}</span>
      </div>
    </div>
  )
}

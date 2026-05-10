import { getVvsTier } from '@/lib/pipeline/gem-design'

interface GemVvsRingProps {
  score: number
  size?: number
}

export function GemVvsRing({ score, size = 26 }: GemVvsRingProps) {
  const { color, strokeDashoffset } = getVvsTier(score)
  const circumference = 2 * Math.PI * 10
  const strokeWidth = size > 30 ? 3 : 2.5
  const fontSize = size > 30 ? 7 : 6

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 24 24" className="-rotate-90">
        <circle cx="12" cy="12" r="10" fill="none" stroke="var(--gem-border, #222d40)" strokeWidth={strokeWidth} />
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute font-bold"
        style={{ fontSize: `${fontSize}px`, color }}
      >
        {score}
      </span>
    </div>
  )
}

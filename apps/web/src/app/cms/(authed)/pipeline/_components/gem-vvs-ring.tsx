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
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label={`Validation score: ${score}%`}>
      <svg width={size} height={size} viewBox="0 0 24 24" className="-rotate-90" aria-hidden="true">
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
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <span
        className="absolute font-bold"
        style={{ fontSize: `${fontSize}px`, color, transition: 'color 0.3s' }}
      >
        {score}
      </span>
    </div>
  )
}

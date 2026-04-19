import { type ReactNode, type CSSProperties } from 'react'

type Props = {
  index: number
  variant?: 'paper' | 'paper2'
  className?: string
  /** Override the computed rotation — used by DualHero for precise hero angles */
  rotationDeg?: number
  children: ReactNode
}

export function PaperCard({ index, variant = 'paper', className = '', rotationDeg, children }: Props) {
  const computedRotate = (((index * 37) % 7) - 3) * 0.5
  const rotateDeg = rotationDeg ?? computedRotate
  const translateY = (((index * 53) % 5) - 2) * 2

  const style: CSSProperties = {
    transform: `rotate(${rotateDeg}deg) translateY(${translateY}px)`,
    backgroundColor: `var(--pb-${variant})`,
  }

  return (
    <div
      className={`relative rounded-sm transition-shadow hover:shadow-xl pb-rotate ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}

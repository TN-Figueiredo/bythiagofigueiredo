import { type ReactNode, type CSSProperties } from 'react'

type Props = {
  index: number
  variant?: 'paper' | 'paper2'
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export function PaperCard({ index, variant = 'paper', className = '', style: extraStyle, children }: Props) {
  const computedRotate = (((index * 37) % 7) - 3) * 0.5
  const translateY = (((index * 53) % 5) - 2) * 2

  const baseStyle: CSSProperties = {
    transform: `rotate(${computedRotate}deg) translateY(${translateY}px)`,
    backgroundColor: `var(--pb-${variant})`,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    boxShadow: 'var(--pb-card-shadow)',
    ...extraStyle,
  }

  return (
    <div
      className={`relative ${className}`}
      style={baseStyle}
    >
      {children}
    </div>
  )
}

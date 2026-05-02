import type { CSSProperties } from 'react'

interface TapeProps {
  color?: string
  className?: string
  style?: CSSProperties
}

export function Tape({ color = 'var(--pb-tape)', className, style }: TapeProps) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        width: 80,
        height: 18,
        background: color,
        borderRadius: 1,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
        zIndex: 0,
        ...style,
      }}
    />
  )
}

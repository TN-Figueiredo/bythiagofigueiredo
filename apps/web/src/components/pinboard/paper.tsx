import type { CSSProperties, ReactNode } from 'react'

interface PaperProps {
  children: ReactNode
  tint?: string
  padding?: string
  rotation?: number
  translateY?: number
  shadow?: boolean
  className?: string
  style?: CSSProperties
}

export function Paper({
  children,
  tint = 'var(--pb-paper)',
  padding = '20px',
  rotation = 0,
  translateY = 0,
  shadow = true,
  className,
  style,
}: PaperProps) {
  return (
    <div
      className={className}
      style={{
        background: tint,
        padding,
        transform: `rotate(${rotation}deg) translateY(${translateY}px)`,
        boxShadow: shadow
          ? '0 1px 4px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)'
          : undefined,
        borderRadius: 6,
        position: 'relative',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

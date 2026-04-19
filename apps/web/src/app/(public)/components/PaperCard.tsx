import { type ReactNode } from 'react'

type Props = {
  index: number
  variant?: 'paper' | 'paper2'
  className?: string
  children: ReactNode
}

export function PaperCard({ className = '', children }: Props) {
  return <div className={`relative ${className}`}>{children}</div>
}

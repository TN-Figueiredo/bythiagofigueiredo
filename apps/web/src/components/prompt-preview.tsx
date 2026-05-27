'use client'

import type { ReactNode } from 'react'

interface PromptPreviewProps {
  children: ReactNode
  maxHeight?: string
  className?: string
}

export function PromptPreview({ children, maxHeight = '14rem', className = '' }: PromptPreviewProps) {
  return (
    <pre
      className={`overflow-auto rounded-md bg-[#0c1222] p-3 text-xs leading-relaxed text-[#a0aec0] ${className}`}
      style={{ maxHeight }}
    >
      {children}
    </pre>
  )
}

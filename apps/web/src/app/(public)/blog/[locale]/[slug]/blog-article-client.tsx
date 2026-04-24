'use client'

import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

export function BlogArticleClient({ children }: Props) {
  return (
    <div className="reader-pinboard reader-article">
      {children}
    </div>
  )
}

import * as React from 'react'

interface ShikiCodeBlockProps {
  children?: string
  language?: string
}

export function ShikiCodeBlock({ children, language }: ShikiCodeBlockProps) {
  return (
    <pre data-shiki data-lang={language}>
      <code>{children}</code>
    </pre>
  )
}

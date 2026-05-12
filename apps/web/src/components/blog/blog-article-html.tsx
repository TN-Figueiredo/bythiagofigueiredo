'use client'

import { useEffect, useRef } from 'react'
import { EmbedHydrator } from './embed-hydrator'

interface BlogArticleHtmlProps {
  html: string
}

export function BlogArticleHtml({ html }: BlogArticleHtmlProps) {
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!bodyRef.current) return
    const hydrator = new EmbedHydrator(bodyRef.current)
    hydrator.hydrate()
    return () => hydrator.cleanup()
  }, [html])

  return <div ref={bodyRef} dangerouslySetInnerHTML={{ __html: html }} />
}

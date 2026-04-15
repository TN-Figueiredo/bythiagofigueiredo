import * as React from 'react'
import type { ComponentRegistry } from '../interfaces/content-renderer'

function Callout({ type = 'tip', children }: { type?: 'tip' | 'warning' | 'error'; children: React.ReactNode }) {
  return (
    <aside data-callout={type} role="note">
      {children}
    </aside>
  )
}

function YouTube({ videoId, title }: { videoId: string; title?: string }) {
  return (
    <iframe
      src={`https://www.youtube.com/embed/${videoId}`}
      title={title ?? 'YouTube video'}
      loading="lazy"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
}

function Image({ src, alt, width, height }: { src: string; alt: string; width?: number; height?: number }) {
  return <img src={src} alt={alt} width={width} height={height} loading="lazy" />
}

export const defaultComponents: ComponentRegistry = {
  Callout: Callout as React.ComponentType<Record<string, unknown>>,
  YouTube: YouTube as React.ComponentType<Record<string, unknown>>,
  Image: Image as React.ComponentType<Record<string, unknown>>,
}

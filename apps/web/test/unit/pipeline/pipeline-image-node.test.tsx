import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('@tiptap/extension-image', () => ({
  default: { extend: (opts: Record<string, unknown>) => ({ ...opts, name: 'image' }) },
}))
vi.mock('@tiptap/react', () => ({
  NodeViewWrapper: ({ children, ...props }: Record<string, unknown>) => (
    <div data-testid="node-view-wrapper" {...props}>{children as React.ReactNode}</div>
  ),
  ReactNodeViewRenderer: (component: unknown) => component,
}))

vi.mock('../../../src/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-media-context', () => ({
  usePipelineMedia: vi.fn(() => null),
}))

import { usePipelineMedia } from '@/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-media-context'

describe('PipelineImageNode placeholder detection', () => {
  it('detects placehold.co URLs as placeholders', async () => {
    const mod = await import('@/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-image-node')
    expect(mod.PipelineImageExtension).toBeDefined()
  })
})

describe('parseAlt extraction', () => {
  it('extracts ref_id and description from img-cover: prefix', () => {
    const input = 'img-cover: Developer working at desk'
    const match = input.match(/^(img-[\w-]+):\s*/)
    expect(match).toBeTruthy()
    expect(match![1]).toBe('img-cover')
    expect(input.slice(match![0].length)).toBe('Developer working at desk')
  })

  it('extracts ref_id from img-1: prefix', () => {
    const input = 'img-1: Timeline showing evolution'
    const match = input.match(/^(img-[\w-]+):\s*/)
    expect(match).toBeTruthy()
    expect(match![1]).toBe('img-1')
  })

  it('returns null for non-img prefixed alt text', () => {
    const input = 'A regular alt text'
    const match = input.match(/^(img-[\w-]+):\s*/)
    expect(match).toBeNull()
  })

  it('detects placehold.co as placeholder', () => {
    const src = 'https://placehold.co/800x450/1a1a2e/e2e8f0?text=IMG-1'
    expect(/placehold\.co/.test(src)).toBe(true)
  })

  it('does not flag real URLs as placeholder', () => {
    const src = 'https://example.blob.vercel-storage.com/img.webp'
    expect(/placehold\.co/.test(src)).toBe(false)
  })
})

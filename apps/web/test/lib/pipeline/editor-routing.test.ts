import { describe, it, expect } from 'vitest'
import { resolvePipelineEditorTarget } from '@/lib/pipeline/editor-routing'

describe('resolvePipelineEditorTarget', () => {
  it('routes a linked item straight to its blog editor', () => {
    expect(
      resolvePipelineEditorTarget({ blog_post_id: 'post-1', format: 'blog_post' }),
    ).toEqual({ kind: 'edit', postId: 'post-1' })
  })

  it('routes a linked item to its editor regardless of format', () => {
    // Once a post exists, the new editor is the surface even for legacy formats.
    expect(
      resolvePipelineEditorTarget({ blog_post_id: 'post-2', format: 'video' }),
    ).toEqual({ kind: 'edit', postId: 'post-2' })
  })

  it('asks to create a post for an unlinked blog item', () => {
    expect(
      resolvePipelineEditorTarget({ blog_post_id: null, format: 'blog_post' }),
    ).toEqual({ kind: 'create' })
  })

  it('keeps the legacy pipeline detail for unlinked non-blog items', () => {
    expect(
      resolvePipelineEditorTarget({ blog_post_id: null, format: 'video' }),
    ).toEqual({ kind: 'detail' })
    expect(
      resolvePipelineEditorTarget({ blog_post_id: null, format: 'newsletter' }),
    ).toEqual({ kind: 'detail' })
  })
})

import { describe, it, expect } from 'vitest'
import type { JSONContent } from '@tiptap/core'
import {
  BlogImageExtension,
  getNextImageId,
} from '@/app/cms/(authed)/blog/[id]/editor/image-block/blog-image-extension'

/* ------------------------------------------------------------------ */
/*  Extension definition                                              */
/* ------------------------------------------------------------------ */

describe('BlogImageExtension', () => {
  it('has name "blogImage"', () => {
    expect(BlogImageExtension.name).toBe('blogImage')
  })

  it('is configured as atom', () => {
    const config = BlogImageExtension.config
    expect(config.atom).toBe(true)
  })

  it('is configured as draggable', () => {
    const config = BlogImageExtension.config
    expect(config.draggable).toBe(true)
  })

  it('has all custom attributes with correct defaults', () => {
    // Instantiate the extension to access resolved attributes
    const ext = BlogImageExtension.configure()
    const schema = ext.extendNodeSchema?.(ext) ?? {}
    // Access addAttributes via config
    const attrs = BlogImageExtension.config.addAttributes?.call({
      parent: () => ({
        src: { default: null },
        alt: { default: '' },
        title: { default: null },
      }),
    })

    expect(attrs).toBeDefined()
    // Custom attributes
    expect(attrs!.id).toEqual({ default: null })
    expect(attrs!.caption).toEqual({ default: '' })
    expect(attrs!.status).toEqual({ default: 'empty' })
    expect(attrs!.alignment).toEqual({ default: 'column' })
    expect(attrs!.width).toEqual({ default: null })
    expect(attrs!.assetId).toEqual({ default: null })
  })

  it('inherits Image attributes (src, alt, title)', () => {
    const attrs = BlogImageExtension.config.addAttributes?.call({
      parent: () => ({
        src: { default: null },
        alt: { default: '' },
        title: { default: null },
      }),
    })

    expect(attrs).toBeDefined()
    // Inherited from Image base
    expect(attrs!.src).toEqual({ default: null })
    expect(attrs!.alt).toEqual({ default: '' })
    expect(attrs!.title).toEqual({ default: null })
  })
})

/* ------------------------------------------------------------------ */
/*  getNextImageId                                                     */
/* ------------------------------------------------------------------ */

describe('getNextImageId', () => {
  it('returns "img-1" for empty doc', () => {
    const doc: JSONContent = { type: 'doc', content: [] }
    expect(getNextImageId(doc)).toBe('img-1')
  })

  it('returns "img-1" for doc with no blogImage nodes', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
      ],
    }
    expect(getNextImageId(doc)).toBe('img-1')
  })

  it('returns "img-2" when doc has img-1', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'blogImage', attrs: { id: 'img-1', src: '/a.png' } },
      ],
    }
    expect(getNextImageId(doc)).toBe('img-2')
  })

  it('returns "img-4" when doc has img-1 and img-3 (skips gaps correctly)', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'blogImage', attrs: { id: 'img-1', src: '/a.png' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'gap' }] },
        { type: 'blogImage', attrs: { id: 'img-3', src: '/b.png' } },
      ],
    }
    expect(getNextImageId(doc)).toBe('img-4')
  })

  it('handles nested blogImage nodes', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            { type: 'blogImage', attrs: { id: 'img-5', src: '/c.png' } },
          ],
        },
      ],
    }
    expect(getNextImageId(doc)).toBe('img-6')
  })

  it('ignores nodes with non-matching id patterns', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'blogImage', attrs: { id: 'custom-id', src: '/a.png' } },
        { type: 'blogImage', attrs: { id: 'img-2', src: '/b.png' } },
      ],
    }
    expect(getNextImageId(doc)).toBe('img-3')
  })
})

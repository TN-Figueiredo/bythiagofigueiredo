import { Image } from '@tiptap/extension-image'
import { mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import { BlogImageView } from './blog-image-view'

/* ------------------------------------------------------------------ */
/*  BlogImage TipTap node extension                                   */
/* ------------------------------------------------------------------ */

export const BlogImageExtension = Image.extend({
  name: 'blogImage',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      id: { default: null },
      caption: { default: '' },
      status: { default: 'empty' },
      alignment: { default: 'column' },
      width: { default: null },
      assetId: { default: null },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-blog-image]',
        getAttrs: (el) => {
          const figure = el as HTMLElement
          const img = figure.querySelector('img')
          return {
            id: figure.getAttribute('data-image-id'),
            src: img?.getAttribute('src') ?? null,
            alt: img?.getAttribute('alt') ?? '',
            caption:
              figure.querySelector('figcaption')?.textContent ?? '',
            status: figure.getAttribute('data-status') ?? 'empty',
            alignment:
              figure.getAttribute('data-alignment') ?? 'column',
            width: figure.getAttribute('data-width')
              ? Number(figure.getAttribute('data-width'))
              : null,
            assetId: figure.getAttribute('data-asset-id') ?? null,
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const {
      id,
      caption,
      status,
      alignment,
      width,
      assetId,
      src,
      alt,
      title,
      ...imgAttrs
    } = HTMLAttributes

    return [
      'figure',
      mergeAttributes({
        'data-blog-image': '',
        'data-image-id': id,
        'data-status': status,
        'data-alignment': alignment,
        ...(width ? { 'data-width': String(width) } : {}),
        ...(assetId ? { 'data-asset-id': assetId } : {}),
        class: `blog-image blog-image-${alignment}`,
      }),
      [
        'img',
        mergeAttributes(imgAttrs, { src, alt, title, loading: 'lazy' }),
      ],
      ['figcaption', {}, caption || ''],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlogImageView)
  },
})

/* ------------------------------------------------------------------ */
/*  Sequential image ID helper                                        */
/* ------------------------------------------------------------------ */

export function getNextImageId(doc: JSONContent): string {
  let maxNum = 0

  function walk(node: JSONContent) {
    if (node.type === 'blogImage' && node.attrs?.id) {
      const match = (node.attrs.id as string).match(/^img-(\d+)$/)
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10))
    }
    if (node.content) node.content.forEach(walk)
  }

  walk(doc)
  return `img-${maxNum + 1}`
}

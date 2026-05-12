import { describe, it, expect } from 'vitest'
import { compileJsonContent } from '@/lib/cms/compile-json'
import type { JSONContent } from '@tiptap/core'

function doc(...content: JSONContent[]): JSONContent {
  return { type: 'doc', content }
}

function p(text: string): JSONContent {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

function h(level: number, text: string): JSONContent {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] }
}

describe('compileJsonContent', () => {
  it('compiles a paragraph to HTML', async () => {
    const result = await compileJsonContent(doc(p('Hello world')))
    expect(result.html).toContain('<p class="pb-p')
    expect(result.html).toContain('Hello world')
  })

  it('compiles headings with id slugs', async () => {
    const result = await compileJsonContent(doc(h(2, 'My Section')))
    expect(result.html).toContain('<h2')
    expect(result.html).toContain('id="my-section"')
    expect(result.html).toContain('pb-h2')
  })

  it('extracts TOC from h2 and h3', async () => {
    const result = await compileJsonContent(doc(
      h(2, 'Introduction'),
      p('some text'),
      h(3, 'Details'),
    ))
    expect(result.toc).toEqual([
      { slug: 'introduction', text: 'Introduction', depth: 2 },
      { slug: 'details', text: 'Details', depth: 3 },
    ])
  })

  it('computes reading time', async () => {
    const longText = 'word '.repeat(400)
    const result = await compileJsonContent(doc(p(longText)))
    expect(result.readingTimeMin).toBe(2)
  })

  it('applies spacing classes between blocks', async () => {
    const result = await compileJsonContent(doc(p('first'), p('second')))
    expect(result.html).toMatch(/sp-sm/)
  })

  it('does not add spacing class to first block', async () => {
    const result = await compileJsonContent(doc(p('only')))
    expect(result.html).not.toMatch(/sp-/)
  })

  it('compiles bullet list', async () => {
    const result = await compileJsonContent(doc({
      type: 'bulletList',
      content: [{
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }],
      }],
    }))
    expect(result.html).toContain('<ul class="pb-ul')
    expect(result.html).toContain('<li')
  })

  it('compiles ordered list', async () => {
    const result = await compileJsonContent(doc({
      type: 'orderedList',
      content: [{
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }],
      }],
    }))
    expect(result.html).toContain('<ol class="pb-ol')
  })

  it('compiles blockquote', async () => {
    const result = await compileJsonContent(doc({
      type: 'blockquote',
      content: [p('quote text')],
    }))
    expect(result.html).toContain('<blockquote class="pb-quote')
  })

  it('compiles horizontal rule', async () => {
    const result = await compileJsonContent(doc({ type: 'horizontalRule' }))
    expect(result.html).toContain('pb-divider')
  })

  it('compiles code block with language attr', async () => {
    const result = await compileJsonContent(doc({
      type: 'codeBlock',
      attrs: { language: 'typescript' },
      content: [{ type: 'text', text: 'const x = 1' }],
    }))
    expect(result.html).toContain('pb-code')
    expect(result.html).toContain('data-lang="typescript"')
  })

  it('compiles callout node', async () => {
    const result = await compileJsonContent(doc({
      type: 'callout',
      attrs: { variant: 'warning' },
      content: [{ type: 'text', text: 'Be careful' }],
    }))
    expect(result.html).toContain('pb-callout')
    expect(result.html).toContain('pb-callout-warning')
  })

  it('compiles CTA button', async () => {
    const result = await compileJsonContent(doc({
      type: 'ctaButton',
      attrs: {
        buttons: [{ text: 'Click', url: 'https://example.com', style: 'primary' }],
        align: 'center',
      },
    }))
    expect(result.html).toContain('pb-cta')
    expect(result.html).toContain('pb-cta-primary')
    expect(result.html).toContain('href="https://example.com"')
  })

  it('compiles task list (checklist)', async () => {
    const result = await compileJsonContent(doc({
      type: 'taskList',
      content: [{
        type: 'taskItem',
        attrs: { checked: true },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Done' }] }],
      }],
    }))
    expect(result.html).toContain('pb-checklist')
    expect(result.html).toContain('checked')
  })

  it('compiles toggle node', async () => {
    const result = await compileJsonContent(doc({
      type: 'toggleWrapper',
      content: [
        { type: 'toggleTitle', content: [{ type: 'text', text: 'FAQ' }] },
        { type: 'toggleBody', content: [p('Answer here')] },
      ],
    }))
    expect(result.html).toContain('<details')
    expect(result.html).toContain('pb-toggle')
    expect(result.html).toContain('<summary')
  })

  it('compiles columns node', async () => {
    const result = await compileJsonContent(doc({
      type: 'columns',
      attrs: { ratio: '2:1' },
      content: [
        { type: 'column', content: [p('left')] },
        { type: 'column', content: [p('right')] },
      ],
    }))
    expect(result.html).toContain('pb-columns')
    expect(result.html).toContain('pb-cols-2-1')
  })

  it('compiles table with caption', async () => {
    const result = await compileJsonContent(doc({
      type: 'table',
      attrs: { caption: 'My Table' },
      content: [{
        type: 'tableRow',
        content: [{
          type: 'tableHeader',
          content: [p('Header')],
        }],
      }, {
        type: 'tableRow',
        content: [{
          type: 'tableCell',
          content: [p('Cell')],
        }],
      }],
    }))
    expect(result.html).toContain('pb-table')
    expect(result.html).toContain('<caption')
    expect(result.html).toContain('My Table')
  })

  it('compiles social embed placeholder', async () => {
    const result = await compileJsonContent(doc({
      type: 'socialEmbed',
      attrs: { provider: 'youtube', url: 'https://youtube.com/watch?v=abc' },
    }))
    expect(result.html).toContain('pb-embed')
    expect(result.html).toContain('data-provider="youtube"')
    expect(result.html).toContain('data-url=')
  })

  it('compiles image with alt and caption', async () => {
    const result = await compileJsonContent(doc({
      type: 'image',
      attrs: { src: 'https://img.com/photo.jpg', alt: 'A photo', title: 'Caption text' },
    }))
    expect(result.html).toContain('pb-figure')
    expect(result.html).toContain('alt="A photo"')
    expect(result.html).toContain('Caption text')
  })

  it('compiles inline marks: bold, italic, code, highlight, link', async () => {
    const result = await compileJsonContent(doc({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
        { type: 'text', text: 'code', marks: [{ type: 'code' }] },
        { type: 'text', text: 'highlighted', marks: [{ type: 'highlight' }] },
        { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://ex.com' } }] },
      ],
    }))
    expect(result.html).toContain('<strong>')
    expect(result.html).toContain('<em>')
    expect(result.html).toContain('<code>')
    expect(result.html).toContain('<mark class="pb-mark">')
    expect(result.html).toContain('href="https://ex.com"')
  })

  it('sanitizes javascript: URLs in links', async () => {
    const result = await compileJsonContent(doc({
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'xss',
        marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
      }],
    }))
    expect(result.html).not.toContain('javascript:')
  })

  it('returns empty result for empty doc', async () => {
    const result = await compileJsonContent({ type: 'doc', content: [] })
    expect(result.html).toBe('')
    expect(result.toc).toEqual([])
    expect(result.readingTimeMin).toBe(0)
  })

  it('handles null/undefined content gracefully', async () => {
    const result = await compileJsonContent({ type: 'doc' } as JSONContent)
    expect(result.html).toBe('')
    expect(result.toc).toEqual([])
  })

  it('escapes HTML in text content', async () => {
    const result = await compileJsonContent(doc(p('<script>alert("xss")</script>')))
    expect(result.html).not.toContain('<script>')
    expect(result.html).toContain('&lt;script&gt;')
  })

  it('sanitizes data: URLs in images', async () => {
    const result = await compileJsonContent(doc({
      type: 'image',
      attrs: { src: 'data:text/html,<script>alert(1)</script>', alt: 'test' },
    }))
    expect(result.html).toContain('src="#"')
    expect(result.html).not.toContain('data:')
  })

  it('sanitizes file: URLs in links', async () => {
    const result = await compileJsonContent(doc({
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'local',
        marks: [{ type: 'link', attrs: { href: 'file:///etc/passwd' } }],
      }],
    }))
    expect(result.html).toContain('href="#"')
    expect(result.html).not.toContain('file:')
  })

  it('whitelists callout variants — rejects unknown', async () => {
    const result = await compileJsonContent(doc({
      type: 'callout',
      attrs: { variant: 'xss"><img onerror=alert(1)>' },
      content: [{ type: 'text', text: 'test' }],
    }))
    expect(result.html).toContain('pb-callout-info')
    expect(result.html).not.toContain('xss')
  })

  it('whitelists column ratios — rejects unknown', async () => {
    const result = await compileJsonContent(doc({
      type: 'columns',
      attrs: { ratio: '3:1:1' },
      content: [
        { type: 'column', content: [p('a')] },
        { type: 'column', content: [p('b')] },
      ],
    }))
    expect(result.html).toContain('pb-cols-1-1')
    expect(result.html).not.toContain('3-1-1')
  })

  it('whitelists heading levels — rejects invalid', async () => {
    const result = await compileJsonContent(doc({
      type: 'heading',
      attrs: { level: 99 },
      content: [{ type: 'text', text: 'bad level' }],
    }))
    expect(result.html).toContain('<h2')
    expect(result.html).not.toContain('<h99')
  })

  it('whitelists CTA align and style — rejects unknown', async () => {
    const result = await compileJsonContent(doc({
      type: 'ctaButton',
      attrs: {
        buttons: [{ text: 'Go', url: 'https://ex.com', style: 'danger' }],
        align: 'justify',
      },
    }))
    expect(result.html).toContain('pb-cta-align-center')
    expect(result.html).toContain('pb-cta-primary')
    expect(result.html).not.toContain('danger')
    expect(result.html).not.toContain('justify')
  })

  it('uses pb-table-caption for table caption', async () => {
    const result = await compileJsonContent(doc({
      type: 'table',
      attrs: { caption: 'Test Caption' },
      content: [{
        type: 'tableRow',
        content: [{ type: 'tableCell', content: [p('cell')] }],
      }],
    }))
    expect(result.html).toContain('pb-table-caption')
  })

  it('uses pb-check for checklist checkbox wrapper', async () => {
    const result = await compileJsonContent(doc({
      type: 'taskList',
      content: [{
        type: 'taskItem',
        attrs: { checked: false },
        content: [p('todo')],
      }],
    }))
    expect(result.html).toContain('pb-check')
  })

  it('compiles mergeTag node', async () => {
    const result = await compileJsonContent(doc({
      type: 'mergeTag',
      attrs: { tag: 'first_name' },
    }))
    expect(result.html).toContain('pb-merge-tag')
    expect(result.html).toContain('{{first_name}}')
  })

  it('compiles multiple marks on same text', async () => {
    const result = await compileJsonContent(doc({
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'strong link',
        marks: [
          { type: 'bold' },
          { type: 'link', attrs: { href: 'https://example.com' } },
        ],
      }],
    }))
    expect(result.html).toContain('<strong>')
    expect(result.html).toContain('<a href')
  })

  it('handles hardBreak inline node', async () => {
    const result = await compileJsonContent(doc({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'line 1' },
        { type: 'hardBreak' },
        { type: 'text', text: 'line 2' },
      ],
    }))
    expect(result.html).toContain('<br>')
  })

  it('renders callout with aria attributes', async () => {
    const result = await compileJsonContent(doc({
      type: 'callout',
      attrs: { variant: 'tip' },
      content: [{ type: 'text', text: 'hint' }],
    }))
    expect(result.html).toContain('role="note"')
    expect(result.html).toContain('aria-label="tip"')
  })

  it('skips unknown node types gracefully', async () => {
    const result = await compileJsonContent(doc(
      { type: 'unknownNode', content: [p('inner')] },
    ))
    expect(result.html).toContain('inner')
  })

  it('escapes HTML in social embed data attributes', async () => {
    const result = await compileJsonContent(doc({
      type: 'socialEmbed',
      attrs: { provider: 'youtube"><script>', url: 'https://yt.com/"><img src=x>' },
    }))
    expect(result.html).not.toContain('<script>')
    expect(result.html).not.toContain('<img')
    expect(result.html).toContain('&lt;script&gt;')
    expect(result.html).toContain('&quot;')
  })

  it('escapes HTML in CTA button text', async () => {
    const result = await compileJsonContent(doc({
      type: 'ctaButton',
      attrs: {
        buttons: [{ text: '<img onerror=alert(1)>', url: 'https://safe.com', style: 'primary' }],
        align: 'center',
      },
    }))
    expect(result.html).not.toContain('<img onerror')
    expect(result.html).toContain('&lt;img')
  })

  it('escapes HTML in merge tag attribute', async () => {
    const result = await compileJsonContent(doc({
      type: 'mergeTag',
      attrs: { tag: '"><script>alert(1)</script>' },
    }))
    expect(result.html).not.toContain('<script>')
    expect(result.html).toContain('&lt;script&gt;')
  })

  it('handles CTA with non-array buttons attr gracefully', async () => {
    const result = await compileJsonContent(doc({
      type: 'ctaButton',
      attrs: { buttons: 'not-an-array', align: 'center' },
    }))
    expect(result.html).toContain('pb-cta')
    expect(result.html).not.toContain('undefined')
  })

  it('handles deeply nested content', async () => {
    const result = await compileJsonContent(doc({
      type: 'blockquote',
      content: [{
        type: 'bulletList',
        content: [{
          type: 'listItem',
          content: [p('nested item')],
        }],
      }],
    }))
    expect(result.html).toContain('pb-quote')
    expect(result.html).toContain('pb-ul')
    expect(result.html).toContain('nested item')
  })

  it('generates CTA alignment class', async () => {
    const result = await compileJsonContent(doc({
      type: 'ctaButton',
      attrs: {
        buttons: [{ text: 'Go', url: 'https://ex.com', style: 'secondary' }],
        align: 'right',
      },
    }))
    expect(result.html).toContain('pb-cta-align-right')
    expect(result.html).toContain('pb-cta-secondary')
  })
})

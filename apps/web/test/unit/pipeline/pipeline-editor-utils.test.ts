import { describe, it, expect } from 'vitest'
import { isJSONContent, contentToEditorInput, extractHeadings } from '@/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-editor'

describe('isJSONContent', () => {
  it('returns true for valid Tiptap doc', () => {
    expect(isJSONContent({ type: 'doc', content: [] })).toBe(true)
  })

  it('returns false for plain string', () => {
    expect(isJSONContent('hello')).toBe(false)
  })

  it('returns false for null', () => {
    expect(isJSONContent(null)).toBe(false)
  })

  it('returns false for array', () => {
    expect(isJSONContent([{ type: 'doc' }])).toBe(false)
  })

  it('returns false for object without type=doc', () => {
    expect(isJSONContent({ type: 'paragraph' })).toBe(false)
  })
})

describe('contentToEditorInput', () => {
  it('returns empty string for null', () => {
    expect(contentToEditorInput(null)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(contentToEditorInput('')).toBe('')
  })

  it('returns empty string for whitespace-only', () => {
    expect(contentToEditorInput('   ')).toBe('')
  })

  it('converts markdown to HTML string', () => {
    const result = contentToEditorInput('## Hello **world**')
    expect(typeof result).toBe('string')
    expect(result).toContain('<h2>')
    expect(result).toContain('<strong>')
    expect(result).toContain('world')
  })

  it('converts bullet list markdown', () => {
    const result = contentToEditorInput('- item 1\n- item 2')
    expect(typeof result).toBe('string')
    expect(result).toContain('<li>')
  })

  it('passes through JSONContent unchanged', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph' }] }
    expect(contentToEditorInput(doc)).toBe(doc)
  })

  it('returns empty string for non-doc objects', () => {
    expect(contentToEditorInput({ foo: 'bar' })).toBe('')
  })
})

describe('extractHeadings', () => {
  it('returns empty array for null', () => {
    expect(extractHeadings(null)).toEqual([])
  })

  it('returns empty array for doc with no headings', () => {
    expect(extractHeadings({ type: 'doc', content: [{ type: 'paragraph' }] })).toEqual([])
  })

  it('extracts heading text', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section A' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body text' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Section B' }] },
      ],
    }
    expect(extractHeadings(doc)).toEqual(['Section A', 'Section B'])
  })

  it('handles headings with mixed inline content', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', text: 'world', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    }
    expect(extractHeadings(doc)).toEqual(['Hello world'])
  })
})

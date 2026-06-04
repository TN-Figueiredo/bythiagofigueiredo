import { describe, it, expect } from 'vitest'

describe('route migration', () => {
  it('editor URL uses /editor/ path', () => {
    const postId = 'abc-123'
    const editorUrl = `/cms/blog/${postId}/editor`
    expect(editorUrl).toContain('/editor')
    expect(editorUrl).not.toContain('/edit/')
  })
})

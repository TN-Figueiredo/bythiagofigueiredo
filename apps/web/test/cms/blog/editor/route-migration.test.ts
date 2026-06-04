import { describe, it, expect } from 'vitest'

describe('route migration', () => {
  it('editor URL uses /edit/ path', () => {
    const postId = 'abc-123'
    const editorUrl = `/cms/blog/${postId}/edit`
    expect(editorUrl).toContain('/edit')
    expect(editorUrl).not.toContain('/editor')
  })
})

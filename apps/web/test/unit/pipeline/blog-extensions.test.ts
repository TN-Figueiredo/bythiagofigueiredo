import { describe, it, expect } from 'vitest'
import { getExtensions } from '@/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-extensions'

describe('getBlogExtensions', () => {
  it('returns extensions for blog preset', () => {
    const extensions = getExtensions('blog')
    expect(extensions).toBeDefined()
    expect(extensions.length).toBeGreaterThan(0)
  })

  it('includes H1 headings via StarterKit', () => {
    const extensions = getExtensions('blog')
    // StarterKit is the first extension; its options expose the configured heading levels
    const starterKit = extensions[0] as { options?: { heading?: { levels?: number[] } } }
    const levels = starterKit.options?.heading?.levels ?? []
    expect(levels).toContain(1)
  })

  it('has more extensions than full preset', () => {
    const blog = getExtensions('blog')
    const full = getExtensions('full')
    expect(blog.length).toBeGreaterThan(full.length)
  })
})

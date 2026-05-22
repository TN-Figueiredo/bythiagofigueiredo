import { describe, it, expect } from 'vitest'
import { getExtensions } from '@/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-extensions'

describe('getBlogExtensions', () => {
  it('returns extensions for blog preset', () => {
    const extensions = getExtensions('blog')
    expect(extensions).toBeDefined()
    expect(extensions.length).toBeGreaterThan(0)
  })

  it('has more extensions than full preset', () => {
    const blog = getExtensions('blog')
    const full = getExtensions('full')
    expect(blog.length).toBeGreaterThan(full.length)
  })
})

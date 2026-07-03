// @vitest-environment node
// Server-only sanitizer — node makes isomorphic-dompurify build its own jsdom
// window, matching how the archive page renders in production. Never run
// DOMPurify ≥3.4.11 assertions under happy-dom (fails open there).
import { describe, it, expect } from 'vitest'
import { sanitizeArchiveHtml } from '@/lib/newsletter/archive-sanitizer'

describe('sanitizeArchiveHtml — public archive XSS policy', () => {
  it('environment canary: the DOMPurify pairing sanitizes correctly at all', () => {
    // If a dependency bump breaks the isomorphic-dompurify/dompurify/jsdom
    // pairing (fail-open returns input, fail-closed returns ''), this exact
    // assertion breaks loudly. Keep it strict equality.
    expect(sanitizeArchiveHtml('<p>x</p><script>y</script>')).toBe('<p>x</p>')
  })

  it('strips script tags and their content', () => {
    const out = sanitizeArchiveHtml('<p>Hello</p><script>alert("xss")</script>')
    expect(out).toContain('<p>Hello</p>')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('alert')
  })

  it('strips on* event handlers but keeps the element', () => {
    const out = sanitizeArchiveHtml('<img src="x.png" alt="" onerror="alert(1)">')
    expect(out).toContain('src="x.png"')
    expect(out).not.toContain('onerror')
  })

  it('strips javascript: URIs', () => {
    const out = sanitizeArchiveHtml('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('click')
  })

  it('strips iframes/objects while keeping email markup (tables)', () => {
    const out = sanitizeArchiveHtml(
      '<table><tr><td>cell</td></tr></table><iframe src="https://evil.example"></iframe><object data="x"></object>',
    )
    expect(out).toContain('<td>cell</td>')
    expect(out).not.toContain('<iframe')
    expect(out).not.toContain('<object')
  })

  it('keeps typical newsletter formatting intact', () => {
    const html = '<h1>Title</h1><p>Para with <strong>bold</strong> and <a href="https://example.com" target="_blank">link</a>.</p>'
    const out = sanitizeArchiveHtml(html)
    expect(out).toContain('<h1>Title</h1>')
    expect(out).toContain('<strong>bold</strong>')
    expect(out).toContain('href="https://example.com"')
  })
})

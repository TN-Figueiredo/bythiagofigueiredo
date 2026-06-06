// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { sanitizeContentHtml } from '@/lib/pipeline/sanitize-html'

describe('sanitizeContentHtml', () => {
  it('returns empty string for falsy input', () => {
    expect(sanitizeContentHtml('')).toBe('')
    expect(sanitizeContentHtml(null as unknown as string)).toBe('')
    expect(sanitizeContentHtml(undefined as unknown as string)).toBe('')
  })

  it('preserves safe HTML tags', () => {
    const html = '<p>Hello <strong>world</strong></p>'
    expect(sanitizeContentHtml(html)).toBe(html)
  })

  it('preserves headings', () => {
    const html = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>'
    expect(sanitizeContentHtml(html)).toBe(html)
  })

  it('preserves lists', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>'
    expect(sanitizeContentHtml(html)).toBe(html)
  })

  it('preserves tables', () => {
    const html =
      '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>'
    expect(sanitizeContentHtml(html)).toBe(html)
  })

  it('preserves links with safe attributes', () => {
    const html = '<a href="https://example.com" target="_blank" rel="noopener">Link</a>'
    expect(sanitizeContentHtml(html)).toBe(html)
  })

  it('preserves images with safe attributes', () => {
    const html = '<img src="https://example.com/img.png" alt="Photo" width="100" height="50">'
    const result = sanitizeContentHtml(html)
    expect(result).toContain('src="https://example.com/img.png"')
    expect(result).toContain('alt="Photo"')
  })

  it('preserves figure and figcaption', () => {
    const html = '<figure><img src="photo.jpg" alt="test"><figcaption>Caption</figcaption></figure>'
    const result = sanitizeContentHtml(html)
    expect(result).toContain('<figure>')
    expect(result).toContain('<figcaption>')
  })

  it('preserves code blocks', () => {
    const html = '<pre><code>const x = 1;</code></pre>'
    expect(sanitizeContentHtml(html)).toBe(html)
  })

  it('preserves blockquote', () => {
    const html = '<blockquote>A quote</blockquote>'
    expect(sanitizeContentHtml(html)).toBe(html)
  })

  it('preserves class and id attributes', () => {
    const html = '<div class="content" id="main"><span class="highlight">text</span></div>'
    expect(sanitizeContentHtml(html)).toBe(html)
  })

  // --- XSS prevention ---

  it('strips script tags', () => {
    const html = '<p>Hello</p><script>alert("xss")</script><p>World</p>'
    const result = sanitizeContentHtml(html)
    expect(result).not.toContain('<script')
    expect(result).not.toContain('alert')
    expect(result).toContain('<p>Hello</p>')
    expect(result).toContain('<p>World</p>')
  })

  it('strips iframe tags', () => {
    const html = '<p>Before</p><iframe src="https://evil.com"></iframe><p>After</p>'
    const result = sanitizeContentHtml(html)
    expect(result).not.toContain('<iframe')
    expect(result).toContain('<p>Before</p>')
  })

  it('strips object and embed tags', () => {
    const html = '<object data="evil.swf"></object><embed src="evil.swf">'
    const result = sanitizeContentHtml(html)
    expect(result).not.toContain('<object')
    expect(result).not.toContain('<embed')
  })

  it('strips form tags', () => {
    const html = '<form action="https://evil.com"><input type="text"></form>'
    const result = sanitizeContentHtml(html)
    expect(result).not.toContain('<form')
    expect(result).not.toContain('<input')
  })

  it('strips on* event handler attributes', () => {
    const html = '<img src="photo.jpg" onerror="alert(1)" alt="test">'
    const result = sanitizeContentHtml(html)
    expect(result).not.toContain('onerror')
    expect(result).toContain('src="photo.jpg"')
  })

  it('strips onclick handlers', () => {
    const html = '<a href="https://example.com" onclick="steal()">Click</a>'
    const result = sanitizeContentHtml(html)
    expect(result).not.toContain('onclick')
    expect(result).toContain('href="https://example.com"')
  })

  it('strips javascript: protocol from href', () => {
    // eslint-disable-next-line no-script-url
    const html = '<a href="javascript:alert(1)">Click</a>'
    const result = sanitizeContentHtml(html)
    expect(result).not.toContain('javascript:')
  })

  it('strips data attributes', () => {
    const html = '<div data-evil="payload" class="safe">Content</div>'
    const result = sanitizeContentHtml(html)
    expect(result).not.toContain('data-evil')
    expect(result).toContain('class="safe"')
  })

  it('strips style attributes', () => {
    const html = '<p style="background:url(evil)">Text</p>'
    const result = sanitizeContentHtml(html)
    expect(result).not.toContain('style')
    expect(result).toContain('<p>Text</p>')
  })

  it('handles complex nested XSS attempts', () => {
    const html = '<div><p>Safe</p><script>document.cookie</script><img src=x onerror=alert(1)></div>'
    const result = sanitizeContentHtml(html)
    expect(result).not.toContain('<script')
    expect(result).not.toContain('onerror')
    expect(result).toContain('<p>Safe</p>')
  })
})

import { describe, it, expect } from 'vitest'
import { sanitizeForEmail } from '@/lib/newsletter/email-sanitizer'

describe('sanitizeForEmail', () => {
  describe('XSS prevention', () => {
    it('strips script tags and their content', () => {
      const html = '<p>Hello</p><script>alert("xss")</script><p>World</p>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).not.toContain('<script')
      expect(result).not.toContain('alert')
      expect(result).toContain('Hello')
      expect(result).toContain('World')
    })

    it('strips style tags', () => {
      const html = '<style>body{display:none}</style><p>OK</p>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).not.toContain('<style')
      expect(result).toContain('OK')
    })

    it('strips all on* event handler attributes', () => {
      const html = '<img src="x.jpg" onerror="alert(1)" onload="track()">'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).not.toContain('onerror')
      expect(result).not.toContain('onload')
      expect(result).toContain('src="x.jpg"')
    })

    it('strips javascript: protocol in href', () => {
      const html = '<a href="javascript:alert(1)">Click</a>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).not.toContain('javascript:')
    })

    it('strips unquoted on* event handlers', () => {
      const html = '<img src="x.jpg" onerror=alert(1)>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).not.toContain('onerror')
      expect(result).not.toContain('alert')
    })

    it('strips javascript: protocol in unquoted href', () => {
      const html = '<a href=javascript:alert(1)>Click</a>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).not.toContain('javascript:')
    })
  })

  describe('CSS inlining via juice', () => {
    it('inlines link color from stylesheet', () => {
      const html = '<a href="https://example.com">Link</a>'
      const result = sanitizeForEmail(html, '#ff0000')
      expect(result).toContain('color:#ff0000')
      expect(result).toContain('style="')
    })

    it('inlines paragraph font-family and size', () => {
      const html = '<p>Test paragraph</p>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('font-size:16px')
      expect(result).toContain('font-family:Georgia,serif')
    })

    it('inlines CTA button background color', () => {
      const html = '<a class="cta-button" href="#">Buy</a>'
      const result = sanitizeForEmail(html, '#ea580c')
      expect(result).toContain('background:#ea580c')
    })
  })

  describe('image safety', () => {
    it('ensures display:block on images (prevents Gmail gaps)', () => {
      const html = '<img src="https://img.example.com/photo.jpg">'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('display:block')
    })

    it('enforces max-width:600px on images', () => {
      const html = '<img src="https://img.example.com/photo.jpg">'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('max-width:600px')
    })

    it('adds empty alt attribute to images missing alt text', () => {
      const html = '<img src="https://img.example.com/photo.jpg">'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('alt=""')
    })

    it('preserves existing alt text', () => {
      const html = '<img src="photo.jpg" alt="My photo">'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('alt="My photo"')
    })
  })

  describe('CTA button Outlook VML', () => {
    it('wraps .cta-button in conditional VML for Outlook', () => {
      const html = '<div class="cta-wrapper"><a class="cta-button" href="https://example.com" style="background:#7c3aed">Click</a></div>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('<!--[if mso]>')
      expect(result).toContain('v:roundrect')
      expect(result).toContain('href="https://example.com"')
      expect(result).toContain('<![endif]-->')
    })

    it('extracts background color from inline style for VML fill', () => {
      const html = '<a class="cta-button" href="#" style="background:#ea580c">Go</a>'
      const result = sanitizeForEmail(html, '#ea580c')
      expect(result).toContain('fillcolor="#ea580c"')
    })
  })

  describe('merge tag preservation', () => {
    it('preserves data-merge-tag spans in output HTML', () => {
      const html = '<p>Hi <span data-merge-tag="subscriber.name">{{subscriber.name}}</span></p>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('data-merge-tag="subscriber.name"')
      expect(result).toContain('{{subscriber.name}}')
    })
  })

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(sanitizeForEmail('', '#7c3aed')).toBe('')
    })

    it('handles nested HTML without crashing', () => {
      const html = '<div><table><tr><td><p>Nested</p></td></tr></table></div>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('Nested')
    })
  })
})

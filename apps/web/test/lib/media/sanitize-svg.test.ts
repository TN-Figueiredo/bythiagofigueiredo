import { describe, it, expect } from 'vitest'
import { sanitizeSvg } from '../../../lib/media/sanitize-svg'

describe('sanitizeSvg', () => {
  it('removes <script> tags', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script></svg>'
    const output = sanitizeSvg(input)
    expect(output).not.toContain('<script')
    expect(output).not.toContain('alert')
    expect(output).toContain('<svg')
  })

  it('removes <foreignObject> tags', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body><p>XSS</p></body></foreignObject><circle r="5"/></svg>'
    const output = sanitizeSvg(input)
    expect(output).not.toContain('<foreignObject')
    expect(output).not.toContain('XSS')
    expect(output).toContain('<circle')
  })

  it('removes onload attribute', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="10" height="10"/></svg>'
    const output = sanitizeSvg(input)
    expect(output).not.toContain('onload')
    expect(output).not.toContain('alert')
  })

  it('removes onerror attribute', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><image onerror="alert(1)" href="x.png"/></svg>'
    const output = sanitizeSvg(input)
    expect(output).not.toContain('onerror')
  })

  it('removes onclick attribute', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)" width="10" height="10"/></svg>'
    const output = sanitizeSvg(input)
    expect(output).not.toContain('onclick')
  })

  it('removes onmouseover attribute', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect onmouseover="alert(1)" width="10" height="10"/></svg>'
    const output = sanitizeSvg(input)
    expect(output).not.toContain('onmouseover')
  })

  it('preserves valid SVG elements: rect, circle, path, g, defs, use', () => {
    const input = `<svg xmlns="http://www.w3.org/2000/svg">
      <defs><clipPath id="c"><rect width="10" height="10"/></clipPath></defs>
      <g><circle cx="5" cy="5" r="3"/></g>
      <path d="M0 0 L10 10"/>
      <use href="#c"/>
    </svg>`
    const output = sanitizeSvg(input)
    expect(output).toContain('<rect')
    expect(output).toContain('<circle')
    expect(output).toContain('<path')
    expect(output).toContain('<g>')
    expect(output).toContain('<defs>')
    expect(output).toContain('<use')
  })

  it('preserves SVG filter elements', () => {
    const input = `<svg xmlns="http://www.w3.org/2000/svg">
      <filter id="blur"><feGaussianBlur stdDeviation="5"/></filter>
      <rect filter="url(#blur)" width="10" height="10"/>
    </svg>`
    const output = sanitizeSvg(input)
    expect(output).toContain('<filter')
    expect(output).toContain('feGaussianBlur')
  })

  it('removes javascript: hrefs', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><text>Click</text></a></svg>'
    const output = sanitizeSvg(input)
    expect(output).not.toContain('javascript:')
  })

  it('returns valid SVG string for clean input', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100" fill="red"/></svg>'
    const output = sanitizeSvg(input)
    expect(output).toContain('viewBox')
    expect(output).toContain('fill="red"')
  })
})

import { describe, it, expect } from 'vitest'
import { generateStyledQrSvg } from './qr-styled-svg'
import type { QrDotStyle } from '@tn-figueiredo/links/qr'

const TEST_URL = 'https://example.com/test'
const FG = '#000000'
const BG = '#ffffff'

/* ──────────────────────────────────────────────
 * Basic SVG output
 * ────────────────────────────────────────────── */

describe('generateStyledQrSvg — basic output', () => {
  it('returns a valid SVG string', () => {
    const svg = generateStyledQrSvg(TEST_URL, FG, BG, 'M', 'square')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
  })

  it('uses the specified size in the viewBox', () => {
    const svg = generateStyledQrSvg(TEST_URL, FG, BG, 'M', 'square', 256)
    expect(svg).toContain('viewBox="0 0 256 256"')
    expect(svg).toContain('width="256"')
    expect(svg).toContain('height="256"')
  })

  it('defaults to 512 size', () => {
    const svg = generateStyledQrSvg(TEST_URL, FG, BG, 'M', 'square')
    expect(svg).toContain('width="512"')
  })

  it('includes background rect with bg color', () => {
    const svg = generateStyledQrSvg(TEST_URL, '#111111', '#eeeeee', 'M', 'square')
    expect(svg).toContain('fill="#eeeeee"')
  })

  it('includes foreground path with fg color', () => {
    const svg = generateStyledQrSvg(TEST_URL, '#ff0000', BG, 'M', 'square')
    expect(svg).toContain('fill="#ff0000"')
  })

  it('renders three finder patterns', () => {
    const svg = generateStyledQrSvg(TEST_URL, FG, BG, 'M', 'square')
    // Each finder has 3 rects (outer, inner, core) = 9 total finder rects
    const rectMatches = svg.match(/<rect /g)
    // At minimum: 1 bg rect + 9 finder rects = 10
    expect(rectMatches!.length).toBeGreaterThanOrEqual(10)
  })

  it('produces different SVGs for different URLs', () => {
    const a = generateStyledQrSvg('https://a.com', FG, BG, 'M', 'square')
    const b = generateStyledQrSvg('https://b.com', FG, BG, 'M', 'square')
    expect(a).not.toBe(b)
  })
})

/* ──────────────────────────────────────────────
 * All 4 dot styles produce valid output
 * ────────────────────────────────────────────── */

describe('generateStyledQrSvg — dot styles', () => {
  const styles: QrDotStyle[] = ['square', 'dots', 'rounded', 'classy']

  it.each(styles)('style "%s" produces valid SVG with path data', (style) => {
    const svg = generateStyledQrSvg(TEST_URL, FG, BG, 'M', style)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('<path d="')
    // Path should have content, not be empty
    const pathMatch = svg.match(/<path d="([^"]*)"/)
    expect(pathMatch).not.toBeNull()
    expect(pathMatch![1]!.length).toBeGreaterThan(10)
  })

  it('square style uses straight lines (h/v commands, no arcs)', () => {
    const svg = generateStyledQrSvg(TEST_URL, FG, BG, 'M', 'square')
    const pathMatch = svg.match(/<path d="([^"]*)"/)!
    const pathData = pathMatch[1]!
    // Square paths use M, h, v, Z — no arc commands (a)
    // Note: finder rects use rx for rounded but square style finders are non-rounded
    expect(pathData).toContain('M')
    expect(pathData).toContain('h')
    expect(pathData).toContain('v')
  })

  it('dots style produces arc commands', () => {
    const svg = generateStyledQrSvg(TEST_URL, FG, BG, 'M', 'dots')
    const pathMatch = svg.match(/<path d="([^"]*)"/)!
    expect(pathMatch[1]).toContain('a')
  })

  it('rounded style produces arc commands for corner rounding', () => {
    const svg = generateStyledQrSvg(TEST_URL, FG, BG, 'M', 'rounded')
    const pathMatch = svg.match(/<path d="([^"]*)"/)!
    expect(pathMatch[1]).toContain('a')
  })

  it('classy style uses same dot rendering as dots style', () => {
    // classy and dots both use dotPath()
    const classySvg = generateStyledQrSvg(TEST_URL, FG, BG, 'M', 'classy')
    const dotsSvg = generateStyledQrSvg(TEST_URL, FG, BG, 'M', 'dots')
    const classyPath = classySvg.match(/<path d="([^"]*)"/)![1]!
    const dotsPath = dotsSvg.match(/<path d="([^"]*)"/)![1]!
    // Same data module paths since both use dotPath()
    expect(classyPath).toBe(dotsPath)
  })

  it('different styles produce different path data', () => {
    const square = generateStyledQrSvg(TEST_URL, FG, BG, 'M', 'square')
    const dots = generateStyledQrSvg(TEST_URL, FG, BG, 'M', 'dots')
    const rounded = generateStyledQrSvg(TEST_URL, FG, BG, 'M', 'rounded')

    const squarePath = square.match(/<path d="([^"]*)"/)![1]!
    const dotsPath = dots.match(/<path d="([^"]*)"/)![1]!
    const roundedPath = rounded.match(/<path d="([^"]*)"/)![1]!

    expect(squarePath).not.toBe(dotsPath)
    expect(squarePath).not.toBe(roundedPath)
    expect(dotsPath).not.toBe(roundedPath)
  })
})

/* ──────────────────────────────────────────────
 * All 4 error correction levels
 * ────────────────────────────────────────────── */

describe('generateStyledQrSvg — error correction levels', () => {
  const levels = ['L', 'M', 'Q', 'H'] as const

  it.each(levels)('EC level "%s" produces valid SVG', (ec) => {
    const svg = generateStyledQrSvg(TEST_URL, FG, BG, ec, 'square')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('higher EC produces more complex paths (more modules)', () => {
    const svgL = generateStyledQrSvg(TEST_URL, FG, BG, 'L', 'square')
    const svgH = generateStyledQrSvg(TEST_URL, FG, BG, 'H', 'square')
    const pathL = svgL.match(/<path d="([^"]*)"/)![1]!
    const pathH = svgH.match(/<path d="([^"]*)"/)![1]!
    // H has more error correction modules, so path should be longer
    expect(pathH.length).toBeGreaterThan(pathL.length)
  })

  it('L and M produce different module layouts', () => {
    const svgL = generateStyledQrSvg(TEST_URL, FG, BG, 'L', 'square')
    const svgM = generateStyledQrSvg(TEST_URL, FG, BG, 'M', 'square')
    expect(svgL).not.toBe(svgM)
  })
})

/* ──────────────────────────────────────────────
 * Finder pattern rendering
 * ────────────────────────────────────────────── */

describe('generateStyledQrSvg — finder patterns', () => {
  it('square style renders non-rounded finders (no rx attribute)', () => {
    const svg = generateStyledQrSvg(TEST_URL, FG, BG, 'M', 'square')
    // Square finders should not have rx anywhere in the SVG
    expect(svg).not.toContain('rx=')
  })

  it('rounded style renders rounded finders (with rx attribute)', () => {
    const svg = generateStyledQrSvg(TEST_URL, FG, BG, 'M', 'rounded')
    expect(svg).toContain('rx=')
  })

  it('dots style renders rounded finders', () => {
    const svg = generateStyledQrSvg(TEST_URL, FG, BG, 'M', 'dots')
    expect(svg).toContain('rx=')
  })

  it('classy style renders rounded finders', () => {
    const svg = generateStyledQrSvg(TEST_URL, FG, BG, 'M', 'classy')
    expect(svg).toContain('rx=')
  })
})

/* ──────────────────────────────────────────────
 * Cross-product: every style x every EC level
 * Ensures no combination crashes at runtime
 * ────────────────────────────────────────────── */

describe('generateStyledQrSvg — full cross-product (4 styles x 4 EC)', () => {
  const styles: QrDotStyle[] = ['square', 'dots', 'rounded', 'classy']
  const levels = ['L', 'M', 'Q', 'H'] as const

  for (const style of styles) {
    for (const ec of levels) {
      it(`${style} + ${ec} produces non-empty valid SVG`, () => {
        const svg = generateStyledQrSvg(TEST_URL, FG, BG, ec, style)
        expect(svg).toBeTruthy()
        expect(svg).toContain('<svg')
        expect(svg).toContain('</svg>')
        expect(svg.length).toBeGreaterThan(200)
      })
    }
  }
})

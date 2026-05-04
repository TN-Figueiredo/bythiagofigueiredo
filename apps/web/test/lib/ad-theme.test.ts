import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const CSS_PATH = path.resolve(
  __dirname,
  '../../src/app/(public)/ad-theme.css',
)

describe('ad-theme.css', () => {
  let css: string

  it('file exists and is non-empty', () => {
    css = readFileSync(CSS_PATH, 'utf-8')
    expect(css.length).toBeGreaterThan(0)
  })

  it('maps --ad-bg to --pb-paper2', () => {
    css = readFileSync(CSS_PATH, 'utf-8')
    expect(css).toContain('--ad-bg: var(--pb-paper2)')
  })

  it('maps --ad-accent to --pb-accent', () => {
    css = readFileSync(CSS_PATH, 'utf-8')
    expect(css).toContain('--ad-accent: var(--pb-accent)')
  })

  it('maps --ad-font-body to --font-source-serif', () => {
    css = readFileSync(CSS_PATH, 'utf-8')
    expect(css).toContain('--ad-font-body: var(--font-source-serif)')
  })

  it('has all 8 required custom properties', () => {
    css = readFileSync(CSS_PATH, 'utf-8')
    const props = [
      '--ad-bg',
      '--ad-bg-alt',
      '--ad-text',
      '--ad-text-muted',
      '--ad-accent',
      '--ad-border',
      '--ad-font-body',
      '--ad-font-heading',
    ]
    for (const p of props) {
      expect(css, `missing ${p}`).toContain(p)
    }
  })
})

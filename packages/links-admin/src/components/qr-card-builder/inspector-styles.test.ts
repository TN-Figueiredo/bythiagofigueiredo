import { describe, it, expect } from 'vitest'
import {
  labelStyle,
  actionBtnStyle,
  pillBar,
  pillBtn,
  inputBoxStyle,
  hintStyle,
  sectionDivider,
  sectionLabel,
} from './inspector-styles'

/* ──────────────────────────────────────────────
 * Static style exports
 * Verifies the module exports all styles consumed
 * by stamp-inspector, button-inspector, shape-inspector
 * ────────────────────────────────────────────── */

describe('inspector-styles — static exports', () => {
  it('exports labelStyle as CSSProperties object', () => {
    expect(labelStyle).toBeDefined()
    expect(typeof labelStyle).toBe('object')
    expect(labelStyle.fontSize).toBeDefined()
  })

  it('exports actionBtnStyle with layout properties', () => {
    expect(actionBtnStyle).toBeDefined()
    expect(actionBtnStyle.display).toBe('flex')
    expect(actionBtnStyle.cursor).toBe('pointer')
  })

  it('exports pillBar with inline-flex display', () => {
    expect(pillBar).toBeDefined()
    expect(pillBar.display).toBe('inline-flex')
  })

  it('exports inputBoxStyle with border and background', () => {
    expect(inputBoxStyle).toBeDefined()
    expect(inputBoxStyle.borderRadius).toBeDefined()
  })

  it('exports hintStyle with flex layout', () => {
    expect(hintStyle).toBeDefined()
    expect(hintStyle.display).toBe('flex')
  })

  it('exports sectionDivider with border', () => {
    expect(sectionDivider).toBeDefined()
    expect(sectionDivider.borderTop).toBeDefined()
  })

  it('exports sectionLabel with uppercase', () => {
    expect(sectionLabel).toBeDefined()
    expect(sectionLabel.textTransform).toBe('uppercase')
    expect(sectionLabel.fontWeight).toBe(600)
  })
})

/* ──────────────────────────────────────────────
 * pillBtn — dynamic style function
 * Used in shape-inspector for type toggle pills
 * ────────────────────────────────────────────── */

describe('inspector-styles — pillBtn', () => {
  it('is a function', () => {
    expect(typeof pillBtn).toBe('function')
  })

  it('returns accent background when active', () => {
    const style = pillBtn(true)
    expect(style.background).toBe('var(--accent)')
  })

  it('returns transparent background when inactive', () => {
    const style = pillBtn(false)
    expect(style.background).toBe('transparent')
  })

  it('returns different colors for active vs inactive', () => {
    const active = pillBtn(true)
    const inactive = pillBtn(false)
    expect(active.color).not.toBe(inactive.color)
  })

  it('always includes cursor pointer', () => {
    expect(pillBtn(true).cursor).toBe('pointer')
    expect(pillBtn(false).cursor).toBe('pointer')
  })

  it('always includes border none', () => {
    expect(pillBtn(true).border).toBe('none')
    expect(pillBtn(false).border).toBe('none')
  })
})

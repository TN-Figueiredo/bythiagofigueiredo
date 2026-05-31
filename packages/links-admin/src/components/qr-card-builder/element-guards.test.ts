import { describe, it, expect } from 'vitest'
import { isStampElement } from './stamp-inspector'
import { isButtonElement } from './button-inspector'
import { isShapeElement, getShapeType } from './shape-inspector'

/* ──────────────────────────────────────────────
 * isStampElement
 * Guards right-panel routing: image + __stamp: prefix
 * ────────────────────────────────────────────── */

describe('isStampElement', () => {
  it('returns true for image element with __stamp: name', () => {
    expect(isStampElement({ type: 'image', name: '__stamp:tf-logo' })).toBe(true)
  })

  it('returns true for __stamp: with any suffix', () => {
    expect(isStampElement({ type: 'image', name: '__stamp:' })).toBe(true)
    expect(isStampElement({ type: 'image', name: '__stamp:watermark' })).toBe(true)
    expect(isStampElement({ type: 'image', name: '__stamp:seal-2024' })).toBe(true)
  })

  it('returns false for image element without stamp prefix', () => {
    expect(isStampElement({ type: 'image', name: 'Hero Image' })).toBe(false)
    expect(isStampElement({ type: 'image', name: 'stamp-logo' })).toBe(false)
    expect(isStampElement({ type: 'image', name: 'Stamp' })).toBe(false)
  })

  it('returns false for non-image element even with stamp name', () => {
    expect(isStampElement({ type: 'text', name: '__stamp:tf-logo' })).toBe(false)
    expect(isStampElement({ type: 'qr', name: '__stamp:tf-logo' })).toBe(false)
    expect(isStampElement({ type: 'video', name: '__stamp:tf-logo' })).toBe(false)
  })

  it('returns false when name is undefined', () => {
    expect(isStampElement({ type: 'image' })).toBe(false)
  })

  it('returns false when name is empty string', () => {
    expect(isStampElement({ type: 'image', name: '' })).toBe(false)
  })
})

/* ──────────────────────────────────────────────
 * isButtonElement
 * Guards right-panel routing: text + __button: prefix
 * ────────────────────────────────────────────── */

describe('isButtonElement', () => {
  it('returns true for text element with __button: name', () => {
    expect(isButtonElement({ type: 'text', name: '__button:cta-1' })).toBe(true)
  })

  it('returns true for __button: with any suffix', () => {
    expect(isButtonElement({ type: 'text', name: '__button:' })).toBe(true)
    expect(isButtonElement({ type: 'text', name: '__button:link-bio' })).toBe(true)
    expect(isButtonElement({ type: 'text', name: '__button:buy-now' })).toBe(true)
  })

  it('returns false for text element without button prefix', () => {
    expect(isButtonElement({ type: 'text', name: 'Texto' })).toBe(false)
    expect(isButtonElement({ type: 'text', name: 'button-cta' })).toBe(false)
    expect(isButtonElement({ type: 'text', name: 'Button' })).toBe(false)
  })

  it('returns false for non-text element even with button name', () => {
    expect(isButtonElement({ type: 'image', name: '__button:cta' })).toBe(false)
    expect(isButtonElement({ type: 'qr', name: '__button:cta' })).toBe(false)
  })

  it('returns false when name is undefined', () => {
    expect(isButtonElement({ type: 'text' })).toBe(false)
  })

  it('returns false when name is empty string', () => {
    expect(isButtonElement({ type: 'text', name: '' })).toBe(false)
  })
})

/* ──────────────────────────────────────────────
 * isShapeElement
 * Guards right-panel routing: text + __shape: content OR name includes "Forma"
 * ────────────────────────────────────────────── */

describe('isShapeElement', () => {
  // Primary: content marker
  it('returns true for text element with __shape: content prefix', () => {
    expect(isShapeElement({ type: 'text', content: '__shape:line' })).toBe(true)
    expect(isShapeElement({ type: 'text', content: '__shape:block' })).toBe(true)
    expect(isShapeElement({ type: 'text', content: '__shape:outline' })).toBe(true)
  })

  it('returns true for __shape: content even with different name', () => {
    expect(isShapeElement({ type: 'text', name: 'Separator', content: '__shape:line' })).toBe(true)
  })

  // Fallback: name convention
  it('returns true for text with name containing "Forma" (legacy fallback)', () => {
    expect(isShapeElement({ type: 'text', name: 'Forma' })).toBe(true)
    expect(isShapeElement({ type: 'text', name: 'Forma 2' })).toBe(true)
    expect(isShapeElement({ type: 'text', name: 'Minha Forma custom' })).toBe(true)
  })

  // Rejections
  it('returns false for non-text element', () => {
    expect(isShapeElement({ type: 'image', content: '__shape:line' })).toBe(false)
    expect(isShapeElement({ type: 'qr', content: '__shape:block' })).toBe(false)
  })

  it('returns false for text element without shape markers', () => {
    expect(isShapeElement({ type: 'text', name: 'Texto', content: 'Hello' })).toBe(false)
    expect(isShapeElement({ type: 'text', content: 'Regular text' })).toBe(false)
  })

  it('returns false when both name and content are undefined', () => {
    expect(isShapeElement({ type: 'text' })).toBe(false)
  })

  it('returns false when name is empty and content is empty', () => {
    expect(isShapeElement({ type: 'text', name: '', content: '' })).toBe(false)
  })

  it('does not treat "__shape" without colon as shape content', () => {
    expect(isShapeElement({ type: 'text', content: '__shape' })).toBe(false)
  })
})

/* ──────────────────────────────────────────────
 * getShapeType
 * Maps content string to ShapeType: line | block | outline
 * ────────────────────────────────────────────── */

describe('getShapeType', () => {
  it('returns "line" for __shape:line', () => {
    expect(getShapeType('__shape:line')).toBe('line')
  })

  it('returns "block" for __shape:block', () => {
    expect(getShapeType('__shape:block')).toBe('block')
  })

  it('returns "outline" for __shape:outline', () => {
    expect(getShapeType('__shape:outline')).toBe('outline')
  })

  it('defaults to "line" for unknown __shape: suffix', () => {
    expect(getShapeType('__shape:circle')).toBe('line')
    expect(getShapeType('__shape:unknown')).toBe('line')
    expect(getShapeType('__shape:')).toBe('line')
  })

  it('defaults to "line" for content without __shape: prefix', () => {
    expect(getShapeType('Hello World')).toBe('line')
    expect(getShapeType('')).toBe('line')
    expect(getShapeType('block')).toBe('line')
    expect(getShapeType('outline')).toBe('line')
  })

  it('is case-sensitive for prefix', () => {
    expect(getShapeType('__SHAPE:block')).toBe('line')
    expect(getShapeType('__Shape:outline')).toBe('line')
  })
})

/* ──────────────────────────────────────────────
 * Mutual exclusivity in right-panel routing
 * A text element should only match ONE guard, never two
 * ────────────────────────────────────────────── */

describe('guard mutual exclusivity', () => {
  it('a shape element is not a button element', () => {
    const el = { type: 'text', name: 'Forma', content: '__shape:block' }
    expect(isShapeElement(el)).toBe(true)
    expect(isButtonElement(el)).toBe(false)
  })

  it('a button element is not a shape element', () => {
    const el = { type: 'text', name: '__button:cta', content: 'Link na bio' }
    expect(isButtonElement(el)).toBe(true)
    expect(isShapeElement(el)).toBe(false)
  })

  it('a stamp element is not a button or shape element', () => {
    const el = { type: 'image', name: '__stamp:tf-logo' }
    expect(isStampElement(el)).toBe(true)
    expect(isButtonElement(el)).toBe(false)
    expect(isShapeElement(el)).toBe(false)
  })

  it('a regular text element matches none of the special guards', () => {
    const el = { type: 'text', name: 'Texto', content: 'Hello World' }
    expect(isShapeElement(el)).toBe(false)
    expect(isButtonElement(el)).toBe(false)
    expect(isStampElement(el)).toBe(false)
  })

  it('a regular image element is not a stamp', () => {
    const el = { type: 'image', name: 'Hero Image' }
    expect(isStampElement(el)).toBe(false)
  })
})

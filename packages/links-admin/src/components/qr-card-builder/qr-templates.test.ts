import { describe, it, expect } from 'vitest'
import { QR_TEMPLATES, QR_CARD_DESIGN } from './qr-templates'

describe('QR_TEMPLATES', () => {
  it('has exactly 6 templates', () => {
    expect(QR_TEMPLATES).toHaveLength(6)
  })

  it('each template has required fields', () => {
    for (const t of QR_TEMPLATES) {
      expect(t).toHaveProperty('id')
      expect(t).toHaveProperty('name')
      expect(t).toHaveProperty('preview')
      expect(t).toHaveProperty('config')
      expect(typeof t.id).toBe('string')
      expect(typeof t.name).toBe('string')
    }
  })

  it('templates have unique ids', () => {
    const ids = QR_TEMPLATES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('template configs have valid hex colors', () => {
    const hexRe = /^#[0-9A-Fa-f]{6}$/
    for (const t of QR_TEMPLATES) {
      expect(t.config.foregroundColor).toMatch(hexRe)
      expect(t.config.backgroundColor).toMatch(hexRe)
    }
  })

  it('template configs have valid error correction levels', () => {
    const valid = ['L', 'M', 'Q', 'H']
    for (const t of QR_TEMPLATES) {
      expect(valid).toContain(t.config.errorCorrectionLevel)
    }
  })

  it('includes standard, inverted, and branded templates', () => {
    const names = QR_TEMPLATES.map(t => t.id)
    expect(names).toContain('standard')
    expect(names).toContain('inverted')
    expect(names).toContain('branded')
  })
})

describe('QR_CARD_DESIGN', () => {
  it('has card dimensions', () => {
    expect(QR_CARD_DESIGN.width).toBeGreaterThan(0)
    expect(QR_CARD_DESIGN.height).toBeGreaterThan(0)
  })

  it('has background and foreground colors', () => {
    expect(QR_CARD_DESIGN.bgColor).toBeDefined()
    expect(QR_CARD_DESIGN.fgColor).toBeDefined()
  })

  it('has QR size and position', () => {
    expect(QR_CARD_DESIGN.qrSize).toBeGreaterThan(0)
    expect(QR_CARD_DESIGN.qrX).toBeGreaterThanOrEqual(0)
    expect(QR_CARD_DESIGN.qrY).toBeGreaterThanOrEqual(0)
  })

  it('has font configuration', () => {
    expect(QR_CARD_DESIGN.titleFont).toBeDefined()
    expect(QR_CARD_DESIGN.subtitleFont).toBeDefined()
  })
})

import { describe, it, expect } from 'vitest'
import {
  createMinimalJpeg,
  createMinimalPng,
  createOversizedBuffer,
  XSS_SVG,
  CLEAN_SVG,
  TINY_GIF_5x5,
} from './create-fixtures'

describe('test fixtures', () => {
  it('createMinimalJpeg returns a buffer starting with JPEG magic bytes', () => {
    const buf = createMinimalJpeg()
    expect(buf[0]).toBe(0xff)
    expect(buf[1]).toBe(0xd8)
  })

  it('createMinimalPng returns a buffer starting with PNG magic bytes', () => {
    const buf = createMinimalPng()
    expect(buf[0]).toBe(0x89)
    expect(buf[1]).toBe(0x50)
  })

  it('createOversizedBuffer creates buffer of exact size', () => {
    const buf = createOversizedBuffer(6 * 1024 * 1024)
    expect(buf.length).toBe(6 * 1024 * 1024)
  })

  it('XSS_SVG contains script tags', () => {
    expect(XSS_SVG).toContain('<script>')
    expect(XSS_SVG).toContain('onload=')
    expect(XSS_SVG).toContain('javascript:')
    expect(XSS_SVG).toContain('<foreignObject')
  })

  it('CLEAN_SVG has no XSS vectors', () => {
    expect(CLEAN_SVG).not.toContain('<script>')
    expect(CLEAN_SVG).not.toContain('onload')
    expect(CLEAN_SVG).not.toContain('javascript:')
  })

  it('TINY_GIF_5x5 is a valid GIF header', () => {
    expect(TINY_GIF_5x5[0]).toBe(0x47) // G
    expect(TINY_GIF_5x5[1]).toBe(0x49) // I
    expect(TINY_GIF_5x5[2]).toBe(0x46) // F
  })
})

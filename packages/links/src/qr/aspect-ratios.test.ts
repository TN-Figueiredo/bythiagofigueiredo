import { describe, it, expect } from 'vitest'
import { ASPECT_RATIOS, computeQrSize } from './aspect-ratios.js'

describe('ASPECT_RATIOS', () => {
  it('has 5 presets', () => {
    expect(Object.keys(ASPECT_RATIOS)).toHaveLength(5)
  })

  it('square is 512x512', () => {
    expect(ASPECT_RATIOS.square).toEqual({ name: 'square', width: 512, height: 512 })
  })

  it('landscape is 640x480', () => {
    expect(ASPECT_RATIOS.landscape).toEqual({ name: 'landscape', width: 640, height: 480 })
  })

  it('portrait is 480x640', () => {
    expect(ASPECT_RATIOS.portrait).toEqual({ name: 'portrait', width: 480, height: 640 })
  })

  it('wide is 800x450', () => {
    expect(ASPECT_RATIOS.wide).toEqual({ name: 'wide', width: 800, height: 450 })
  })

  it('story is 450x800', () => {
    expect(ASPECT_RATIOS.story).toEqual({ name: 'story', width: 450, height: 800 })
  })
})

describe('computeQrSize', () => {
  it('computes minimum of available width and height', () => {
    expect(computeQrSize(640, 480, 32)).toBe(416) // min(640-64, 480-64) = 416
    expect(computeQrSize(480, 640, 32)).toBe(416)
  })

  it('computes square canvas correctly', () => {
    expect(computeQrSize(512, 512, 32)).toBe(448) // 512 - 64
  })

  it('handles zero padding', () => {
    expect(computeQrSize(512, 512, 0)).toBe(512)
  })
})

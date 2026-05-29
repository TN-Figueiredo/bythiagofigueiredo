import { describe, it, expect } from 'vitest'
import {
  toDisplayLabel, variantColor, VARIANT_COLORS, TYPE_META,
  formatNumber, formatPercent, formatDate, formatCompact,
} from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-constants'

describe('toDisplayLabel', () => {
  it('maps "original" to A', () => { expect(toDisplayLabel('original')).toBe('A') })
  it('maps any label with isOriginal=true to A', () => { expect(toDisplayLabel('B', true)).toBe('A') })
  it('passes through B', () => { expect(toDisplayLabel('B')).toBe('B') })
  it('passes through C', () => { expect(toDisplayLabel('C')).toBe('C') })
  it('passes through D', () => { expect(toDisplayLabel('D')).toBe('D') })
  it('falls back to B for unknown', () => { expect(toDisplayLabel('X')).toBe('B') })
  it('falls back to B for empty string', () => { expect(toDisplayLabel('')).toBe('B') })
})

describe('variantColor', () => {
  it('returns slate for original', () => { expect(variantColor('original')).toBe('#8A8F98') })
  it('returns orange for B', () => { expect(variantColor('B')).toBe('#E8823C') })
  it('returns cyan for C', () => { expect(variantColor('C')).toBe('#3FA9C0') })
  it('returns violet for D', () => { expect(variantColor('D')).toBe('#A77CE8') })
})

describe('TYPE_META', () => {
  it('covers all 4 test types', () => {
    expect(Object.keys(TYPE_META)).toEqual(['thumbnail', 'title', 'description', 'combo'])
  })
  it('each entry has icon, label, hint', () => {
    for (const v of Object.values(TYPE_META)) {
      expect(v).toHaveProperty('icon')
      expect(v).toHaveProperty('label')
      expect(v).toHaveProperty('hint')
    }
  })
})

describe('formatNumber', () => {
  it('formats with en locale', () => { expect(formatNumber(1234)).toBe('1,234') })
  it('returns dash for null', () => { expect(formatNumber(null)).toBe('—') })
  it('returns dash for undefined', () => { expect(formatNumber(undefined)).toBe('—') })
  it('returns dash for NaN', () => { expect(formatNumber(NaN)).toBe('—') })
})

describe('formatPercent', () => {
  it('formats with 1 decimal by default', () => { expect(formatPercent(12.34)).toBe('12.3%') })
  it('accepts custom decimals', () => { expect(formatPercent(12.345, 2)).toBe('12.35%') })
  it('returns dash for null', () => { expect(formatPercent(null)).toBe('—') })
  it('returns dash for NaN', () => { expect(formatPercent(NaN)).toBe('—') })
})

describe('formatDate', () => {
  it('formats ISO string', () => { expect(formatDate('2026-01-15')).toMatch(/Jan/) })
  it('formats Date object', () => { expect(formatDate(new Date('2026-06-15T12:00:00'))).toMatch(/Jun/) })
  it('returns dash for null', () => { expect(formatDate(null)).toBe('—') })
  it('returns dash for invalid date', () => { expect(formatDate('not-a-date')).toBe('—') })
})

describe('formatPercent extras', () => {
  it('formats zero', () => { expect(formatPercent(0)).toBe('0.0%') })
  it('formats 100', () => { expect(formatPercent(100)).toBe('100.0%') })
})

describe('formatDate extras', () => {
  it('returns dash for undefined', () => { expect(formatDate(undefined)).toBe('—') })
  it('handles UTC midnight correctly', () => { expect(formatDate('2026-05-01')).toMatch(/May/) })
})

describe('formatCompact', () => {
  it('shows raw number under 1k', () => { expect(formatCompact(999)).toBe('999') })
  it('formats zero', () => { expect(formatCompact(0)).toBe('0') })
  it('formats exact boundary 1000', () => { expect(formatCompact(1000)).toBe('1.0k') })
  it('formats thousands', () => { expect(formatCompact(1500)).toBe('1.5k') })
  it('formats millions', () => { expect(formatCompact(1_200_000)).toBe('1.2M') })
  it('formats billions', () => { expect(formatCompact(1_500_000_000)).toBe('1.5B') })
  it('returns dash for null', () => { expect(formatCompact(null)).toBe('—') })
  it('returns dash for NaN', () => { expect(formatCompact(NaN)).toBe('—') })
  it('returns dash for Infinity', () => { expect(formatCompact(Infinity)).toBe('—') })
  it('handles negative millions', () => { expect(formatCompact(-1_500_000)).toBe('-1.5M') })
})

describe('VARIANT_COLORS completeness', () => {
  it('has exactly 4 keys', () => { expect(Object.keys(VARIANT_COLORS)).toEqual(['A', 'B', 'C', 'D']) })
})

describe('variantColor extras', () => {
  it('returns A color for isOriginal override', () => { expect(variantColor('C', true)).toBe('#8A8F98') })
  it('returns B color for unknown label', () => { expect(variantColor('X')).toBe('#E8823C') })
})

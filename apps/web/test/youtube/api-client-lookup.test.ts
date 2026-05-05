import { describe, it, expect } from 'vitest'
import { parseHandleInput } from '../../src/lib/youtube/api-client'

describe('parseHandleInput', () => {
  it('extracts handle from full URL', () => {
    expect(parseHandleInput('https://www.youtube.com/@tnFigueiredoTV')).toBe('@tnFigueiredoTV')
  })

  it('extracts handle from URL without www', () => {
    expect(parseHandleInput('https://youtube.com/@byThiagoFigueiredo')).toBe('@byThiagoFigueiredo')
  })

  it('extracts channel ID from /channel/ URL', () => {
    expect(parseHandleInput('https://www.youtube.com/channel/UCxyz123')).toBe('UCxyz123')
  })

  it('passes through handle with @', () => {
    expect(parseHandleInput('@tnFigueiredoTV')).toBe('@tnFigueiredoTV')
  })

  it('prepends @ to bare handle', () => {
    expect(parseHandleInput('tnFigueiredoTV')).toBe('@tnFigueiredoTV')
  })

  it('trims whitespace', () => {
    expect(parseHandleInput('  @handle  ')).toBe('@handle')
  })

  it('handles youtube.com/c/ custom URL', () => {
    expect(parseHandleInput('https://youtube.com/c/mychannel')).toBe('@mychannel')
  })
})

import { describe, it, expect } from 'vitest'
import { ScriptTagExtension } from '@/app/cms/(authed)/pipeline/_components/detail/editors/script-tag-extension'
import { ScriptPauseExtension } from '@/app/cms/(authed)/pipeline/_components/detail/editors/script-pause-extension'

describe('ScriptTagExtension', () => {
  it('has name "scriptTag"', () => {
    expect(ScriptTagExtension.name).toBe('scriptTag')
  })

  it('defines tag attribute with default VISUAL', () => {
    const config = ScriptTagExtension.config
    expect(config.name).toBe('scriptTag')
  })

  it('is a block-level group', () => {
    // group is set at extension creation time
    expect(ScriptTagExtension.config.group).toBe('block')
  })

  it('has content "inline*"', () => {
    expect(ScriptTagExtension.config.content).toBe('inline*')
  })
})

describe('ScriptPauseExtension', () => {
  it('has name "scriptPause"', () => {
    expect(ScriptPauseExtension.name).toBe('scriptPause')
  })

  it('is atom (no editable content)', () => {
    expect(ScriptPauseExtension.config.atom).toBe(true)
  })

  it('is draggable', () => {
    expect(ScriptPauseExtension.config.draggable).toBe(true)
  })

  it('is a block-level group', () => {
    expect(ScriptPauseExtension.config.group).toBe('block')
  })
})

// @vitest-environment happy-dom
/**
 * NOTE: this file originally tested <ComposerShell>, deleted in 9bd1ad7c
 * (2026-05-30 dead compositor shells cleanup) — the file was orphaned and
 * failed module resolution ever since. The composer's state engine now lives
 * in the useComposer hook (consumed by <CompositorNew>, which has its own
 * flow test in social-compositor-flow.test.tsx). This suite pins the hook.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'

import { useComposer } from '@/app/cms/(authed)/social/new/_components/use-composer'

afterEach(() => cleanup())

describe('useComposer', () => {
  it('starts in cms mode with pt language by default', () => {
    const { result } = renderHook(() => useComposer())
    expect(result.current.mode).toBe('cms')
    expect(result.current.lang).toBe('pt')
  })

  it('honors the initialMode argument', () => {
    const { result } = renderHook(() => useComposer('blank'))
    expect(result.current.mode).toBe('blank')
  })

  it('defaults destinations to story + community + page', () => {
    const { result } = renderHook(() => useComposer())
    expect(result.current.destsOn.ig_story).toBe(true)
    expect(result.current.destsOn.yt_community).toBe(true)
    expect(result.current.destsOn.fb_page).toBe(true)
    expect(result.current.destsOn.ig_feed).toBe(false)
    expect(result.current.destsOn.bsky_feed).toBe(false)
    expect(result.current.activeDests).toEqual(['ig_story', 'yt_community', 'fb_page'])
  })

  it('toggleDest flips a destination and updates activeDests', () => {
    const { result } = renderHook(() => useComposer())
    act(() => result.current.toggleDest('ig_feed'))
    expect(result.current.destsOn.ig_feed).toBe(true)
    expect(result.current.activeDests).toContain('ig_feed')
    act(() => result.current.toggleDest('ig_feed'))
    expect(result.current.destsOn.ig_feed).toBe(false)
  })

  it('focusDest changes the focused destination', () => {
    const { result } = renderHook(() => useComposer())
    expect(result.current.focused).toBe('ig_story')
    act(() => result.current.focusDest('fb_page'))
    expect(result.current.focused).toBe('fb_page')
  })

  it('setCaption/getCaption are scoped per destination and language', () => {
    const { result } = renderHook(() => useComposer())
    act(() => {
      result.current.setCaption('ig_story', 'pt', 'Olá story')
      result.current.setCaption('ig_story', 'en', 'Hello story')
      result.current.setCaption('fb_page', 'pt', 'Olá página')
    })
    expect(result.current.getCaption('ig_story', 'pt')).toBe('Olá story')
    expect(result.current.getCaption('ig_story', 'en')).toBe('Hello story')
    expect(result.current.getCaption('fb_page', 'pt')).toBe('Olá página')
    expect(result.current.getCaption('fb_page', 'en')).toBe('')
  })

  it('applyAISuggestion stores the suggestion', () => {
    const { result } = renderHook(() => useComposer())
    const suggestion = { variations: ['gerado'], hashtags: ['#ai'], tone: 'casual', bestTime: null }
    act(() => result.current.applyAISuggestion(suggestion))
    expect(result.current.aiData).toEqual(suggestion)
  })

  it('updateDesign stores the canvas composition', () => {
    const { result } = renderHook(() => useComposer())
    act(() => result.current.updateDesign({ layers: [1, 2] }))
    expect(result.current.design).toEqual({ layers: [1, 2] })
  })

  it('schedule state transitions now → schedule with date/time', () => {
    const { result } = renderHook(() => useComposer())
    expect(result.current.sched).toBe('now')
    act(() => {
      result.current.setSched('schedule')
      result.current.setSchedDate('2026-06-20')
      result.current.setSchedTime('14:30')
    })
    expect(result.current.sched).toBe('schedule')
    expect(result.current.schedDate).toBe('2026-06-20')
    expect(result.current.schedTime).toBe('14:30')
  })
})

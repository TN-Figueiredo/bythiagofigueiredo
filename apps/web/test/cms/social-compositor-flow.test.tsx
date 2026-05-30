import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useComposer } from '@/app/cms/(authed)/social/new/_components/use-composer'

describe('Compositor flow', () => {
  it('toggles destinations on/off', () => {
    const { result } = renderHook(() => useComposer('cms'))
    expect(result.current.destsOn.ig_story).toBe(true)
    expect(result.current.destsOn.ig_feed).toBe(false)

    act(() => result.current.toggleDest('ig_feed'))
    expect(result.current.destsOn.ig_feed).toBe(true)

    act(() => result.current.toggleDest('ig_story'))
    expect(result.current.destsOn.ig_story).toBe(false)
  })

  it('focuses destination updates focused state', () => {
    const { result } = renderHook(() => useComposer('cms'))
    expect(result.current.focused).toBe('ig_story')

    act(() => result.current.focusDest('yt_community'))
    expect(result.current.focused).toBe('yt_community')
  })

  it('captions are per-dest per-lang', () => {
    const { result } = renderHook(() => useComposer('cms'))

    act(() => result.current.setCaption('ig_story', 'pt', 'Ola'))
    act(() => result.current.setCaption('ig_story', 'en', 'Hello'))
    act(() => result.current.setCaption('fb_page', 'pt', 'Post FB'))

    expect(result.current.getCaption('ig_story', 'pt')).toBe('Ola')
    expect(result.current.getCaption('ig_story', 'en')).toBe('Hello')
    expect(result.current.getCaption('fb_page', 'pt')).toBe('Post FB')
    expect(result.current.getCaption('yt_community', 'pt')).toBe('')
  })

  it('activeDests reflects destsOn state', () => {
    const { result } = renderHook(() => useComposer('cms'))
    expect(result.current.activeDests).toContain('ig_story')
    expect(result.current.activeDests).not.toContain('ig_feed')

    act(() => result.current.toggleDest('ig_feed'))
    expect(result.current.activeDests).toContain('ig_feed')
  })

  it('initializes with correct defaults', () => {
    const { result } = renderHook(() => useComposer('blank'))
    expect(result.current.mode).toBe('blank')
    expect(result.current.lang).toBe('pt')
    expect(result.current.sched).toBe('now')
    expect(result.current.publishing).toBe(false)
    expect(result.current.cmsPicked).toBeNull()
    expect(result.current.aiData).toBeNull()
  })

  it('applies AI suggestion', () => {
    const { result } = renderHook(() => useComposer('cms'))
    const suggestion = { variations: ['v1', 'v2'], hashtags: ['tag1'], tone: 'casual', bestTime: '14:00' }

    act(() => result.current.applyAISuggestion(suggestion))
    expect(result.current.aiData).toEqual(suggestion)
  })

  it('sets schedule mode and date/time', () => {
    const { result } = renderHook(() => useComposer('cms'))

    act(() => {
      result.current.setSched('schedule')
      result.current.setSchedDate('2026-06-01')
      result.current.setSchedTime('14:00')
    })

    expect(result.current.sched).toBe('schedule')
    expect(result.current.schedDate).toBe('2026-06-01')
    expect(result.current.schedTime).toBe('14:00')
  })
})

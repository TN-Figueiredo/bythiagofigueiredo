// @vitest-environment happy-dom
/**
 * NOTE: this file originally tested <ComposerShell> (the redesigned shell),
 * deleted in 9bd1ad7c (2026-05-30 dead compositor shells cleanup) — the file
 * was orphaned and failed module resolution ever since. The redesign's
 * session-restore behavior now lives in useComposerPersistence, pinned here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'

import { useComposerPersistence } from '@/app/cms/(authed)/social/new/_components/use-composer-persistence'
import type { ComposerState } from '@/app/cms/(authed)/social/new/_components/use-composer'

afterEach(() => cleanup())

function makeState(overrides?: Partial<ComposerState>): ComposerState {
  return {
    mode: 'cms', lang: 'pt',
    destsOn: { ig_story: true, yt_community: true, fb_page: true, ig_feed: false, bsky_feed: false },
    focused: 'ig_story', captions: {}, poll: null,
    sched: 'now', schedDate: '', schedTime: '',
    publishing: false, cmsPicked: null, aiData: null, aiLoading: false, design: null,
    ...overrides,
  }
}

describe('useComposerPersistence', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('does not restore when nothing is saved', () => {
    const onRestore = vi.fn()
    renderHook(() => useComposerPersistence({ state: makeState(), onRestore }))
    expect(onRestore).not.toHaveBeenCalled()
  })

  it('restores a saved draft state on mount', () => {
    sessionStorage.setItem('social-composer-new', JSON.stringify({ lang: 'en', sched: 'queue' }))
    const onRestore = vi.fn()
    renderHook(() => useComposerPersistence({ state: makeState(), onRestore }))
    expect(onRestore).toHaveBeenCalledWith({ lang: 'en', sched: 'queue' })
  })

  it('scopes the storage key per draftId', () => {
    sessionStorage.setItem('social-composer-draft-42', JSON.stringify({ lang: 'en' }))
    const onRestore = vi.fn()
    renderHook(() => useComposerPersistence({ state: makeState(), draftId: 'draft-42', onRestore }))
    expect(onRestore).toHaveBeenCalledWith({ lang: 'en' })
  })

  it('does not restore another draft\'s state', () => {
    sessionStorage.setItem('social-composer-other', JSON.stringify({ lang: 'en' }))
    const onRestore = vi.fn()
    renderHook(() => useComposerPersistence({ state: makeState(), draftId: 'draft-42', onRestore }))
    expect(onRestore).not.toHaveBeenCalled()
  })

  it('survives corrupted saved state without calling onRestore with garbage', () => {
    sessionStorage.setItem('social-composer-new', '{not json')
    const onRestore = vi.fn()
    expect(() => renderHook(() => useComposerPersistence({ state: makeState(), onRestore }))).not.toThrow()
    expect(onRestore).not.toHaveBeenCalled()
  })

  it('clearPersistence removes the saved state', () => {
    sessionStorage.setItem('social-composer-new', JSON.stringify({ lang: 'en' }))
    const onRestore = vi.fn()
    const { result } = renderHook(() => useComposerPersistence({ state: makeState(), onRestore }))
    result.current.clearPersistence()
    expect(sessionStorage.getItem('social-composer-new')).toBeNull()
  })
})

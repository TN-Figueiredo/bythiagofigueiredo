import { describe, it, expect } from 'vitest'
import { postEditorReducer, initialState, type PostEditorState } from '@/app/cms/(authed)/posts/_components/post-editor-context'

describe('postEditorReducer', () => {
  it('initializes with all tabs clean', () => {
    const state = initialState({} as PostEditorState['post'])
    expect(state.dirty.content).toBe(false)
    expect(state.dirty.images).toBe(false)
    expect(state.dirty.seo).toBe(false)
    expect(state.dirty.social).toBe(false)
    expect(state.dirty.publish).toBe(false)
  })

  it('SET_DIRTY marks a specific tab dirty', () => {
    const state = initialState({} as PostEditorState['post'])
    const next = postEditorReducer(state, { type: 'SET_DIRTY', tab: 'content', dirty: true })
    expect(next.dirty.content).toBe(true)
    expect(next.dirty.images).toBe(false)
  })

  it('SAVE_TAB clears dirty flag for that tab', () => {
    const state = initialState({} as PostEditorState['post'])
    const dirty = postEditorReducer(state, { type: 'SET_DIRTY', tab: 'seo', dirty: true })
    const saved = postEditorReducer(dirty, { type: 'SAVE_TAB', tab: 'seo' })
    expect(saved.dirty.seo).toBe(false)
  })

  it('SET_ACTIVE_TAB changes active tab', () => {
    const state = initialState({} as PostEditorState['post'])
    const next = postEditorReducer(state, { type: 'SET_ACTIVE_TAB', tab: 'social' })
    expect(next.activeTab).toBe('social')
  })

  it('SET_LOCALE changes active locale', () => {
    const state = initialState({} as PostEditorState['post'])
    const next = postEditorReducer(state, { type: 'SET_LOCALE', locale: 'en' })
    expect(next.activeLocale).toBe('en')
  })

  it('UPDATE_SECTION merges section data', () => {
    const state = initialState({} as PostEditorState['post'])
    const next = postEditorReducer(state, {
      type: 'UPDATE_SECTION',
      tab: 'content',
      data: { title: 'Hello' },
    })
    expect(next.sections.content.title).toBe('Hello')
    expect(next.dirty.content).toBe(true)
  })

  it('hasDirtyTabs returns true when any tab is dirty', () => {
    const state = initialState({} as PostEditorState['post'])
    expect(state.hasDirtyTabs).toBe(false)
    const dirty = postEditorReducer(state, { type: 'SET_DIRTY', tab: 'images', dirty: true })
    expect(dirty.hasDirtyTabs).toBe(true)
  })
})

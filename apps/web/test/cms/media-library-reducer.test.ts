import { describe, it, expect } from 'vitest'
import {
  mediaLibraryReducer,
  initialState,
  type MediaLibraryState,
} from '../../src/app/cms/(authed)/media/media-library-reducer'

describe('mediaLibraryReducer', () => {
  const base: MediaLibraryState = initialState()

  describe('SET_FILTER', () => {
    it('sets filter and resets checked', () => {
      const withChecked = { ...base, checked: new Set(['a', 'b']) }
      const next = mediaLibraryReducer(withChecked, { type: 'SET_FILTER', filter: 'avatar' })
      expect(next.filter).toBe('avatar')
      expect(next.checked.size).toBe(0)
    })
  })

  describe('SET_SEARCH', () => {
    it('sets search string', () => {
      const next = mediaLibraryReducer(base, { type: 'SET_SEARCH', search: 'logo' })
      expect(next.search).toBe('logo')
    })
  })

  describe('SET_SORT', () => {
    it('sets sort option', () => {
      const next = mediaLibraryReducer(base, { type: 'SET_SORT', sort: 'largest' })
      expect(next.sort).toBe('largest')
    })
  })

  describe('SET_VIEW', () => {
    it('sets view mode', () => {
      const next = mediaLibraryReducer(base, { type: 'SET_VIEW', view: 'list' })
      expect(next.view).toBe('list')
    })
  })

  describe('SET_COLS', () => {
    it('sets column count', () => {
      const next = mediaLibraryReducer(base, { type: 'SET_COLS', cols: 2 })
      expect(next.cols).toBe(2)
    })
  })

  describe('SELECT_ITEM', () => {
    it('selects an item and opens detail', () => {
      const next = mediaLibraryReducer(base, { type: 'SELECT_ITEM', id: 'abc' })
      expect(next.selectedId).toBe('abc')
    })

    it('deselects when same item selected', () => {
      const selected = { ...base, selectedId: 'abc' }
      const next = mediaLibraryReducer(selected, { type: 'SELECT_ITEM', id: 'abc' })
      expect(next.selectedId).toBeNull()
    })
  })

  describe('TOGGLE_CHECK', () => {
    it('adds item to checked set', () => {
      const next = mediaLibraryReducer(base, { type: 'TOGGLE_CHECK', id: 'a' })
      expect(next.checked.has('a')).toBe(true)
    })

    it('removes item from checked set', () => {
      const withChecked = { ...base, checked: new Set(['a']) }
      const next = mediaLibraryReducer(withChecked, { type: 'TOGGLE_CHECK', id: 'a' })
      expect(next.checked.has('a')).toBe(false)
    })
  })

  describe('CHECK_RANGE', () => {
    it('adds range of IDs to checked set', () => {
      const next = mediaLibraryReducer(base, { type: 'CHECK_RANGE', ids: ['a', 'b', 'c'] })
      expect(next.checked.size).toBe(3)
      expect(next.checked.has('b')).toBe(true)
    })
  })

  describe('CHECK_ALL / UNCHECK_ALL', () => {
    it('checks all provided IDs', () => {
      const next = mediaLibraryReducer(base, { type: 'CHECK_ALL', ids: ['x', 'y'] })
      expect(next.checked.size).toBe(2)
    })

    it('unchecks all', () => {
      const withChecked = { ...base, checked: new Set(['x', 'y']) }
      const next = mediaLibraryReducer(withChecked, { type: 'UNCHECK_ALL' })
      expect(next.checked.size).toBe(0)
    })
  })

  describe('OPEN_LIGHTBOX / CLOSE_LIGHTBOX', () => {
    it('opens lightbox with asset ID', () => {
      const next = mediaLibraryReducer(base, { type: 'OPEN_LIGHTBOX', id: 'img1' })
      expect(next.lightboxId).toBe('img1')
    })

    it('closes lightbox', () => {
      const withLb = { ...base, lightboxId: 'img1' }
      const next = mediaLibraryReducer(withLb, { type: 'CLOSE_LIGHTBOX' })
      expect(next.lightboxId).toBeNull()
    })
  })

  describe('SET_DETAIL_TAB', () => {
    it('sets detail tab', () => {
      const next = mediaLibraryReducer(base, { type: 'SET_DETAIL_TAB', tab: 'usage' })
      expect(next.detailTab).toBe('usage')
    })
  })

  describe('SET_LOADING', () => {
    it('sets loading state', () => {
      const next = mediaLibraryReducer(base, { type: 'SET_LOADING', loading: true })
      expect(next.isLoading).toBe(true)
    })
  })
})

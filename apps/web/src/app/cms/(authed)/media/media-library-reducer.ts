import type { MediaAssetType } from '@/lib/media/types'
import type { MediaSortOption, MediaViewMode, MediaColumnCount } from '../_shared/media/types'

export interface MediaLibraryState {
  filter: 'all' | MediaAssetType
  search: string
  sort: MediaSortOption
  view: MediaViewMode
  cols: MediaColumnCount
  selectedId: string | null
  checked: Set<string>
  lightboxId: string | null
  detailTab: 'details' | 'usage' | 'history'
  isLoading: boolean
}

export type MediaLibraryAction =
  | { type: 'SET_FILTER'; filter: 'all' | MediaAssetType }
  | { type: 'SET_SEARCH'; search: string }
  | { type: 'SET_SORT'; sort: MediaSortOption }
  | { type: 'SET_VIEW'; view: MediaViewMode }
  | { type: 'SET_COLS'; cols: MediaColumnCount }
  | { type: 'SELECT_ITEM'; id: string }
  | { type: 'TOGGLE_CHECK'; id: string }
  | { type: 'CHECK_RANGE'; ids: string[] }
  | { type: 'CHECK_ALL'; ids: string[] }
  | { type: 'UNCHECK_ALL' }
  | { type: 'OPEN_LIGHTBOX'; id: string }
  | { type: 'CLOSE_LIGHTBOX' }
  | { type: 'SET_DETAIL_TAB'; tab: 'details' | 'usage' | 'history' }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'DESELECT' }

export function initialState(): MediaLibraryState {
  return {
    filter: 'all',
    search: '',
    sort: 'newest',
    view: 'grid',
    cols: 3,
    selectedId: null,
    checked: new Set(),
    lightboxId: null,
    detailTab: 'details',
    isLoading: true,
  }
}

export function mediaLibraryReducer(
  state: MediaLibraryState,
  action: MediaLibraryAction,
): MediaLibraryState {
  switch (action.type) {
    case 'SET_FILTER':
      return { ...state, filter: action.filter, checked: new Set() }
    case 'SET_SEARCH':
      return { ...state, search: action.search }
    case 'SET_SORT':
      return { ...state, sort: action.sort }
    case 'SET_VIEW':
      return { ...state, view: action.view }
    case 'SET_COLS':
      return { ...state, cols: action.cols }
    case 'SELECT_ITEM':
      return {
        ...state,
        selectedId: state.selectedId === action.id ? null : action.id,
        detailTab: 'details',
      }
    case 'TOGGLE_CHECK': {
      const next = new Set(state.checked)
      if (next.has(action.id)) next.delete(action.id)
      else next.add(action.id)
      return { ...state, checked: next }
    }
    case 'CHECK_RANGE': {
      const next = new Set(state.checked)
      for (const id of action.ids) next.add(id)
      return { ...state, checked: next }
    }
    case 'CHECK_ALL':
      return { ...state, checked: new Set(action.ids) }
    case 'UNCHECK_ALL':
      return { ...state, checked: new Set() }
    case 'OPEN_LIGHTBOX':
      return { ...state, lightboxId: action.id }
    case 'CLOSE_LIGHTBOX':
      return { ...state, lightboxId: null }
    case 'SET_DETAIL_TAB':
      return { ...state, detailTab: action.tab }
    case 'SET_LOADING':
      return { ...state, isLoading: action.loading }
    case 'DESELECT':
      return { ...state, selectedId: null, detailTab: 'details' }
    default:
      return state
  }
}

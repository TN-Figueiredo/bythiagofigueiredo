'use client'

import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { PostTab } from '@/lib/posts/types'
import type { PostDetailData } from '@/lib/posts/types'

export interface PostEditorState {
  post: PostDetailData
  activeTab: PostTab
  activeLocale: string
  dirty: Record<PostTab, boolean>
  hasDirtyTabs: boolean
  sections: {
    content: Record<string, unknown>
    images: Record<string, unknown>
    seo: Record<string, unknown>
    social: Record<string, unknown>
    publish: Record<string, unknown>
  }
}

export type PostEditorAction =
  | { type: 'SET_ACTIVE_TAB'; tab: PostTab }
  | { type: 'SET_LOCALE'; locale: string }
  | { type: 'SET_DIRTY'; tab: PostTab; dirty: boolean }
  | { type: 'SAVE_TAB'; tab: PostTab }
  | { type: 'UPDATE_SECTION'; tab: PostTab; data: Record<string, unknown> }
  | { type: 'SET_POST'; post: PostDetailData }

const TABS: PostTab[] = ['content', 'images', 'seo', 'social', 'publish']

export function initialState(post: PostDetailData): PostEditorState {
  return {
    post,
    activeTab: 'content',
    activeLocale: post?.locale ?? 'pt-br',
    dirty: { content: false, images: false, seo: false, social: false, publish: false },
    hasDirtyTabs: false,
    sections: {
      content: {},
      images: {},
      seo: {},
      social: {},
      publish: {},
    },
  }
}

export function postEditorReducer(state: PostEditorState, action: PostEditorAction): PostEditorState {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.tab }

    case 'SET_LOCALE':
      return { ...state, activeLocale: action.locale }

    case 'SET_DIRTY': {
      const dirty = { ...state.dirty, [action.tab]: action.dirty }
      return { ...state, dirty, hasDirtyTabs: TABS.some(t => dirty[t]) }
    }

    case 'SAVE_TAB': {
      const dirty = { ...state.dirty, [action.tab]: false }
      return { ...state, dirty, hasDirtyTabs: TABS.some(t => dirty[t]) }
    }

    case 'UPDATE_SECTION': {
      const sections = {
        ...state.sections,
        [action.tab]: { ...state.sections[action.tab], ...action.data },
      }
      const dirty = { ...state.dirty, [action.tab]: true }
      return { ...state, sections, dirty, hasDirtyTabs: true }
    }

    case 'SET_POST':
      return { ...state, post: action.post }

    default:
      return state
  }
}

interface PostEditorContextValue {
  state: PostEditorState
  dispatch: React.Dispatch<PostEditorAction>
}

const PostEditorCtx = createContext<PostEditorContextValue | null>(null)

export function PostEditorProvider({ post, children }: { post: PostDetailData; children: ReactNode }) {
  const [state, dispatch] = useReducer(postEditorReducer, post, initialState)
  return <PostEditorCtx.Provider value={{ state, dispatch }}>{children}</PostEditorCtx.Provider>
}

export function usePostEditor(): PostEditorContextValue {
  const ctx = useContext(PostEditorCtx)
  if (!ctx) throw new Error('usePostEditor must be used within PostEditorProvider')
  return ctx
}

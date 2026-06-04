import type { JSONContent } from '@tiptap/core'

/* ------------------------------------------------------------------ */
/*  Literal unions                                                    */
/* ------------------------------------------------------------------ */

export type Stage = 'ideia' | 'rascunho' | 'imagens' | 'seo' | 'publicacao'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline'

export type PostStatus =
  | 'idea'
  | 'draft'
  | 'ready'
  | 'pending_review'
  | 'scheduled'
  | 'published'
  | 'archived'

export type ImageBlockStatus = 'empty' | 'uploading' | 'processing' | 'done'

export type ImageAlignment = 'column' | 'wide' | 'full'

/* ------------------------------------------------------------------ */
/*  Interfaces                                                        */
/* ------------------------------------------------------------------ */

/** Per-language content for a single post version. */
export interface VersionContent {
  title: string
  slug: string
  slugTouched: boolean
  excerpt: string
  body: JSONContent | null
  bodyHtml: string
  published: boolean
  publishedAt: string | null
  updatedAt: string | null
  dirty: boolean
  fresh: boolean
  coverImageUrl: string | null
  coverReady: boolean
  metaTitle: string
  metaDesc: string
  ogImageUrl: string | null
  words: number
  readTime: number
  titleAlts: string[]
}

/** Cross-language shared fields. */
export interface SharedFields {
  status: PostStatus
  category: string
  tagId: string | null
  tags: string[]
  hashtags: Array<{ id: string; name: string; slug: string }>
  hook: string
  synopsis: string
  plevel: number | null
  previousPostId: string | null
  continuesInNext: boolean
  keyPoints: string[]
  pullQuote: string
  notes: string[]
  colophon: string
  history: Array<{ to: string; date: string }>
}

/** Full editor state tree. */
export interface EditorState {
  postId: string | null
  code: string
  siteId: string
  siteTimezone: string
  activeStage: Stage
  activeLang: 'pt' | 'en'
  focus: boolean
  content: Partial<Record<'pt' | 'en', VersionContent>>
  shared: SharedFields
  saveStatus: SaveStatus
  scrollToImageId: string | null
}

/** Discriminated union of all editor actions. */
export type EditorAction =
  | { type: 'SET_STAGE'; stage: Stage }
  | { type: 'SET_LANG'; lang: 'pt' | 'en' }
  | { type: 'TOGGLE_FOCUS' }
  | { type: 'SET_POST_ID'; postId: string }
  | { type: 'SET_TITLE'; title: string }
  | { type: 'SET_BODY'; body: JSONContent; html: string; words: number; readTime: number }
  | { type: 'SET_SLUG'; slug: string; touched?: boolean }
  | { type: 'SET_EXCERPT'; excerpt: string }
  | { type: 'SET_COVER'; url: string | null; ready: boolean }
  | { type: 'SET_FIELD'; field: keyof VersionContent; value: unknown }
  | { type: 'SET_SHARED'; field: keyof SharedFields; value: unknown }
  | { type: 'SET_IMAGE_STATUS'; index: number; status: ImageBlockStatus }
  | { type: 'ADD_VERSION'; lang: 'pt' | 'en' }
  | { type: 'REMOVE_VERSION'; lang: 'pt' | 'en' }
  | { type: 'PUBLISH' }
  | { type: 'UPDATE_PUBLISHED'; publishedAt: string }
  | { type: 'MARK_DIRTY' }
  | { type: 'CLEAR_DIRTY' }
  | { type: 'SET_SAVE_STATUS'; status: SaveStatus }
  | { type: 'SCROLL_TO_IMAGE'; imageId: string }
  | { type: 'CLEAR_SCROLL_TARGET' }
  | { type: 'INIT'; state: Partial<EditorState> }

/** Single gate check result. */
export interface GateCheck {
  key: 'title' | 'content' | 'images'
  ok: boolean
  stage: Stage
}

/** Aggregate gate result for stage transitions. */
export interface GateResult {
  passed: boolean
  checks: GateCheck[]
}

/** Image completeness stats. */
export interface ImageStatsResult {
  done: number
  total: number
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

/** Ordered stages of the editor workflow. */
export const STAGES: Stage[] = [
  'ideia',
  'rascunho',
  'imagens',
  'seo',
  'publicacao',
]

/** Post statuses that allow auto-save. */
export const AUTO_SAVE_STATUSES = new Set<PostStatus>(['idea', 'draft'])

/** Lucide icon name per stage. */
export const STAGE_ICONS: Record<Stage, string> = {
  ideia: 'Lightbulb',
  rascunho: 'Edit',
  imagens: 'Image',
  seo: 'Search',
  publicacao: 'Upload',
}

/** Default empty version content (fresh, all fields zeroed). */
export const EMPTY_VERSION: VersionContent = {
  title: '',
  slug: '',
  slugTouched: false,
  excerpt: '',
  body: null,
  bodyHtml: '',
  published: false,
  publishedAt: null,
  updatedAt: null,
  dirty: false,
  fresh: true,
  coverImageUrl: null,
  coverReady: false,
  metaTitle: '',
  metaDesc: '',
  ogImageUrl: null,
  words: 0,
  readTime: 0,
  titleAlts: [],
}

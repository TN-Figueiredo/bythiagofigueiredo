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

/** Social distribution platforms planned at publish time. */
export type DistPlatformId = 'instagram' | 'bluesky' | 'facebook' | 'youtube'

/** When a channel's post goes out relative to the blog publish. */
export type DistTiming = 'with' | 'plus1' | 'plus1d'

/** Distribution plan: selected platform → timing. Empty = nothing scheduled. */
export type DistributionPlan = Partial<Record<DistPlatformId, DistTiming>>

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
  distribution: DistributionPlan
  seoAudit: SeoAudit | null
}

/** Resumo da auditoria SEO gravado pelo Cowork em seo_{lang}.content.audit. */
export interface SeoAudit {
  score: number
  grade: string
  ranAt: string
  phase: 'pre_publish' | 'post_publish'
  keyword: string
  issues: Array<{ severity: 'critical' | 'high' | 'medium' | 'low'; check: string; msg: string; fix: string }>
  titleSuggestions: Array<{ title: string; rationale: string }>
  metaSuggestion: { title: string; description: string } | null
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
  coverPrompt: string
  direction: string
  directionAlts: string[]
  /** Prompt Midjourney por ref_id de imagem inline (de images_shared.body_images[].prompts). */
  imagePrompts: Record<string, string>
  history: Array<{ to: string; date: string }>
}

/** Blog category definition from content_collections. */
export interface CategoryInfo {
  id: string
  labelPt: string
  labelEn: string
  color: string
  colorDark: string
}

/** Full editor state tree. */
export interface EditorState {
  postId: string | null
  pipelineItemId: string | null
  code: string
  siteId: string
  siteTimezone: string
  activeStage: Stage
  activeLang: 'pt' | 'en'
  focus: boolean
  inspectorOpen: boolean
  content: Partial<Record<'pt' | 'en', VersionContent>>
  shared: SharedFields
  categories: CategoryInfo[]
  saveStatus: SaveStatus
  scrollToImageId: string | null
}

/** Discriminated union of all editor actions. */
export type EditorAction =
  | { type: 'SET_STAGE'; stage: Stage }
  | { type: 'SET_LANG'; lang: 'pt' | 'en' }
  | { type: 'TOGGLE_FOCUS' }
  | { type: 'TOGGLE_INSPECTOR' }
  | { type: 'SET_POST_ID'; postId: string }
  | { type: 'SET_TITLE'; title: string }
  | { type: 'SET_BODY'; body: JSONContent; html: string; words: number; readTime: number }
  | { type: 'SET_SLUG'; slug: string; touched?: boolean }
  | { type: 'SET_EXCERPT'; excerpt: string }
  | { type: 'SET_COVER'; url: string | null; ready: boolean }
  | { type: 'SET_FIELD'; field: keyof VersionContent; value: unknown }
  | { type: 'SET_SHARED'; field: keyof SharedFields; value: unknown }
  | { type: 'SET_DIRECTION'; direction: string; alts: string[] }
  | { type: 'SET_IMAGE_STATUS'; index: number; status: ImageBlockStatus; url?: string }
  | { type: 'SET_DIST'; platform: DistPlatformId; timing: DistTiming | null }
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
  distribution: {},
  seoAudit: null,
}

import type { JSONContent } from '@tiptap/core'
import type {
  EditorState,
  EditorAction,
  VersionContent,
  PostStatus,
  SharedFields,
} from './types'
import { EMPTY_VERSION } from './types'
import { deriveSlug } from './helpers'

/* ------------------------------------------------------------------ */
/*  ServerData — shape provided by the server page                    */
/* ------------------------------------------------------------------ */

export interface ServerData {
  postId: string
  code: string
  siteId: string
  siteTimezone: string
  locale: string
  title: string
  slug: string
  excerpt: string
  status: PostStatus
  contentJson: Record<string, unknown> | null
  contentHtml: string | null
  coverImageUrl: string | null
  metaTitle: string
  metaDesc: string
  ogImageUrl: string | null
  keyPoints: string[]
  pullQuote: string
  notes: string[]
  colophon: string
  previousPostId: string | null
  continuesInNext: boolean
  hashtags: Array<{ id: string; name: string; slug: string }>
  tags: string[]
  hook: string
  synopsis: string
  plevel: string
  history: Array<{ to: string; date: string }>
  category: string | null
  tagId: string | null
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                  */
/* ------------------------------------------------------------------ */

/** Immutably update the active version within state. */
function updateActiveVersion(
  state: EditorState,
  patch: Partial<VersionContent>,
): EditorState {
  const lang = state.activeLang
  const version = state.content[lang]
  if (!version) return state
  return {
    ...state,
    content: { ...state.content, [lang]: { ...version, ...patch } },
  }
}

/** Map plevel string ('P1', 'P2', etc.) to number, or null. */
function parsePlevel(plevel: string): number | null {
  if (!plevel) return null
  const match = plevel.match(/^P?(\d+)$/i)
  return match?.[1] ? parseInt(match[1], 10) : null
}

/* ------------------------------------------------------------------ */
/*  editorReducer                                                     */
/* ------------------------------------------------------------------ */

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    /* ---- Navigation ---- */

    case 'SET_STAGE':
      return { ...state, activeStage: action.stage }

    case 'SCROLL_TO_IMAGE':
      return { ...state, scrollToImageId: action.imageId }

    case 'CLEAR_SCROLL_TARGET':
      return { ...state, scrollToImageId: null }

    case 'SET_LANG': {
      if (!state.content[action.lang]) return state
      return { ...state, activeLang: action.lang }
    }

    case 'TOGGLE_FOCUS':
      return { ...state, focus: !state.focus }

    /* ---- Content ---- */

    case 'SET_POST_ID':
      return { ...state, postId: action.postId }

    case 'SET_TITLE': {
      const lang = state.activeLang
      const version = state.content[lang]
      if (!version) return state
      const patch: Partial<VersionContent> = { title: action.title }
      if (!version.slugTouched) {
        patch.slug = deriveSlug(action.title)
      }
      return updateActiveVersion(state, patch)
    }

    case 'SET_BODY':
      return updateActiveVersion(state, {
        body: action.body,
        bodyHtml: action.html,
        words: action.words,
        readTime: action.readTime,
      })

    case 'SET_SLUG':
      return updateActiveVersion(state, {
        slug: action.slug,
        slugTouched: action.touched ?? true,
      })

    case 'SET_EXCERPT':
      return updateActiveVersion(state, { excerpt: action.excerpt })

    case 'SET_COVER':
      return updateActiveVersion(state, {
        coverImageUrl: action.url,
        coverReady: action.ready,
      })

    case 'SET_FIELD': {
      const lang = state.activeLang
      const version = state.content[lang]
      if (!version) return state
      return {
        ...state,
        content: {
          ...state.content,
          [lang]: { ...version, [action.field]: action.value },
        },
      }
    }

    case 'SET_IMAGE_STATUS': {
      // Informational — actual TipTap node updates happen via updateAttributes.
      // We update the body JSONContent tree for consistency if body exists.
      const imgLang = state.activeLang
      const imgVersion = state.content[imgLang]
      if (!imgVersion || !imgVersion.body) return state

      const targetIndex = action.index
      const targetStatus = action.status
      let counter = 0
      function updateImageNode(node: JSONContent): JSONContent {
        if (node.type === 'blogImage') {
          if (counter === targetIndex) {
            counter++
            return {
              ...node,
              attrs: { ...node.attrs, status: targetStatus },
            }
          }
          counter++
        }
        if (Array.isArray(node.content)) {
          return { ...node, content: node.content.map(updateImageNode) }
        }
        return node
      }

      const updatedBody = updateImageNode(imgVersion.body)
      return updateActiveVersion(state, { body: updatedBody })
    }

    /* ---- Shared ---- */

    case 'SET_SHARED':
      return {
        ...state,
        shared: { ...state.shared, [action.field]: action.value } as SharedFields,
      }

    /* ---- Versions ---- */

    case 'ADD_VERSION':
      return {
        ...state,
        content: {
          ...state.content,
          [action.lang]: { ...EMPTY_VERSION },
        },
        activeLang: action.lang,
      }

    case 'REMOVE_VERSION': {
      const keys = Object.keys(state.content) as Array<'pt' | 'en'>
      if (keys.length <= 1) return state
      const { [action.lang]: _removed, ...remaining } = state.content
      const remainingKeys = Object.keys(remaining) as Array<'pt' | 'en'>
      const nextLang = remainingKeys[0] ?? state.activeLang
      return {
        ...state,
        content: remaining,
        activeLang: nextLang,
      }
    }

    /* ---- Publishing ---- */

    case 'PUBLISH':
      return updateActiveVersion(state, {
        published: true,
        publishedAt: new Date().toISOString(),
        dirty: false,
        fresh: false,
      })

    case 'UPDATE_PUBLISHED':
      return updateActiveVersion(state, {
        updatedAt: action.publishedAt,
        dirty: false,
      })

    case 'MARK_DIRTY':
      return updateActiveVersion(state, { dirty: true })

    case 'CLEAR_DIRTY':
      return updateActiveVersion(state, { dirty: false })

    /* ---- Save ---- */

    case 'SET_SAVE_STATUS':
      return { ...state, saveStatus: action.status }

    /* ---- Init ---- */

    case 'INIT':
      return { ...state, ...action.state } as EditorState

    default:
      return state
  }
}

/* ------------------------------------------------------------------ */
/*  buildInitialState                                                 */
/* ------------------------------------------------------------------ */

export function buildInitialState(data: ServerData): EditorState {
  const lang: 'pt' | 'en' = data.locale === 'en' ? 'en' : 'pt'

  const version: VersionContent = {
    title: data.title,
    slug: data.slug,
    slugTouched: data.slug.length > 0,
    excerpt: data.excerpt,
    body: (data.contentJson as JSONContent) ?? null,
    bodyHtml: data.contentHtml ?? '',
    published: data.status === 'published',
    publishedAt: null,
    updatedAt: null,
    dirty: false,
    fresh: false,
    coverImageUrl: data.coverImageUrl,
    coverReady: data.coverImageUrl !== null,
    metaTitle: data.metaTitle,
    metaDesc: data.metaDesc,
    ogImageUrl: data.ogImageUrl,
    words: 0,
    readTime: 0,
    titleAlts: [],
  }

  const shared: SharedFields = {
    status: data.status,
    category: data.category ?? '',
    tagId: data.tagId,
    tags: data.tags,
    hashtags: data.hashtags,
    hook: data.hook,
    synopsis: data.synopsis,
    plevel: parsePlevel(data.plevel),
    previousPostId: data.previousPostId,
    continuesInNext: data.continuesInNext,
    keyPoints: data.keyPoints,
    pullQuote: data.pullQuote,
    notes: data.notes,
    colophon: data.colophon,
    history: data.history,
  }

  return {
    postId: data.postId,
    code: data.code,
    siteId: data.siteId,
    siteTimezone: data.siteTimezone,
    activeStage: 'rascunho',
    activeLang: lang,
    focus: false,
    content: { [lang]: version },
    saveStatus: 'idle',
    scrollToImageId: null,
    shared,
  }
}

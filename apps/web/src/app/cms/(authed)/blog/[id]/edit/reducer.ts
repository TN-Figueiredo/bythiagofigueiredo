import type { JSONContent } from '@tiptap/core'
import type {
  EditorState,
  EditorAction,
  VersionContent,
  PostStatus,
  SharedFields,
  CategoryInfo,
} from './types'
import { EMPTY_VERSION } from './types'
import { deriveSlug, STAGE_MAP } from './helpers'

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
  coverPrompt: string
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
  categories: CategoryInfo[]
  /** Reading time (minutes) + word count seeded from the post. */
  readingTimeMin?: number
  words?: number
  /** Publish timestamps (ISO) when the post is already live. */
  publishedAt?: string | null
  updatedAt?: string | null
  /** Testable title alternatives (A/B headlines). */
  titleAlts?: string[]
  /** Other-language versions already stored — used to hydrate the toggle. */
  siblings?: ServerSibling[]
  pipelineItemId?: string | null
  direction?: string
  directionAlts?: string[]
  imagePrompts?: Record<string, string>
  seoAudit?: import('./types').SeoAudit | null
  /** Plano de distribuição social (per-post, shared entre idiomas). */
  distributionPlan?: Record<string, 'with' | 'plus1' | 'plus1d'>
}

/** A non-primary language version loaded alongside the primary. */
export interface ServerSibling {
  locale: string
  title: string
  slug: string
  excerpt: string
  contentJson: Record<string, unknown> | null
  contentHtml: string | null
  coverImageUrl: string | null
  coverReady: boolean
  metaTitle: string
  metaDesc: string
  ogImageUrl: string | null
  published: boolean
  publishedAt: string | null
  updatedAt: string | null
  readingTimeMin?: number
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

    case 'TOGGLE_INSPECTOR':
      return { ...state, inspectorOpen: !state.inspectorOpen }

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
      const targetUrl = action.url
      let counter = 0
      function updateImageNode(node: JSONContent): JSONContent {
        if (node.type === 'blogImage') {
          if (counter === targetIndex) {
            counter++
            const attrs: Record<string, unknown> = { ...node.attrs, status: targetStatus }
            if (targetUrl) attrs.src = targetUrl
            return { ...node, attrs }
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

    case 'SET_DIST': {
      const lang = state.activeLang
      const version = state.content[lang]
      if (!version) return state
      const next = { ...version.distribution }
      if (action.timing === null) {
        delete next[action.platform]
      } else {
        next[action.platform] = action.timing
      }
      // O plano é per-post (coluna distribution_plan) — espelha em todas as
      // línguas pra view PT/EN nunca divergir. Persistido via
      // saveDistributionPlan() no próprio toggle (o autosave não roda em posts
      // ready/published — ver AUTO_SAVE_STATUSES). Não marca dirty.
      const content = { ...state.content }
      for (const key of Object.keys(content) as Array<'pt' | 'en'>) {
        const v = content[key]
        if (v) content[key] = { ...v, distribution: next }
      }
      return { ...state, content }
    }

    /* ---- Shared ---- */

    case 'SET_SHARED':
      return {
        ...state,
        shared: { ...state.shared, [action.field]: action.value } as SharedFields,
      }

    case 'SET_DIRECTION':
      return {
        ...state,
        shared: { ...state.shared, direction: action.direction, directionAlts: action.alts },
      }

    case 'SET_EDIT_MODE':
      return { ...state, editMode: action.mode }

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
    publishedAt: data.publishedAt ?? null,
    updatedAt: data.updatedAt ?? null,
    dirty: false,
    fresh: false,
    coverImageUrl: data.coverImageUrl,
    coverReady: data.coverImageUrl !== null,
    metaTitle: data.metaTitle,
    metaDesc: data.metaDesc,
    ogImageUrl: data.ogImageUrl,
    words: data.words ?? 0,
    readTime: data.readingTimeMin ?? 0,
    titleAlts: data.titleAlts ?? [],
    distribution: (data.distributionPlan ?? {}) as VersionContent['distribution'],
    seoAudit: data.seoAudit ?? null,
  }

  /* Hydrate any other-language version already stored so the lang toggle
     swaps real content instead of clobbering a published sibling. */
  const content: Partial<Record<'pt' | 'en', VersionContent>> = { [lang]: version }
  for (const sib of data.siblings ?? []) {
    const sibLang: 'pt' | 'en' = sib.locale.startsWith('en') ? 'en' : 'pt'
    if (sibLang === lang) continue
    content[sibLang] = {
      title: sib.title,
      slug: sib.slug,
      slugTouched: sib.slug.length > 0,
      excerpt: sib.excerpt,
      body: (sib.contentJson as JSONContent) ?? null,
      bodyHtml: sib.contentHtml ?? '',
      published: sib.published,
      publishedAt: sib.publishedAt,
      updatedAt: sib.updatedAt,
      dirty: false,
      fresh: false,
      coverImageUrl: sib.coverImageUrl,
      coverReady: sib.coverReady,
      metaTitle: sib.metaTitle,
      metaDesc: sib.metaDesc,
      ogImageUrl: sib.ogImageUrl,
      words: 0,
      readTime: sib.readingTimeMin ?? 0,
      titleAlts: [],
      distribution: (data.distributionPlan ?? {}) as VersionContent['distribution'],
      seoAudit: null,
    }
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
    coverPrompt: data.coverPrompt,
    direction: data.direction ?? '',
    directionAlts: data.directionAlts ?? [],
    imagePrompts: data.imagePrompts ?? {},
    history: data.history,
  }

  return {
    postId: data.postId,
    pipelineItemId: data.pipelineItemId ?? null,
    code: data.code,
    siteId: data.siteId,
    siteTimezone: data.siteTimezone,
    activeStage: STAGE_MAP[data.status] ?? 'rascunho',
    // Publicado/agendado abre em leitura — editar é opt-in pelo lápis (paridade
    // com o editor de vídeo); rascunhos abrem direto em edição.
    editMode: data.status === 'published' || data.status === 'scheduled' ? 'view' : 'edit',
    activeLang: lang,
    focus: false,
    inspectorOpen: false,
    content,
    categories: data.categories,
    saveStatus: 'idle',
    scrollToImageId: null,
    shared,
  }
}

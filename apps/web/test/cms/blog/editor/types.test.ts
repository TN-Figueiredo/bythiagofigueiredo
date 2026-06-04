import { describe, it, expect } from 'vitest'
import {
  STAGES,
  AUTO_SAVE_STATUSES,
  STAGE_ICONS,
  EMPTY_VERSION,
} from '@/app/cms/(authed)/blog/[id]/editor/types'
import type {
  Stage,
  SaveStatus,
  PostStatus,
  ImageBlockStatus,
  ImageAlignment,
  VersionContent,
  SharedFields,
  EditorState,
  EditorAction,
  GateCheck,
  GateResult,
  ImageStatsResult,
} from '@/app/cms/(authed)/blog/[id]/editor/types'

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

describe('STAGES', () => {
  it('has 5 entries in correct order', () => {
    expect(STAGES).toEqual([
      'ideia',
      'rascunho',
      'imagens',
      'seo',
      'publicacao',
    ])
  })

  it('each element satisfies the Stage type', () => {
    const valid: Stage[] = STAGES
    expect(valid).toHaveLength(5)
  })
})

describe('AUTO_SAVE_STATUSES', () => {
  it('contains idea and draft', () => {
    expect(AUTO_SAVE_STATUSES.has('idea')).toBe(true)
    expect(AUTO_SAVE_STATUSES.has('draft')).toBe(true)
  })

  it('does not contain published or ready', () => {
    expect(AUTO_SAVE_STATUSES.has('published')).toBe(false)
    expect(AUTO_SAVE_STATUSES.has('ready')).toBe(false)
  })

  it('has exactly 2 entries', () => {
    expect(AUTO_SAVE_STATUSES.size).toBe(2)
  })
})

describe('STAGE_ICONS', () => {
  it('maps each stage to a string', () => {
    for (const stage of STAGES) {
      expect(typeof STAGE_ICONS[stage]).toBe('string')
      expect(STAGE_ICONS[stage].length).toBeGreaterThan(0)
    }
  })

  it('maps to expected Lucide icon names', () => {
    expect(STAGE_ICONS.ideia).toBe('Lightbulb')
    expect(STAGE_ICONS.rascunho).toBe('Edit')
    expect(STAGE_ICONS.imagens).toBe('Image')
    expect(STAGE_ICONS.seo).toBe('Search')
    expect(STAGE_ICONS.publicacao).toBe('Upload')
  })
})

describe('EMPTY_VERSION', () => {
  it('has fresh set to true', () => {
    expect(EMPTY_VERSION.fresh).toBe(true)
  })

  it('has dirty set to false', () => {
    expect(EMPTY_VERSION.dirty).toBe(false)
  })

  it('has empty string for text fields', () => {
    expect(EMPTY_VERSION.title).toBe('')
    expect(EMPTY_VERSION.slug).toBe('')
    expect(EMPTY_VERSION.excerpt).toBe('')
    expect(EMPTY_VERSION.bodyHtml).toBe('')
    expect(EMPTY_VERSION.metaTitle).toBe('')
    expect(EMPTY_VERSION.metaDesc).toBe('')
  })

  it('has null for nullable fields', () => {
    expect(EMPTY_VERSION.body).toBeNull()
    expect(EMPTY_VERSION.publishedAt).toBeNull()
    expect(EMPTY_VERSION.updatedAt).toBeNull()
    expect(EMPTY_VERSION.coverImageUrl).toBeNull()
    expect(EMPTY_VERSION.ogImageUrl).toBeNull()
  })

  it('has zeroed numeric fields', () => {
    expect(EMPTY_VERSION.words).toBe(0)
    expect(EMPTY_VERSION.readTime).toBe(0)
  })

  it('has empty arrays', () => {
    expect(EMPTY_VERSION.titleAlts).toEqual([])
  })

  it('has published false, slugTouched false, coverReady false', () => {
    expect(EMPTY_VERSION.published).toBe(false)
    expect(EMPTY_VERSION.slugTouched).toBe(false)
    expect(EMPTY_VERSION.coverReady).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  Type-level checks (compile-time, but we assert shape at runtime)  */
/* ------------------------------------------------------------------ */

describe('type shape checks', () => {
  it('Stage union covers all stages', () => {
    const stages: Stage[] = ['ideia', 'rascunho', 'imagens', 'seo', 'publicacao']
    expect(stages).toHaveLength(5)
  })

  it('SaveStatus union covers all statuses', () => {
    const statuses: SaveStatus[] = ['idle', 'saving', 'saved', 'error', 'offline']
    expect(statuses).toHaveLength(5)
  })

  it('PostStatus union covers all statuses', () => {
    const statuses: PostStatus[] = [
      'idea', 'draft', 'ready', 'pending_review',
      'scheduled', 'published', 'archived',
    ]
    expect(statuses).toHaveLength(7)
  })

  it('ImageBlockStatus union covers all statuses', () => {
    const statuses: ImageBlockStatus[] = ['empty', 'uploading', 'processing', 'done']
    expect(statuses).toHaveLength(4)
  })

  it('ImageAlignment union covers all alignments', () => {
    const alignments: ImageAlignment[] = ['column', 'wide', 'full']
    expect(alignments).toHaveLength(3)
  })

  it('GateCheck shape is valid', () => {
    const check: GateCheck = { key: 'title', ok: true, stage: 'ideia' }
    expect(check.key).toBe('title')
    expect(check.ok).toBe(true)
    expect(check.stage).toBe('ideia')
  })

  it('GateResult shape is valid', () => {
    const result: GateResult = {
      passed: true,
      checks: [{ key: 'content', ok: true, stage: 'rascunho' }],
    }
    expect(result.passed).toBe(true)
    expect(result.checks).toHaveLength(1)
  })

  it('ImageStatsResult shape is valid', () => {
    const stats: ImageStatsResult = { done: 3, total: 5 }
    expect(stats.done).toBe(3)
    expect(stats.total).toBe(5)
  })

  it('EditorAction discriminated union covers SET_STAGE', () => {
    const action: EditorAction = { type: 'SET_STAGE', stage: 'seo' }
    expect(action.type).toBe('SET_STAGE')
  })

  it('EditorAction discriminated union covers INIT', () => {
    const state: Partial<EditorState> = { postId: '123' }
    const action: EditorAction = { type: 'INIT', state }
    expect(action.type).toBe('INIT')
  })

  it('EditorState has required shape', () => {
    const state: EditorState = {
      postId: null,
      code: '',
      activeStage: 'ideia',
      activeLang: 'pt',
      focus: false,
      content: {},
      shared: {
        status: 'idea',
        category: '',
        tagId: null,
        tags: [],
        hashtags: [],
        hook: '',
        synopsis: '',
        plevel: null,
        previousPostId: null,
        continuesInNext: false,
        keyPoints: [],
        pullQuote: '',
        notes: [],
        colophon: '',
        history: [],
      },
      saveStatus: 'idle',
    }
    expect(state.postId).toBeNull()
    expect(state.activeStage).toBe('ideia')
    expect(state.activeLang).toBe('pt')
  })
})

import { describe, it, expect } from 'vitest'
import { editorReducer, buildInitialState } from '@/app/cms/(authed)/blog/[id]/editor/reducer'
import type { EditorState, EditorAction } from '@/app/cms/(authed)/blog/[id]/editor/types'
import { EMPTY_VERSION } from '@/app/cms/(authed)/blog/[id]/editor/types'
import type { ServerData } from '@/app/cms/(authed)/blog/[id]/editor/reducer'

/* ------------------------------------------------------------------ */
/*  Helper                                                            */
/* ------------------------------------------------------------------ */

function makeState(overrides: Partial<EditorState> = {}): EditorState {
  return {
    postId: 'p1',
    code: 'tg-01',
    siteId: 'site-1',
    siteTimezone: 'America/Sao_Paulo',
    activeStage: 'rascunho',
    activeLang: 'pt',
    focus: false,
    content: { pt: { ...EMPTY_VERSION, fresh: false } },
    shared: {
      status: 'draft',
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
    scrollToImageId: null,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Navigation                                                        */
/* ------------------------------------------------------------------ */

describe('Navigation actions', () => {
  it('SET_STAGE changes activeStage', () => {
    const state = makeState()
    const next = editorReducer(state, { type: 'SET_STAGE', stage: 'imagens' })
    expect(next.activeStage).toBe('imagens')
  })

  it('SET_LANG changes activeLang when version exists', () => {
    const state = makeState({
      content: {
        pt: { ...EMPTY_VERSION, fresh: false },
        en: { ...EMPTY_VERSION, fresh: false },
      },
    })
    const next = editorReducer(state, { type: 'SET_LANG', lang: 'en' })
    expect(next.activeLang).toBe('en')
  })

  it('SET_LANG is no-op when version does not exist', () => {
    const state = makeState()
    const next = editorReducer(state, { type: 'SET_LANG', lang: 'en' })
    expect(next.activeLang).toBe('pt')
  })

  it('TOGGLE_FOCUS toggles focus boolean', () => {
    const state = makeState({ focus: false })
    const next = editorReducer(state, { type: 'TOGGLE_FOCUS' })
    expect(next.focus).toBe(true)

    const next2 = editorReducer(next, { type: 'TOGGLE_FOCUS' })
    expect(next2.focus).toBe(false)
  })

  it('SCROLL_TO_IMAGE sets scrollToImageId', () => {
    const state = makeState()
    const next = editorReducer(state, { type: 'SCROLL_TO_IMAGE', imageId: 'img-42' })
    expect(next.scrollToImageId).toBe('img-42')
  })

  it('CLEAR_SCROLL_TARGET resets scrollToImageId to null', () => {
    const state = makeState({ scrollToImageId: 'img-42' })
    const next = editorReducer(state, { type: 'CLEAR_SCROLL_TARGET' })
    expect(next.scrollToImageId).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/*  Content                                                           */
/* ------------------------------------------------------------------ */

describe('Content actions', () => {
  it('SET_TITLE updates title and auto-derives slug when !slugTouched', () => {
    const state = makeState()
    const next = editorReducer(state, { type: 'SET_TITLE', title: 'My First Post' })
    expect(next.content.pt!.title).toBe('My First Post')
    expect(next.content.pt!.slug).toBe('my-first-post')
  })

  it('SET_TITLE does NOT change slug when slugTouched is true', () => {
    const state = makeState({
      content: {
        pt: { ...EMPTY_VERSION, fresh: false, slugTouched: true, slug: 'custom-slug' },
      },
    })
    const next = editorReducer(state, { type: 'SET_TITLE', title: 'New Title' })
    expect(next.content.pt!.title).toBe('New Title')
    expect(next.content.pt!.slug).toBe('custom-slug')
  })

  it('SET_SLUG updates slug and sets slugTouched', () => {
    const state = makeState()
    const next = editorReducer(state, { type: 'SET_SLUG', slug: 'manual-slug' })
    expect(next.content.pt!.slug).toBe('manual-slug')
    expect(next.content.pt!.slugTouched).toBe(true)
  })

  it('SET_BODY updates body, bodyHtml, words, readTime', () => {
    const body = { type: 'doc' as const, content: [{ type: 'paragraph' }] }
    const next = editorReducer(makeState(), {
      type: 'SET_BODY',
      body,
      html: '<p>hello</p>',
      words: 100,
      readTime: 2,
    })
    expect(next.content.pt!.body).toEqual(body)
    expect(next.content.pt!.bodyHtml).toBe('<p>hello</p>')
    expect(next.content.pt!.words).toBe(100)
    expect(next.content.pt!.readTime).toBe(2)
  })

  it('SET_COVER updates coverImageUrl and coverReady', () => {
    const next = editorReducer(makeState(), {
      type: 'SET_COVER',
      url: 'https://example.com/img.jpg',
      ready: true,
    })
    expect(next.content.pt!.coverImageUrl).toBe('https://example.com/img.jpg')
    expect(next.content.pt!.coverReady).toBe(true)
  })

  it('SET_EXCERPT updates excerpt', () => {
    const next = editorReducer(makeState(), {
      type: 'SET_EXCERPT',
      excerpt: 'A short summary',
    })
    expect(next.content.pt!.excerpt).toBe('A short summary')
  })

  it('SET_FIELD updates arbitrary version field', () => {
    const next = editorReducer(makeState(), {
      type: 'SET_FIELD',
      field: 'metaTitle',
      value: 'SEO Title',
    })
    expect(next.content.pt!.metaTitle).toBe('SEO Title')
  })
})

/* ------------------------------------------------------------------ */
/*  Shared                                                            */
/* ------------------------------------------------------------------ */

describe('Shared actions', () => {
  it('SET_SHARED updates shared field', () => {
    const next = editorReducer(makeState(), {
      type: 'SET_SHARED',
      field: 'hook',
      value: 'A great hook',
    })
    expect(next.shared.hook).toBe('A great hook')
  })
})

/* ------------------------------------------------------------------ */
/*  Versions                                                          */
/* ------------------------------------------------------------------ */

describe('Version actions', () => {
  it('ADD_VERSION creates empty version and switches activeLang', () => {
    const state = makeState()
    const next = editorReducer(state, { type: 'ADD_VERSION', lang: 'en' })
    expect(next.content.en).toBeDefined()
    expect(next.content.en!.fresh).toBe(true)
    expect(next.content.en!.title).toBe('')
    expect(next.activeLang).toBe('en')
  })

  it('REMOVE_VERSION removes lang and switches to remaining', () => {
    const state = makeState({
      content: {
        pt: { ...EMPTY_VERSION, fresh: false },
        en: { ...EMPTY_VERSION, fresh: false },
      },
      activeLang: 'en',
    })
    const next = editorReducer(state, { type: 'REMOVE_VERSION', lang: 'en' })
    expect(next.content.en).toBeUndefined()
    expect(next.activeLang).toBe('pt')
  })

  it('REMOVE_VERSION is no-op when only one version exists', () => {
    const state = makeState()
    const next = editorReducer(state, { type: 'REMOVE_VERSION', lang: 'pt' })
    expect(next.content.pt).toBeDefined()
    expect(next.activeLang).toBe('pt')
  })
})

/* ------------------------------------------------------------------ */
/*  Publishing                                                        */
/* ------------------------------------------------------------------ */

describe('Publishing actions', () => {
  it('PUBLISH sets published, publishedAt, clears dirty and fresh', () => {
    const state = makeState({
      content: {
        pt: { ...EMPTY_VERSION, fresh: true, dirty: true },
      },
    })
    const next = editorReducer(state, { type: 'PUBLISH' })
    expect(next.content.pt!.published).toBe(true)
    expect(next.content.pt!.publishedAt).toBeTruthy()
    expect(next.content.pt!.dirty).toBe(false)
    expect(next.content.pt!.fresh).toBe(false)
  })

  it('MARK_DIRTY sets dirty on active version', () => {
    const next = editorReducer(makeState(), { type: 'MARK_DIRTY' })
    expect(next.content.pt!.dirty).toBe(true)
  })

  it('CLEAR_DIRTY resets dirty on active version', () => {
    const state = makeState({
      content: { pt: { ...EMPTY_VERSION, dirty: true } },
    })
    const next = editorReducer(state, { type: 'CLEAR_DIRTY' })
    expect(next.content.pt!.dirty).toBe(false)
  })

  it('UPDATE_PUBLISHED sets updatedAt and clears dirty', () => {
    const state = makeState({
      content: { pt: { ...EMPTY_VERSION, dirty: true, published: true, publishedAt: '2026-01-01T00:00:00.000Z' } },
    })
    const now = '2026-06-04T12:00:00.000Z'
    const next = editorReducer(state, { type: 'UPDATE_PUBLISHED', publishedAt: now })
    expect(next.content.pt!.updatedAt).toBe(now)
    expect(next.content.pt!.dirty).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  Save                                                              */
/* ------------------------------------------------------------------ */

describe('Save actions', () => {
  it('SET_SAVE_STATUS updates saveStatus', () => {
    const next = editorReducer(makeState(), {
      type: 'SET_SAVE_STATUS',
      status: 'saving',
    })
    expect(next.saveStatus).toBe('saving')
  })

  it('SET_POST_ID sets postId', () => {
    const next = editorReducer(makeState({ postId: null }), {
      type: 'SET_POST_ID',
      postId: 'new-id-123',
    })
    expect(next.postId).toBe('new-id-123')
  })
})

/* ------------------------------------------------------------------ */
/*  Init                                                              */
/* ------------------------------------------------------------------ */

describe('INIT action', () => {
  it('replaces state wholesale', () => {
    const replacement = makeState({
      postId: 'replaced',
      code: 'tg-99',
      activeStage: 'seo',
    })
    const next = editorReducer(makeState(), { type: 'INIT', state: replacement })
    expect(next.postId).toBe('replaced')
    expect(next.code).toBe('tg-99')
    expect(next.activeStage).toBe('seo')
  })
})

/* ------------------------------------------------------------------ */
/*  buildInitialState                                                 */
/* ------------------------------------------------------------------ */

describe('buildInitialState', () => {
  it('transforms ServerData into EditorState correctly', () => {
    const data: ServerData = {
      postId: 'post-abc',
      code: 'tg-42',
      siteId: 'site-1',
      siteTimezone: 'America/Sao_Paulo',
      locale: 'pt',
      title: 'Test Title',
      slug: 'test-title',
      excerpt: 'A test excerpt',
      status: 'draft',
      contentJson: { type: 'doc', content: [] },
      contentHtml: '<p>hello</p>',
      coverImageUrl: 'https://img.example.com/cover.jpg',
      metaTitle: 'Meta Title',
      metaDesc: 'Meta description',
      ogImageUrl: null,
      keyPoints: ['point 1'],
      pullQuote: 'Quote here',
      notes: ['note 1'],
      colophon: 'Colophon text',
      previousPostId: null,
      continuesInNext: false,
      hashtags: [{ id: 'h1', name: 'test', slug: 'test' }],
      tags: ['tag1'],
      hook: 'Great hook',
      synopsis: 'Synopsis here',
      plevel: 'P1',
      history: [{ to: 'draft', date: '2026-01-01' }],
      category: 'tech',
      tagId: 'tag-1',
    }

    const state = buildInitialState(data)

    expect(state.postId).toBe('post-abc')
    expect(state.code).toBe('tg-42')
    expect(state.activeStage).toBe('rascunho')
    expect(state.activeLang).toBe('pt')
    expect(state.focus).toBe(false)
    expect(state.saveStatus).toBe('idle')

    // Version content
    const pt = state.content.pt!
    expect(pt.title).toBe('Test Title')
    expect(pt.slug).toBe('test-title')
    expect(pt.excerpt).toBe('A test excerpt')
    expect(pt.bodyHtml).toBe('<p>hello</p>')
    expect(pt.coverImageUrl).toBe('https://img.example.com/cover.jpg')
    expect(pt.metaTitle).toBe('Meta Title')
    expect(pt.metaDesc).toBe('Meta description')
    expect(pt.fresh).toBe(false)
    expect(pt.dirty).toBe(false)

    // Shared fields
    expect(state.shared.status).toBe('draft')
    expect(state.shared.hook).toBe('Great hook')
    expect(state.shared.synopsis).toBe('Synopsis here')
    expect(state.shared.keyPoints).toEqual(['point 1'])
    expect(state.shared.hashtags).toEqual([{ id: 'h1', name: 'test', slug: 'test' }])
    expect(state.shared.category).toBe('tech')
    expect(state.shared.tagId).toBe('tag-1')
    expect(state.shared.history).toEqual([{ to: 'draft', date: '2026-01-01' }])
  })
})

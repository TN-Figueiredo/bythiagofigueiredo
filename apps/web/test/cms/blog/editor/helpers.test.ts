import { describe, it, expect } from 'vitest'
import type { JSONContent } from '@tiptap/core'
import {
  deriveSlug,
  isEmptyVersion,
  publishGate,
  imageStats,
} from '@/app/cms/(authed)/blog/[id]/editor/helpers'
import {
  EMPTY_VERSION,
  type VersionContent,
  type EditorState,
} from '@/app/cms/(authed)/blog/[id]/editor/types'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeVersion(overrides: Partial<VersionContent> = {}): VersionContent {
  return { ...EMPTY_VERSION, ...overrides }
}

function makeState(
  lang: 'pt' | 'en',
  version: Partial<VersionContent> = {},
  stateOverrides: Partial<EditorState> = {},
): EditorState {
  return {
    postId: 'test-id',
    code: 'test',
    activeStage: 'rascunho',
    activeLang: lang,
    focus: false,
    content: { [lang]: makeVersion(version) },
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
    ...stateOverrides,
  }
}

function textBody(text: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  }
}

/* ------------------------------------------------------------------ */
/*  deriveSlug                                                        */
/* ------------------------------------------------------------------ */

describe('deriveSlug', () => {
  it('returns empty string for empty input', () => {
    expect(deriveSlug('')).toBe('')
  })

  it('lowercases and hyphenates a normal title', () => {
    expect(deriveSlug('Hello World')).toBe('hello-world')
  })

  it('strips accented characters', () => {
    expect(deriveSlug('Ação é vida com café')).toBe('acao-e-vida-com-cafe')
  })

  it('strips smart quotes and apostrophes', () => {
    expect(deriveSlug('“test” it’s a ‘demo’')).toBe(
      'test-its-a-demo',
    )
  })

  it('replaces special characters with hyphens', () => {
    expect(deriveSlug('foo@bar#baz$qux')).toBe('foo-bar-baz-qux')
  })

  it('collapses consecutive hyphens', () => {
    expect(deriveSlug('foo---bar')).toBe('foo-bar')
  })

  it('trims leading and trailing hyphens', () => {
    expect(deriveSlug('--hello--')).toBe('hello')
  })

  it('truncates to 60 characters', () => {
    const long = 'a'.repeat(80)
    expect(deriveSlug(long)).toBe('a'.repeat(60))
  })

  it('handles consecutive spaces as single hyphen', () => {
    expect(deriveSlug('hello    world')).toBe('hello-world')
  })

  it('handles mixed edge cases', () => {
    expect(deriveSlug('  --Çédric’s Café & Té-- ')).toBe(
      'cedrics-cafe-te',
    )
  })
})

/* ------------------------------------------------------------------ */
/*  isEmptyVersion                                                    */
/* ------------------------------------------------------------------ */

describe('isEmptyVersion', () => {
  it('returns true for EMPTY_VERSION', () => {
    expect(isEmptyVersion(EMPTY_VERSION)).toBe(true)
  })

  it('returns false when title is set', () => {
    expect(isEmptyVersion(makeVersion({ title: 'My Post' }))).toBe(false)
  })

  it('returns false when published is true', () => {
    expect(isEmptyVersion(makeVersion({ published: true }))).toBe(false)
  })

  it('returns false when excerpt is set', () => {
    expect(isEmptyVersion(makeVersion({ excerpt: 'Summary' }))).toBe(false)
  })

  it('returns false when body has text content', () => {
    expect(isEmptyVersion(makeVersion({ body: textBody('Hello') }))).toBe(
      false,
    )
  })

  it('returns true when title is only whitespace', () => {
    expect(isEmptyVersion(makeVersion({ title: '   ' }))).toBe(true)
  })

  it('returns true when body is null', () => {
    expect(isEmptyVersion(makeVersion({ body: null }))).toBe(true)
  })

  it('returns true when body has empty paragraph', () => {
    const emptyDoc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [] }],
    }
    expect(isEmptyVersion(makeVersion({ body: emptyDoc }))).toBe(true)
  })

  it('returns false when body has deeply nested text', () => {
    const nestedBody: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'item' }],
                },
              ],
            },
          ],
        },
      ],
    }
    expect(isEmptyVersion(makeVersion({ body: nestedBody }))).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  publishGate                                                       */
/* ------------------------------------------------------------------ */

describe('publishGate', () => {
  it('passes when title, body, and images are all satisfied', () => {
    const state = makeState('pt', {
      title: 'My Post',
      body: textBody('Some content'),
      coverReady: true,
    })
    const result = publishGate(state, 'pt')
    expect(result.passed).toBe(true)
    expect(result.checks).toHaveLength(3)
    expect(result.checks.every((c) => c.ok)).toBe(true)
  })

  it('fails when title is empty', () => {
    const state = makeState('pt', {
      title: '',
      body: textBody('Some content'),
      coverReady: true,
    })
    const result = publishGate(state, 'pt')
    expect(result.passed).toBe(false)
    const titleCheck = result.checks.find((c) => c.key === 'title')
    expect(titleCheck?.ok).toBe(false)
    expect(titleCheck?.stage).toBe('rascunho')
  })

  it('fails when body is empty', () => {
    const state = makeState('pt', {
      title: 'Has Title',
      body: null,
      coverReady: true,
    })
    const result = publishGate(state, 'pt')
    expect(result.passed).toBe(false)
    const contentCheck = result.checks.find((c) => c.key === 'content')
    expect(contentCheck?.ok).toBe(false)
    expect(contentCheck?.stage).toBe('rascunho')
  })

  it('fails when cover is not ready', () => {
    const state = makeState('pt', {
      title: 'Has Title',
      body: textBody('Content here'),
      coverReady: false,
    })
    const result = publishGate(state, 'pt')
    expect(result.passed).toBe(false)
    const imgCheck = result.checks.find((c) => c.key === 'images')
    expect(imgCheck?.ok).toBe(false)
    expect(imgCheck?.stage).toBe('imagens')
  })

  it('fails when blogImage node has status empty', () => {
    const bodyWithImage: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello' }],
        },
        {
          type: 'blogImage',
          attrs: { status: 'empty', src: null },
        },
      ],
    }
    const state = makeState('pt', {
      title: 'Title',
      body: bodyWithImage,
      coverReady: true,
    })
    const result = publishGate(state, 'pt')
    expect(result.passed).toBe(false)
    const imgCheck = result.checks.find((c) => c.key === 'images')
    expect(imgCheck?.ok).toBe(false)
  })

  it('passes when all blogImage nodes have status done', () => {
    const bodyWithDoneImages: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello' }],
        },
        {
          type: 'blogImage',
          attrs: { status: 'done', src: 'https://example.com/img.jpg' },
        },
      ],
    }
    const state = makeState('pt', {
      title: 'Title',
      body: bodyWithDoneImages,
      coverReady: true,
    })
    const result = publishGate(state, 'pt')
    expect(result.passed).toBe(true)
  })

  it('returns all checks even when version is missing', () => {
    const state = makeState('pt', {})
    // Override to remove the lang content entirely
    state.content = {}
    const result = publishGate(state, 'en')
    expect(result.passed).toBe(false)
    expect(result.checks).toHaveLength(3)
  })
})

/* ------------------------------------------------------------------ */
/*  imageStats                                                        */
/* ------------------------------------------------------------------ */

describe('imageStats', () => {
  it('returns zeros when body has no blogImage nodes', () => {
    const result = imageStats(textBody('Just text'), true)
    expect(result).toEqual({ done: 0, total: 0 })
  })

  it('counts mixed done and non-done images', () => {
    const body: JSONContent = {
      type: 'doc',
      content: [
        { type: 'blogImage', attrs: { status: 'done' } },
        { type: 'blogImage', attrs: { status: 'empty' } },
        { type: 'blogImage', attrs: { status: 'uploading' } },
        { type: 'blogImage', attrs: { status: 'done' } },
      ],
    }
    const result = imageStats(body, false)
    expect(result).toEqual({ done: 2, total: 4 })
  })

  it('counts all done images', () => {
    const body: JSONContent = {
      type: 'doc',
      content: [
        { type: 'blogImage', attrs: { status: 'done' } },
        { type: 'blogImage', attrs: { status: 'done' } },
      ],
    }
    const result = imageStats(body, true)
    expect(result).toEqual({ done: 2, total: 2 })
  })

  it('does not count cover image in stats', () => {
    // coverReady is passed but should NOT affect done/total counts
    const body: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'No images' }] }],
    }
    const result = imageStats(body, true)
    expect(result).toEqual({ done: 0, total: 0 })
  })

  it('finds blogImage nodes nested inside other structures', () => {
    const body: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'blogImage', attrs: { status: 'done' } },
              ],
            },
          ],
        },
      ],
    }
    const result = imageStats(body, false)
    expect(result).toEqual({ done: 1, total: 1 })
  })
})

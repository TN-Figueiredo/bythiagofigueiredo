import { describe, it, expect } from 'vitest'
import { buildCmsSections } from '../../src/app/cms/(authed)/_shared/cms-sections'

const REDIRECTED_SOURCES = [
  '/cms/pipeline',
  '/cms/pipeline/video',
  '/cms/pipeline/course',
  '/cms/pipeline/research',
  '/cms/pipeline/reference',
  '/cms/pipeline/audio',
  '/cms/linktree',
]

const REWRITE_MAP: Record<string, string> = {
  '/cms/up-next': '/cms/pipeline',
  '/cms/video': '/cms/pipeline/video',
  '/cms/courses': '/cms/pipeline/course',
  '/cms/library/research': '/cms/pipeline/research',
  '/cms/library/reference': '/cms/pipeline/reference',
  '/cms/library/audio': '/cms/pipeline/audio',
  '/cms/link-in-bio': '/cms/linktree',
}

describe('URL migration guardrails', () => {
  const sections = buildCmsSections()
  const allHrefs = sections.flatMap(s => s.items.map(i => i.href))

  it('no nav href points to a redirected (old) URL', () => {
    for (const href of allHrefs) {
      for (const old of REDIRECTED_SOURCES) {
        expect(href, `nav href "${href}" matches redirected source "${old}"`).not.toBe(old)
      }
    }
  })

  it('every rewrite new-URL has a matching nav href', () => {
    const rewriteSources = Object.keys(REWRITE_MAP)
    for (const source of rewriteSources) {
      expect(allHrefs, `rewrite source "${source}" not found in nav`).toContain(source)
    }
  })

  it('redirect destinations and rewrite sources are the same set', () => {
    const redirectDestinations = [
      '/cms/up-next', '/cms/video', '/cms/courses',
      '/cms/library/research', '/cms/library/reference', '/cms/library/audio',
      '/cms/link-in-bio',
    ]
    const rewriteSources = Object.keys(REWRITE_MAP)
    expect(rewriteSources.sort()).toEqual(redirectDestinations.sort())
  })
})

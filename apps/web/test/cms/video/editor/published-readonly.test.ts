// apps/web/test/cms/video/editor/published-readonly.test.ts
import { describe, it, expect } from 'vitest'
import { isPublishedReadonlySection, isPublishedStage } from '@/lib/pipeline/services/items'

describe('published read-only section guard', () => {
  it('flags roteiro_/ideia_/publish_ section bases as read-only when published', () => {
    expect(isPublishedReadonlySection('ideia')).toBe(true)
    expect(isPublishedReadonlySection('roteiro')).toBe(true)
    expect(isPublishedReadonlySection('publish')).toBe(true)
    expect(isPublishedReadonlySection('postprod')).toBe(true)
  })
  it('isPublishedStage true at/after published position for video', () => {
    expect(isPublishedStage('video', 'published')).toBe(true)
    expect(isPublishedStage('video', 'scheduled')).toBe(false) // scheduled < published position
    expect(isPublishedStage('video', 'roteiro')).toBe(false)
  })
})

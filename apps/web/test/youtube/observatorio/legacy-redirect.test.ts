// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) } }))
import { legacyTabRedirect } from '@/app/cms/(authed)/youtube/competitors/_canais/legacy'
describe('legacy ?tab=', () => {
  it('maps tabs to routes', () => {
    expect(() => legacyTabRedirect('mudancas')).toThrow('REDIRECT /cms/youtube/competitors/mudancas')
    expect(() => legacyTabRedirect('outliers')).toThrow('REDIRECT /cms/youtube/competitors/outliers')
    expect(() => legacyTabRedirect('insights')).toThrow('REDIRECT /cms/youtube/competitors/insights')
    expect(legacyTabRedirect('canais')).toBeUndefined()
    expect(legacyTabRedirect(undefined)).toBeUndefined()
  })
})

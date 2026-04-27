import { describe, it, expect } from 'vitest'
import { MERGE_TAGS, MergeTagExtension } from '@/app/cms/(authed)/newsletters/_components/merge-tag-node'

describe('MergeTag extension', () => {
  it('exports exactly 7 available merge tags', () => {
    expect(MERGE_TAGS).toHaveLength(7)
  })

  it('includes all required tag values', () => {
    const values = MERGE_TAGS.map((t) => t.value)
    expect(values).toContain('subscriber.email')
    expect(values).toContain('subscriber.name')
    expect(values).toContain('edition.subject')
    expect(values).toContain('newsletter.name')
    expect(values).toContain('urls.unsubscribe')
    expect(values).toContain('urls.preferences')
    expect(values).toContain('urls.web_archive')
  })

  it('MergeTagExtension is named "mergeTag" and is an inline node', () => {
    expect(MergeTagExtension.name).toBe('mergeTag')
    expect(MergeTagExtension.type).toBe('node')
  })

  it('each tag has a human-readable label', () => {
    for (const tag of MERGE_TAGS) {
      expect(tag.label.length).toBeGreaterThan(3)
      expect(tag.label).not.toContain('{{')
    }
  })
})

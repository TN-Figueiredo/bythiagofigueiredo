import { describe, it, expect } from 'vitest'
import { composeGraph } from '@/lib/seo/jsonld/graph'

describe('composeGraph', () => {
  it('wraps nodes in @context + @graph', () => {
    const g = composeGraph([{ '@type': 'Person', '@id': 'x' }])
    expect(g['@context']).toBe('https://schema.org')
    expect(g['@graph']).toHaveLength(1)
  })

  it('dedupes by @id, richer node wins (more keys)', () => {
    const g = composeGraph([
      { '@type': 'Person', '@id': 'x', name: 'A' },
      { '@type': 'Person', '@id': 'x', name: 'A', jobTitle: 'Eng', sameAs: [] },
    ])
    expect(g['@graph']).toHaveLength(1)
    expect((g['@graph'][0] as any).jobTitle).toBe('Eng')
  })

  it('keeps nodes without @id as-is', () => {
    const g = composeGraph([
      { '@type': 'BreadcrumbList', itemListElement: [] },
      { '@type': 'BreadcrumbList', itemListElement: [{}] },
    ])
    expect(g['@graph']).toHaveLength(2)
  })
})

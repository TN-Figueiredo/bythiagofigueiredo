import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { JsonLdScript } from '@/lib/seo/jsonld/render'

describe('JsonLdScript', () => {
  it('renders SSR script with escaped JSON', () => {
    const html = renderToString(
      <JsonLdScript graph={{ '@context': 'https://schema.org', '@graph': [{ '@type': 'Person', name: '</script>' }] }} />
    )
    expect(html).toContain('type="application/ld+json"')
    // The user-controlled `</script>` payload must be escaped — only the
    // closing tag of the <script> element itself should appear in the HTML.
    // (The plan's original assertion `not.toContain('</script>')` was a typo:
    // every <script> element renders a closing </script>.)
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    expect(html).toContain('\\u003c/script')
  })

  it('returns null when flag disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_SEO_JSONLD_ENABLED', 'false')
    const html = renderToString(
      <JsonLdScript graph={{ '@context': 'https://schema.org', '@graph': [] }} />
    )
    expect(html).toBe('')
    vi.unstubAllEnvs()
  })
})

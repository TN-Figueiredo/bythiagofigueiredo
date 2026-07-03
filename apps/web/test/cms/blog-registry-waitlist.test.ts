import { describe, it, expect } from 'vitest'
import { blogRegistry } from '../../lib/cms/registry'
import { WaitlistEmbedInPost } from '../../src/components/waitlists/waitlist-embed-in-post'

describe('blogRegistry — waitlist component mapping', () => {
  it('maps the canonical <WaitlistForm slug="…" /> MDX tag to WaitlistEmbedInPost', () => {
    expect(blogRegistry.WaitlistForm).toBe(WaitlistEmbedInPost)
  })

  it('maps the editor-serialized lowercase <waitlistform> spelling to the same component', () => {
    // content_mdx = editor.getHTML(); HTML DOM serialization lower-cases tag names,
    // so the TipTap node arrives in MDX as <waitlistform slug="…"></waitlistform>.
    expect(blogRegistry.waitlistform).toBe(WaitlistEmbedInPost)
    expect(blogRegistry.waitlistform).toBe(blogRegistry.WaitlistForm)
  })
})

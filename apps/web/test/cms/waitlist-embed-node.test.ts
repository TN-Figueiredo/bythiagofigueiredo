import { describe, it, expect } from 'vitest'
import { generateHTML, generateJSON, type JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { compileMdx } from '@tn-figueiredo/cms'
import {
  WaitlistEmbedExtension,
  isValidWaitlistSlug,
} from '../../src/app/cms/(authed)/_shared/editor/waitlist-embed-node'

const extensions = [StarterKit, WaitlistEmbedExtension]

function docWith(slug: string): JSONContent {
  return {
    type: 'doc',
    content: [{ type: 'waitlistEmbed', attrs: { slug } }],
  }
}

describe('WaitlistEmbedExtension — node definition', () => {
  it('is a selectable atom block named waitlistEmbed', () => {
    expect(WaitlistEmbedExtension.name).toBe('waitlistEmbed')
    expect(WaitlistEmbedExtension.config.group).toBe('block')
    expect(WaitlistEmbedExtension.config.atom).toBe(true)
    expect(WaitlistEmbedExtension.config.draggable).toBe(true)
  })
})

describe('WaitlistEmbedExtension — MDX serialization', () => {
  // The blog editor persists content_mdx as editor.getHTML(), so the node's HTML
  // serialization IS its MDX form: the <WaitlistForm slug="…" /> component tag
  // (lower-cased to <waitlistform …></waitlistform> by HTML DOM serialization —
  // blogRegistry maps both spellings).
  it('serializes as the WaitlistForm component tag with the slug attribute', () => {
    const html = generateHTML(docWith('my-product'), extensions)
    expect(html.toLowerCase()).toContain('<waitlistform slug="my-product">')
    expect(html.toLowerCase()).toContain('</waitlistform>')
  })

  it('emits a balanced tag (MDX/JSX requires closed elements)', () => {
    const html = generateHTML(docWith('my-product'), extensions).toLowerCase()
    const opens = html.match(/<waitlistform/g) ?? []
    const closes = html.match(/<\/waitlistform>/g) ?? []
    expect(opens.length).toBe(1)
    expect(closes.length).toBe(1)
  })

  it('serialized output is valid MDX and references the waitlist component', async () => {
    // Full contract: content_mdx (= getHTML) must survive compileMdx — the fallback
    // compile path on the public blog page runs it verbatim.
    const html = generateHTML(docWith('my-product'), extensions)
    const compiled = await compileMdx(html, { WaitlistForm: () => null })
    expect(compiled.compiledSource).toContain('waitlistform')
    expect(compiled.compiledSource).toContain('my-product')
  })

  it('hand-authored canonical MDX <WaitlistForm slug="…" /> compiles too', async () => {
    const compiled = await compileMdx('<WaitlistForm slug="my-product" />', {
      WaitlistForm: () => null,
    })
    expect(compiled.compiledSource).toContain('WaitlistForm')
    expect(compiled.compiledSource).toContain('my-product')
  })

  it('round-trips the slug through serialize → parse', () => {
    const html = generateHTML(docWith('sprint-6-launch'), extensions)
    const json = generateJSON(html, extensions)
    expect(json.content?.[0]).toMatchObject({
      type: 'waitlistEmbed',
      attrs: { slug: 'sprint-6-launch' },
    })
  })

  it('round-trips a hostile slug without corrupting the document (DOM escapes attrs)', () => {
    // The editor UI blocks non-kebab slugs, but the schema must still be safe if one
    // arrives programmatically (paste / stored JSON).
    const hostile = 'a"b<c>'
    const html = generateHTML(docWith(hostile), extensions)
    const json = generateJSON(html, extensions)
    expect(json.content?.[0]?.attrs?.slug).toBe(hostile)
  })
})

describe('WaitlistEmbedExtension — parseHTML', () => {
  it('parses hand-authored <WaitlistForm slug="…"></WaitlistForm> markup', () => {
    const json = generateJSON('<WaitlistForm slug="my-product"></WaitlistForm>', extensions)
    expect(json.content?.[0]).toMatchObject({
      type: 'waitlistEmbed',
      attrs: { slug: 'my-product' },
    })
  })

  it('parses the div placeholder form (data-waitlist-embed + data-slug)', () => {
    const json = generateJSON(
      '<div data-waitlist-embed data-slug="my-product"></div>',
      extensions,
    )
    expect(json.content?.[0]).toMatchObject({
      type: 'waitlistEmbed',
      attrs: { slug: 'my-product' },
    })
  })

  it('defaults slug to empty string when the attribute is missing', () => {
    const json = generateJSON('<waitlistform></waitlistform>', extensions)
    expect(json.content?.[0]).toMatchObject({
      type: 'waitlistEmbed',
      attrs: { slug: '' },
    })
  })
})

describe('isValidWaitlistSlug', () => {
  it('accepts kebab-case slugs', () => {
    expect(isValidWaitlistSlug('my-product')).toBe(true)
    expect(isValidWaitlistSlug('sprint6')).toBe(true)
    expect(isValidWaitlistSlug('a-b-c-123')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(isValidWaitlistSlug('')).toBe(false)
  })

  it('rejects uppercase, spaces and special characters', () => {
    expect(isValidWaitlistSlug('My-Product')).toBe(false)
    expect(isValidWaitlistSlug('my product')).toBe(false)
    expect(isValidWaitlistSlug('slug"quote')).toBe(false)
    expect(isValidWaitlistSlug('<script>')).toBe(false)
    expect(isValidWaitlistSlug('a--b')).toBe(false)
    expect(isValidWaitlistSlug('-leading')).toBe(false)
    expect(isValidWaitlistSlug('trailing-')).toBe(false)
  })
})

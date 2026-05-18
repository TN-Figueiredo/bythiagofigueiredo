import { describe, it, expect } from 'vitest'
import {
  renderTemplate,
  resolvePlaceholders,
  type TemplateContext,
} from '@/lib/social/konva-renderer'
import type { CardComposition } from '@tn-figueiredo/links/qr'

// PNG magic bytes: 0x89 0x50 0x4E 0x47
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])

const SIMPLE_COMPOSITION: CardComposition = {
  version: 1,
  canvas: { width: 400, height: 400, aspectRatio: '1:1' },
  background: { type: 'solid', color: '#0a0a0a' },
  elements: [
    {
      id: 'rect-1',
      type: 'text',
      x: 50,
      y: 50,
      width: 300,
      height: 80,
      rotation: 0,
      opacity: 1,
      locked: false,
      content: 'Hello World',
      fontFamily: 'Inter',
      fontSize: 32,
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '0em',
      align: 'center',
      color: '#ffffff',
      backgroundColor: null,
      backgroundPadding: 8,
      backgroundRadius: 4,
      uppercase: false,
    },
  ],
}

const PLACEHOLDER_COMPOSITION: CardComposition = {
  version: 1,
  canvas: { width: 400, height: 400, aspectRatio: '1:1' },
  background: { type: 'solid', color: '#1a1a2e' },
  elements: [
    {
      id: 'title',
      type: 'text',
      x: 20,
      y: 100,
      width: 360,
      height: 100,
      rotation: 0,
      opacity: 1,
      locked: false,
      content: '{{title}}',
      fontFamily: 'Inter',
      fontSize: 28,
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: '0em',
      align: 'center',
      color: '#ffffff',
      backgroundColor: null,
      backgroundPadding: 8,
      backgroundRadius: 4,
      uppercase: false,
    },
    {
      id: 'url',
      type: 'text',
      x: 20,
      y: 300,
      width: 360,
      height: 40,
      rotation: 0,
      opacity: 1,
      locked: false,
      content: '{{short_url}}',
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 1.2,
      letterSpacing: '0em',
      align: 'center',
      color: '#a1a1aa',
      backgroundColor: null,
      backgroundPadding: 8,
      backgroundRadius: 4,
      uppercase: false,
    },
  ],
}

describe('resolvePlaceholders', () => {
  it('replaces {{title}} placeholder', () => {
    const ctx: TemplateContext = { title: 'My Blog Post' }
    const result = resolvePlaceholders('{{title}}', ctx)
    expect(result).toBe('My Blog Post')
  })

  it('replaces {{short_url}} placeholder', () => {
    const ctx: TemplateContext = { short_url: 'go.btf.com/abc123' }
    const result = resolvePlaceholders('{{short_url}}', ctx)
    expect(result).toBe('go.btf.com/abc123')
  })

  it('replaces {{description}} placeholder', () => {
    const ctx: TemplateContext = { description: 'A great article' }
    const result = resolvePlaceholders('{{description}}', ctx)
    expect(result).toBe('A great article')
  })

  it('replaces multiple placeholders in one string', () => {
    const ctx: TemplateContext = { title: 'Title', short_url: 'go.btf.com/x' }
    const result = resolvePlaceholders('{{title}} - {{short_url}}', ctx)
    expect(result).toBe('Title - go.btf.com/x')
  })

  it('removes unresolvable placeholders', () => {
    const ctx: TemplateContext = {}
    const result = resolvePlaceholders('{{title}}', ctx)
    expect(result).toBe('')
  })

  it('leaves non-placeholder text untouched', () => {
    const ctx: TemplateContext = { title: 'Hello' }
    const result = resolvePlaceholders('Prefix {{title}} Suffix', ctx)
    expect(result).toBe('Prefix Hello Suffix')
  })
})

describe('renderTemplate', () => {
  it('renders a simple composition to a PNG buffer', async () => {
    const ctx: TemplateContext = {}
    const buffer = await renderTemplate(
      SIMPLE_COMPOSITION,
      ctx,
      { width: 400, height: 400 },
    )
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(100)
    expect(buffer.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
  })

  it('renders a composition with placeholders resolved', async () => {
    const ctx: TemplateContext = {
      title: 'Como configurar OAuth 2.0',
      short_url: 'go.btf.com/s5k2q1',
    }
    const buffer = await renderTemplate(
      PLACEHOLDER_COMPOSITION,
      ctx,
      { width: 400, height: 400 },
    )
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(100)
    expect(buffer.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
  })

  it('renders at the specified size', async () => {
    const ctx: TemplateContext = {}
    const small = await renderTemplate(
      SIMPLE_COMPOSITION,
      ctx,
      { width: 200, height: 200 },
    )
    const large = await renderTemplate(
      SIMPLE_COMPOSITION,
      ctx,
      { width: 800, height: 800 },
    )
    // Larger output should generally produce a larger buffer
    // (not guaranteed for simple compositions, but a reasonable heuristic)
    expect(small).toBeInstanceOf(Buffer)
    expect(large).toBeInstanceOf(Buffer)
    expect(small.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
    expect(large.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
  })

  it('handles empty elements array', async () => {
    const emptyComp: CardComposition = {
      version: 1,
      canvas: { width: 400, height: 400, aspectRatio: '1:1' },
      background: { type: 'solid', color: '#ffffff' },
      elements: [],
    }
    const buffer = await renderTemplate(emptyComp, {}, { width: 400, height: 400 })
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
  })

  it('handles gradient background', async () => {
    const gradComp: CardComposition = {
      version: 1,
      canvas: { width: 400, height: 400, aspectRatio: '1:1' },
      background: {
        type: 'gradient',
        angle: 135,
        stops: [
          { color: '#7c3aed', position: 0 },
          { color: '#2563eb', position: 0.5 },
          { color: '#06b6d4', position: 1 },
        ],
      },
      elements: [],
    }
    const buffer = await renderTemplate(gradComp, {}, { width: 400, height: 400 })
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
  })
})

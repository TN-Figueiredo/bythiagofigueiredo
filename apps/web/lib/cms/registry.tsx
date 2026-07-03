import { defaultComponents, type ComponentRegistry } from '@tn-figueiredo/cms'
import { ShikiCodeBlock } from '@tn-figueiredo/cms/code'
import { LinkedH2, LinkedH3 } from '@tn-figueiredo/cms-reader/client'
import { WaitlistEmbedInPost } from '@/components/waitlists/waitlist-embed-in-post'
import type { ReactNode } from 'react'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function textContent(children: ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(textContent).join('')
  if (children && typeof children === 'object' && 'props' in children) {
    return textContent((children as { props: { children?: ReactNode } }).props.children)
  }
  return ''
}

function AutoIdH2({ id, children }: { id?: string; children?: ReactNode }) {
  const resolvedId = id || slugify(textContent(children))
  return <LinkedH2 id={resolvedId}>{children}</LinkedH2>
}

function AutoIdH3({ id, children }: { id?: string; children?: ReactNode }) {
  const resolvedId = id || slugify(textContent(children))
  return <LinkedH3 id={resolvedId}>{children}</LinkedH3>
}

export const blogRegistry: ComponentRegistry = {
  ...defaultComponents,
  CodeBlock: ShikiCodeBlock as ComponentRegistry[string],
  h2: AutoIdH2 as unknown as ComponentRegistry[string],
  h3: AutoIdH3 as unknown as ComponentRegistry[string],
  // Inline waitlist (design handoff Surface 3). `WaitlistForm` is the canonical
  // hand-authored MDX spelling — `<WaitlistForm slug="…" />`. `waitlistform` is the
  // same node after the TipTap editor serializes it (content_mdx = editor.getHTML();
  // HTML DOM serialization lower-cases tag names). Both map to the same component.
  WaitlistForm: WaitlistEmbedInPost as ComponentRegistry[string],
  waitlistform: WaitlistEmbedInPost as ComponentRegistry[string],
}

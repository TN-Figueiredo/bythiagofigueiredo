'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import { useState, useEffect, useCallback } from 'react'
import { Gift, ExternalLink, Trash2, Loader2 } from 'lucide-react'
import { z } from 'zod'

// The public status route returns { status, name, description } for open/closed/launched
// waitlists and 404 for drafts/unknown slugs (no existence oracle). Cross-boundary JSON
// is untrusted — Zod-parse instead of `as`-casting (same rule as the public form, WL-R6).
const StatusResponse = z
  .object({ status: z.string().optional(), name: z.string().optional() })
  .passthrough()

/** Slugs are lowercase kebab (DB convention). Guard editor input so the serialized
 *  `<WaitlistForm slug="…" />` MDX attribute can never carry quotes/angle brackets. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isValidWaitlistSlug(slug: string): boolean {
  return SLUG_RE.test(slug)
}

type WaitlistNodeStatus = 'loading' | 'open' | 'closed' | 'launched' | 'not-public'

const STATUS_LABEL: Record<Exclude<WaitlistNodeStatus, 'loading'>, string> = {
  open: 'open',
  closed: 'closed',
  launched: 'launched',
  'not-public': 'not public yet (draft or missing)',
}

function WaitlistEmbedNodeView({ node, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const slug = String(node.attrs.slug ?? '')
  const [editing, setEditing] = useState(!slug)
  const [slugInput, setSlugInput] = useState(slug)
  const [status, setStatus] = useState<WaitlistNodeStatus>('loading')
  const [name, setName] = useState<string | null>(null)

  // Light lookup so the node shows the waitlist name + lifecycle state. Public route:
  // 404 covers both "does not exist" and "still draft" — surfaced as a neutral hint,
  // never an error (the slug may simply not be live yet).
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setStatus('loading')
    setName(null)
    fetch(`/api/waitlists/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          setStatus('not-public')
          return
        }
        const parsed = StatusResponse.safeParse(await res.json())
        if (cancelled) return
        if (!parsed.success) {
          setStatus('not-public')
          return
        }
        const data = parsed.data
        if (data.name) setName(data.name)
        if (data.status === 'open' || data.status === 'closed' || data.status === 'launched') {
          setStatus(data.status)
        } else {
          setStatus('not-public')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('not-public')
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const handleCancel = useCallback(() => {
    if (!slug) {
      deleteNode()
    } else {
      setSlugInput(slug)
      setEditing(false)
    }
  }, [slug, deleteNode])

  function handleSave() {
    const trimmed = slugInput.trim().toLowerCase()
    if (!trimmed || !isValidWaitlistSlug(trimmed)) return
    updateAttributes({ slug: trimmed })
    setEditing(false)
  }

  if (editing) {
    const trimmed = slugInput.trim().toLowerCase()
    const invalid = trimmed.length > 0 && !isValidWaitlistSlug(trimmed)
    return (
      <NodeViewWrapper className="my-4">
        <div className="border border-[#1f2937] rounded-lg p-3 bg-[#111827]">
          <div className="flex items-center gap-2 mb-2">
            <Gift size={14} className="text-orange-400" />
            <span className="text-xs font-medium text-[#d1d5db]">Waitlist slug</span>
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 border border-[#1f2937] bg-[#0a0f1a] text-[#d1d5db] rounded-md px-2.5 py-1.5 text-sm outline-none focus:border-orange-500"
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') handleCancel()
              }}
              placeholder="my-product"
              aria-label="Waitlist slug"
              autoFocus
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!trimmed || invalid}
              className="px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Embed
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 text-[#6b7280] text-xs font-medium rounded-md hover:bg-white/5 hover:text-[#d1d5db]"
            >
              Cancel
            </button>
          </div>
          {invalid && (
            <p className="mt-1.5 text-[0.65rem] text-red-400">
              Lowercase letters, numbers and hyphens only (e.g. my-product)
            </p>
          )}
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="my-4" data-drag-handle>
      <div className="relative group rounded-lg overflow-hidden border border-orange-500/25 bg-orange-500/[0.06]">
        <div className="flex items-center justify-between px-3 py-2 bg-orange-500/10 border-b border-orange-500/20">
          <div className="flex items-center gap-2">
            <Gift size={14} className="text-orange-400" />
            <span className="text-xs font-bold text-orange-300">WAITLIST</span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => { setSlugInput(slug); setEditing(true) }}
              className="px-2 py-1 rounded text-[10px] font-medium text-[#6b7280] hover:bg-white/5 hover:text-[#d1d5db]"
              aria-label="Change waitlist slug"
            >
              Change
            </button>
            <a
              href={`/waitlists/${encodeURIComponent(slug)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:bg-white/5 text-[#6b7280] hover:text-[#d1d5db]"
              aria-label="Open public waitlist page"
            >
              <ExternalLink size={12} />
            </a>
            <button
              type="button"
              onClick={deleteNode}
              className="p-1 rounded hover:bg-red-500/10 text-[#6b7280] hover:text-[#f87171]"
              aria-label="Remove waitlist embed"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        <div className="px-3 py-2.5">
          <h4 className="text-sm font-semibold text-white">{name ?? slug}</h4>
          <p className="mt-0.5 flex items-center gap-1.5 text-[0.65rem] text-white/40">
            <span className="font-mono">{slug}</span>
            <span aria-hidden="true">·</span>
            {status === 'loading' ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 size={9} className="animate-spin" /> checking…
              </span>
            ) : (
              <span>{STATUS_LABEL[status]}</span>
            )}
          </p>
        </div>
      </div>
    </NodeViewWrapper>
  )
}

/**
 * Inline waitlist node (design handoff "Surface 3 — Inline node inside a blog post").
 *
 * MDX serialization: the blog editor persists `content_mdx` as `editor.getHTML()`
 * (see buildSavePayload in blog/[id]/edit/context.tsx), so this node's renderHTML
 * output IS its MDX form — the `<WaitlistForm slug="…" />` component tag from the
 * handoff. HTML DOM serialization lower-cases tag names, so on the wire it reads
 * `<waitlistform slug="…"></waitlistform>`; the public blogRegistry maps BOTH the
 * canonical `WaitlistForm` (hand-authored MDX) and the lowercase `waitlistform`
 * (editor-serialized) spellings to the same component.
 */
export const WaitlistEmbedExtension = Node.create({
  name: 'waitlistEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      slug: { default: '' },
    }
  },

  parseHTML() {
    return [
      // Round-trip of our own serialization (and of hand-authored MDX pasted as HTML).
      {
        tag: 'waitlistform',
        getAttrs: (el) => ({ slug: (el as HTMLElement).getAttribute('slug') ?? '' }),
      },
      // Defensive: div placeholder form (matches the public compile-json output shape).
      {
        tag: 'div[data-waitlist-embed]',
        getAttrs: (el) => ({ slug: (el as HTMLElement).getAttribute('data-slug') ?? '' }),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { slug } = HTMLAttributes
    return ['WaitlistForm', mergeAttributes({ slug })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(WaitlistEmbedNodeView)
  },
})

export { isValidWaitlistSlug }

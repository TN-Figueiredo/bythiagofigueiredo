'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Trash2, ExternalLink, ListMusic, Loader2, AlertCircle } from 'lucide-react'

interface PlaylistSummary {
  id: string
  name_pt: string
  name_en: string
  slug: string
  status: string
  category: string | null
  item_count: number
}

function PlaylistEmbedNodeView({ node, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const playlistId = String(node.attrs.playlistId ?? '')
  const cachedName = String(node.attrs.playlistName ?? '')
  const [picking, setPicking] = useState(!playlistId)
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const loadPlaylists = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/playlists', { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setPlaylists(json.data ?? [])
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError('Failed to load playlists')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (picking) loadPlaylists()
    return () => { abortRef.current?.abort() }
  }, [picking, loadPlaylists])

  function handleSelect(p: PlaylistSummary) {
    updateAttributes({
      playlistId: p.id,
      playlistName: p.name_en || p.name_pt,
      playlistSlug: p.slug,
      itemCount: p.item_count,
    })
    setPicking(false)
  }

  function handleCancel() {
    if (!playlistId) {
      deleteNode()
    } else {
      setPicking(false)
    }
  }

  const filtered = playlists.filter(p =>
    p.name_pt.toLowerCase().includes(search.toLowerCase()) ||
    p.name_en.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.includes(search.toLowerCase()),
  )

  if (picking) {
    return (
      <NodeViewWrapper className="my-4">
        <div className="border border-[#1f2937] rounded-lg p-3 bg-[#111827]">
          <div className="flex items-center gap-2 mb-2">
            <ListMusic size={14} className="text-indigo-400" />
            <span className="text-xs font-medium text-[#d1d5db]">Choose a playlist</span>
          </div>
          <input
            className="w-full border border-[#1f2937] bg-[#0a0f1a] text-[#d1d5db] rounded-md px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 mb-2"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search playlists…"
            autoFocus
            onKeyDown={e => { if (e.key === 'Escape') handleCancel() }}
          />
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={16} className="text-[#4b5563] animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-3">
              <div className="flex items-center gap-1.5 text-xs text-red-400">
                <AlertCircle size={12} />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={loadPlaylists}
                className="text-xs text-indigo-400 hover:text-indigo-300"
                aria-label="Retry loading playlists"
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-[#6b7280] py-2 text-center">No playlists found</p>
          ) : (
            <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
              {filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p)}
                  className="flex items-center justify-between w-full text-left px-2.5 py-2 rounded-md text-sm text-[#d1d5db] hover:bg-indigo-500/10 hover:text-[#818cf8] transition-colors"
                >
                  <span className="truncate">{p.name_en || p.name_pt}</span>
                  <span className="text-[0.65rem] text-[#6b7280] shrink-0 ml-2">
                    {p.item_count} items · {p.status}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 text-[#6b7280] text-xs font-medium rounded-md hover:bg-white/5 hover:text-[#d1d5db]"
            >
              Cancel
            </button>
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  const itemCount = Number(node.attrs.itemCount ?? 0)
  const displayName = cachedName || 'Untitled playlist'

  return (
    <NodeViewWrapper className="my-4">
      <div className="relative group rounded-lg overflow-hidden border border-indigo-500/25 bg-indigo-500/[0.06]">
        <div className="flex items-center justify-between px-3 py-2 bg-indigo-500/10 border-b border-indigo-500/20">
          <div className="flex items-center gap-2">
            <ListMusic size={14} className="text-indigo-400" />
            <span className="text-xs font-bold text-indigo-300">PLAYLIST</span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="px-2 py-1 rounded text-[10px] font-medium text-[#6b7280] hover:bg-white/5 hover:text-[#d1d5db]"
              aria-label="Change playlist"
            >
              Change
            </button>
            <a
              href={`/cms/playlists/${playlistId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:bg-white/5 text-[#6b7280] hover:text-[#d1d5db]"
              aria-label="Open playlist in editor"
            >
              <ExternalLink size={12} />
            </a>
            <button
              type="button"
              onClick={deleteNode}
              className="p-1 rounded hover:bg-red-500/10 text-[#6b7280] hover:text-[#f87171]"
              aria-label="Remove playlist embed"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        <div className="px-3 py-2.5">
          <h4 className="text-sm font-semibold text-white">{displayName}</h4>
          <p className="mt-0.5 text-[0.65rem] text-white/40">
            {itemCount} item{itemCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export const PlaylistEmbedExtension = Node.create({
  name: 'playlistEmbed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      playlistId: { default: '' },
      playlistName: { default: '' },
      playlistSlug: { default: '' },
      itemCount: { default: 0 },
    }
  },

  parseHTML() {
    return [{
      tag: 'div[data-playlist-embed]',
      getAttrs: (el) => {
        const div = el as HTMLElement
        return {
          playlistId: div.getAttribute('data-playlist-id') ?? '',
          playlistName: div.getAttribute('data-playlist-name') ?? '',
          playlistSlug: div.getAttribute('data-playlist-slug') ?? '',
          itemCount: parseInt(div.getAttribute('data-item-count') ?? '0', 10),
        }
      },
    }]
  },

  renderHTML({ HTMLAttributes }) {
    const { playlistId, playlistName, playlistSlug, itemCount } = HTMLAttributes
    return [
      'div',
      mergeAttributes({
        'data-playlist-embed': '',
        'data-playlist-id': playlistId,
        'data-playlist-name': playlistName,
        'data-playlist-slug': playlistSlug,
        'data-item-count': String(itemCount),
        class: 'playlist-embed',
      }),
      ['div', { class: 'playlist-embed__header' },
        ['span', { class: 'playlist-embed__badge' }, 'PLAYLIST'],
      ],
      ['div', { class: 'playlist-embed__body' },
        ['h4', {}, playlistName || 'Untitled'],
        ['p', {}, `${itemCount} items`],
      ],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(PlaylistEmbedNodeView)
  },
})

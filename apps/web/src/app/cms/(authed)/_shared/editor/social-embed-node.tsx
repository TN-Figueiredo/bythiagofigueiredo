'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import { useState, useCallback } from 'react'
import { ExternalLink, Pencil, Loader2, Trash2 } from 'lucide-react'

type EmbedProvider = 'youtube' | 'twitter' | 'instagram' | 'codesandbox' | 'codepen' | 'github' | 'vimeo' | 'loom' | 'spotify' | 'soundcloud' | 'figma' | 'pdf'

const PROVIDER_META: Record<EmbedProvider, { label: string; color: string; placeholder: string }> = {
  youtube: { label: 'YouTube', color: '#ff0000', placeholder: 'https://youtube.com/watch?v=dQw4w9WgXcQ' },
  twitter: { label: 'Twitter / X', color: '#1d9bf0', placeholder: 'https://x.com/user/status/123...' },
  instagram: { label: 'Instagram', color: '#e1306c', placeholder: 'https://instagram.com/p/ABC123/' },
  codesandbox: { label: 'CodeSandbox', color: '#3b82f6', placeholder: 'https://codesandbox.io/s/my-sandbox' },
  codepen: { label: 'CodePen', color: '#47cf73', placeholder: 'https://codepen.io/user/pen/abcdef' },
  github: { label: 'GitHub Gist', color: '#8b949e', placeholder: 'https://gist.github.com/user/abc123' },
  vimeo: { label: 'Vimeo', color: '#1ab7ea', placeholder: 'https://vimeo.com/123456789' },
  loom: { label: 'Loom', color: '#625df5', placeholder: 'https://www.loom.com/share/abc123' },
  spotify: { label: 'Spotify', color: '#1db954', placeholder: 'https://open.spotify.com/track/abc123' },
  soundcloud: { label: 'SoundCloud', color: '#ff5500', placeholder: 'https://soundcloud.com/artist/track' },
  figma: { label: 'Figma', color: '#f24e1e', placeholder: 'https://www.figma.com/file/abc123/my-design' },
  pdf: { label: 'PDF', color: '#ff0000', placeholder: 'https://example.com/document.pdf' },
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?.*v=([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m?.[1]) return m[1]
  }
  return null
}

function extractTweetId(url: string): string | null {
  const m = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/)
  return m?.[1] ?? null
}

function extractInstagramCode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)
  return m?.[1] ?? null
}

function extractCodeSandboxId(url: string): string | null {
  const m = url.match(/codesandbox\.io\/(?:s|p\/sandbox|p\/devbox)\/([A-Za-z0-9_-]+)/)
  return m?.[1] ?? null
}

function extractCodePenPath(url: string): string | null {
  const m = url.match(/codepen\.io\/([A-Za-z0-9_-]+)\/(?:pen|full|details)\/([A-Za-z0-9]+)/)
  if (!m) return null
  return `${m[1]}/embed/${m[2]}`
}

function extractGistId(url: string): string | null {
  const m = url.match(/gist\.github\.com\/([A-Za-z0-9_-]+)\/([a-f0-9]+)/)
  if (!m) return null
  return `${m[1]}/${m[2]}`
}

function extractVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return m?.[1] ?? null
}

function extractLoomId(url: string): string | null {
  const m = url.match(/loom\.com\/share\/([A-Za-z0-9]+)/)
  return m?.[1] ?? null
}

function extractSpotifyPath(url: string): string | null {
  const m = url.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/)
  if (!m) return null
  return `${m[1]}/${m[2]}`
}

function extractSoundCloudUrl(url: string): string {
  return encodeURIComponent(url)
}

function extractFigmaUrl(url: string): string {
  return encodeURIComponent(url)
}

function getEmbedSrc(provider: EmbedProvider, url: string): string | null {
  switch (provider) {
    case 'youtube': {
      const id = extractYouTubeId(url)
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    case 'twitter': {
      const id = extractTweetId(url)
      return id ? `https://platform.twitter.com/embed/Tweet.html?id=${id}&theme=dark` : null
    }
    case 'instagram': {
      const code = extractInstagramCode(url)
      return code ? `https://www.instagram.com/p/${code}/embed/` : null
    }
    case 'codesandbox': {
      const id = extractCodeSandboxId(url)
      return id ? `https://codesandbox.io/embed/${id}?fontsize=14&theme=dark` : null
    }
    case 'codepen': {
      const path = extractCodePenPath(url)
      return path ? `https://codepen.io/${path}?default-tab=result&theme-id=dark` : null
    }
    case 'github': {
      const id = extractGistId(url)
      return id ? `https://gist.github.com/${id}.js` : null
    }
    case 'vimeo': {
      const id = extractVimeoId(url)
      return id ? `https://player.vimeo.com/video/${id}` : null
    }
    case 'loom': {
      const id = extractLoomId(url)
      return id ? `https://www.loom.com/embed/${id}` : null
    }
    case 'spotify': {
      const path = extractSpotifyPath(url)
      return path ? `https://open.spotify.com/embed/${path}` : null
    }
    case 'soundcloud': {
      const encoded = extractSoundCloudUrl(url)
      return `https://w.soundcloud.com/player/?url=${encoded}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`
    }
    case 'figma': {
      const encoded = extractFigmaUrl(url)
      return `https://www.figma.com/embed?embed_host=share&url=${encoded}`
    }
    case 'pdf': {
      return url
    }
  }
}

function detectProvider(url: string): EmbedProvider | null {
  if (/youtube\.com\/|youtu\.be\//.test(url)) return 'youtube'
  if (/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/.test(url)) return 'twitter'
  if (/instagram\.com\/(?:p|reel|tv)\//.test(url)) return 'instagram'
  if (/codesandbox\.io\//.test(url)) return 'codesandbox'
  if (/codepen\.io\//.test(url)) return 'codepen'
  if (/gist\.github\.com\//.test(url)) return 'github'
  if (url.includes('vimeo.com/')) return 'vimeo'
  if (url.includes('loom.com/share/')) return 'loom'
  if (url.includes('open.spotify.com/')) return 'spotify'
  if (url.includes('soundcloud.com/')) return 'soundcloud'
  if (url.includes('figma.com/')) return 'figma'
  if (url.endsWith('.pdf')) return 'pdf'
  return null
}

const EMBED_HEIGHTS: Record<EmbedProvider, string> = {
  youtube: '400px',
  twitter: '350px',
  instagram: '480px',
  codesandbox: '500px',
  codepen: '400px',
  github: '320px',
  vimeo: '400px',
  loom: '400px',
  spotify: '152px',
  soundcloud: '166px',
  figma: '450px',
  pdf: '600px',
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const GIST_SRC_RE = /^https:\/\/gist\.github\.com\/[A-Za-z0-9_-]+\/[a-f0-9]+\.js$/

function GistEmbed({ src, onLoad }: { src: string; onLoad?: () => void }) {
  if (!GIST_SRC_RE.test(src)) return null
  const safeSrc = escapeHtmlAttr(src)
  const iframeDoc = `
    <html><head><style>
      body{margin:0;background:#0d1117;overflow:hidden}
      .gist .gist-file{border:0!important;margin:0!important}
      .gist .gist-data{background:#0d1117!important;border:0!important;color:#c9d1d9!important}
      .gist .blob-code{background:#0d1117!important;color:#c9d1d9!important;font-size:13px!important}
      .gist .blob-num{background:#0d1117!important;color:#484f58!important}
      .gist .gist-meta{background:#161b22!important;color:#8b949e!important;border-top:1px solid #21262d!important}
      .gist .gist-meta a{color:#58a6ff!important}
    </style></head><body>
    <script src="${safeSrc}"></script>
    </body></html>
  `.trim()
  return (
    <iframe
      srcDoc={iframeDoc}
      className="w-full border-0 bg-[#0d1117]"
      style={{ height: EMBED_HEIGHTS.github }}
      loading="lazy"
      onLoad={onLoad}
      sandbox="allow-scripts allow-same-origin"
      title="GitHub Gist embed"
    />
  )
}

function SocialEmbedNodeView({ node, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const [editing, setEditing] = useState(!node.attrs.url)
  const [urlInput, setUrlInput] = useState(node.attrs.url as string)
  const [loading, setLoading] = useState(true)
  const provider = node.attrs.provider as EmbedProvider
  const url = node.attrs.url as string
  const meta = PROVIDER_META[provider]
  const embedSrc = url ? getEmbedSrc(provider, url) : null

  const handleCancel = useCallback(() => {
    if (!url) {
      deleteNode()
    } else {
      setUrlInput(url)
      setEditing(false)
    }
  }, [url, deleteNode])

  function handleSave() {
    const trimmed = urlInput.trim()
    if (!trimmed) return
    const detected = detectProvider(trimmed)
    if (detected && detected !== provider) {
      updateAttributes({ url: trimmed, provider: detected })
    } else {
      updateAttributes({ url: trimmed })
    }
    setLoading(true)
    setEditing(false)
  }

  if (editing) {
    return (
      <NodeViewWrapper className="my-4">
        <div className="border border-[#1f2937] rounded-lg p-3 bg-[#111827]">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: meta.color }}
            />
            <span className="text-xs font-medium text-[#d1d5db]">{meta.label}</span>
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 border border-[#1f2937] bg-[#0a0f1a] text-[#d1d5db] rounded-md px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') handleCancel()
              }}
              placeholder={meta.placeholder}
              aria-label={`${meta.label} URL`}
              autoFocus
            />
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700"
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
        </div>
      </NodeViewWrapper>
    )
  }

  const isGist = provider === 'github'

  return (
    <NodeViewWrapper className="my-4">
      <div className="relative group rounded-lg overflow-hidden border border-[#1f2937]">
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#111827] border-b border-[#1f2937]">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: meta.color }}
            />
            <span className="text-[10px] font-medium text-[#6b7280]">{meta.label}</span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => { setUrlInput(url); setEditing(true) }}
              className="p-1 rounded hover:bg-white/5 text-[#6b7280] hover:text-[#d1d5db] transition-colors"
              title="Edit URL"
            >
              <Pencil size={12} />
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:bg-white/5 text-[#6b7280] hover:text-[#d1d5db] transition-colors"
              title="Open in new tab"
            >
              <ExternalLink size={12} />
            </a>
            <button
              type="button"
              onClick={deleteNode}
              className="p-1 rounded hover:bg-red-500/10 text-[#6b7280] hover:text-[#f87171] transition-colors"
              title="Remove embed"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        {embedSrc ? (
          <div className="relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#030712] z-10">
                <Loader2 size={20} className="text-[#4b5563] animate-spin" />
              </div>
            )}
            {isGist ? (
              <GistEmbed src={embedSrc} onLoad={() => setLoading(false)} />
            ) : (
              <iframe
                src={embedSrc}
                className="w-full border-0 bg-[#030712]"
                style={{ height: EMBED_HEIGHTS[provider] }}
                loading="lazy"
                onLoad={() => setLoading(false)}
                sandbox="allow-scripts allow-same-origin allow-popups"
                title={`${meta.label} embed`}
              />
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 bg-[#0a0f1a] text-[#6b7280] text-sm">
            Invalid {meta.label} URL
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export const SocialEmbedExtension = Node.create({
  name: 'socialEmbed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      provider: { default: 'youtube' },
      url: { default: '' },
    }
  },

  parseHTML() {
    return [{
      tag: 'div[data-social-embed]',
      getAttrs: (el) => {
        const div = el as HTMLElement
        return {
          provider: div.getAttribute('data-provider') ?? 'youtube',
          url: div.getAttribute('data-url') ?? '',
        }
      },
    }]
  },

  renderHTML({ HTMLAttributes }) {
    const { provider, url } = HTMLAttributes
    const embedSrc = getEmbedSrc(provider, url)
    const height = EMBED_HEIGHTS[provider as EmbedProvider] ?? '400px'

    if (!embedSrc) {
      return [
        'div',
        mergeAttributes({
          'data-social-embed': '',
          'data-provider': provider,
          'data-url': url,
          class: 'social-embed',
        }),
        ['a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, url],
      ]
    }

    if (provider === 'github') {
      return [
        'div',
        mergeAttributes({
          'data-social-embed': '',
          'data-provider': provider,
          'data-url': url,
          class: 'social-embed social-embed--github',
        }),
        ['a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: 'social-embed__link' }, `GitHub Gist: ${url}`],
      ]
    }

    return [
      'div',
      mergeAttributes({
        'data-social-embed': '',
        'data-provider': provider,
        'data-url': url,
        class: 'social-embed',
      }),
      ['iframe', {
        src: embedSrc,
        style: `width:100%;height:${height};border:0`,
        loading: 'lazy',
        sandbox: 'allow-scripts allow-same-origin allow-popups',
        title: `${PROVIDER_META[provider as EmbedProvider]?.label ?? provider} embed`,
      }],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SocialEmbedNodeView)
  },
})

export { detectProvider, PROVIDER_META, getEmbedSrc, extractYouTubeId, extractTweetId, extractInstagramCode, extractCodeSandboxId, extractCodePenPath, extractGistId, extractVimeoId, extractLoomId, extractSpotifyPath, extractSoundCloudUrl, extractFigmaUrl, escapeHtmlAttr, GIST_SRC_RE }
export type { EmbedProvider }

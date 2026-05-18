'use client'

import { useRef, useCallback, useEffect } from 'react'
import {
  resolveCaption,
  resolvedLength,
  PLATFORM_CAPTION_DEFAULTS,
  type CaptionContext,
} from '@/lib/social/caption-variables'

// ---------------------------------------------------------------------------
// Variable highlighting regex — only known variables
// ---------------------------------------------------------------------------

const VARIABLE_REGEX = /\{\{(link|title|url)\}\}/g

// Re-export for callers that import from this module
export { PLATFORM_CAPTION_DEFAULTS }

// ---------------------------------------------------------------------------
// Char count color (90% = amber, 100% = red)
// ---------------------------------------------------------------------------

function getCountColor(current: number, limit: number): string {
  if (current > limit) return 'text-red-400'
  if (current > limit * 0.9) return 'text-amber-400'
  return 'text-cms-text-muted'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CaptionVariableTextareaProps {
  value: string
  onChange: (value: string) => void
  platform: string
  charLimit: number
  contentTitle: string
  contentUrl: string
  shortDomain: string
  placeholder?: string
}

export function CaptionVariableTextarea({
  value,
  onChange,
  platform,
  charLimit,
  contentTitle,
  contentUrl,
  shortDomain,
  placeholder,
}: CaptionVariableTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Sync scroll between textarea and overlay
  const handleScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.addEventListener('scroll', handleScroll)
    return () => textarea.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Build overlay content with highlighted spans
  const overlayContent = buildOverlayContent(value)

  // Resolved preview — uses imported resolveCaption / resolvedLength from caption-variables.ts
  const captionCtx: CaptionContext = {
    link: `${shortDomain}/______`,
    title: contentTitle,
    url: contentUrl,
  }
  const resolvedText = resolveCaption(value, captionCtx)
  const charCount = resolvedLength(value, captionCtx)

  // Soft validation: no {{link}}
  const hasLink = /\{\{link\}\}/.test(value)

  function handleInsertLink() {
    const suffix = value.length > 0 ? '\n\n{{link}}' : '{{link}}'
    onChange(value + suffix)
  }

  return (
    <div className="space-y-2">
      {/* Textarea with overlay */}
      <div className="relative">
        {/* Overlay (behind textarea, renders highlights) */}
        <div
          ref={overlayRef}
          data-testid="variable-overlay"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden whitespace-pre-wrap break-words rounded-md border border-transparent p-3 font-mono text-[13px] leading-relaxed"
          style={{ wordBreak: 'break-word' }}
        >
          {overlayContent}
        </div>

        {/* Actual textarea (transparent bg, on top) */}
        <textarea
          ref={textareaRef}
          role="textbox"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? `Escreva uma mensagem para o ${platform}...`}
          className="relative z-10 min-h-[120px] w-full resize-y rounded-md border border-cms-border bg-transparent p-3 font-mono text-[13px] leading-relaxed text-cms-text placeholder:text-cms-text-muted"
        />
      </div>

      {/* Resolved Preview Panel */}
      <div className="rounded-md border border-cms-border bg-cms-bg/50 p-3">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-cms-text-muted">
          Preview
        </p>
        <p
          data-testid="resolved-preview"
          className="whitespace-pre-wrap font-mono text-xs text-cms-text"
        >
          {resolvedText || (
            <span className="italic text-cms-text-muted">Empty</span>
          )}
        </p>
        <div className="mt-2 flex items-center justify-between">
          {/* Soft validation: no link warning */}
          {!hasLink && value.length > 0 && (
            <div
              data-testid="no-link-warning"
              className="flex items-center gap-1.5 text-yellow-500"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <span className="text-[11px]">No link in caption</span>
              <button
                type="button"
                onClick={handleInsertLink}
                className="ml-1 rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-400 hover:bg-yellow-500/20"
              >
                {'Add {{link}}'}
              </button>
            </div>
          )}

          {/* Character count (resolved length) */}
          <span
            data-testid="resolved-char-count"
            className={`ml-auto text-xs ${getCountColor(charCount, charLimit)}`}
          >
            {charCount}/{charLimit}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overlay content builder
// ---------------------------------------------------------------------------

function buildOverlayContent(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  const regex = new RegExp(VARIABLE_REGEX.source, 'g')
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Text before the match (invisible for spacing)
    if (match.index > lastIndex) {
      nodes.push(
        <span key={`t-${lastIndex}`} className="text-transparent">
          {text.slice(lastIndex, match.index)}
        </span>,
      )
    }

    // Highlighted variable
    nodes.push(
      <span
        key={`v-${match.index}`}
        data-variable={match[1]}
        className="rounded bg-blue-900/40 px-0.5 text-transparent"
      >
        {match[0]}
      </span>,
    )

    lastIndex = regex.lastIndex
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push(
      <span key={`t-${lastIndex}`} className="text-transparent">
        {text.slice(lastIndex)}
      </span>,
    )
  }

  return nodes
}

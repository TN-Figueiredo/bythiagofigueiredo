'use client'

import { PLATFORM_LIMITS, type Provider } from '@tn-figueiredo/social'
import type { SocialStrings } from '../../_i18n/types'

interface ComposerEditorProps {
  content: string
  url: string
  hashtags: string[]
  selectedPlatforms: Provider[]
  onContentChange: (v: string) => void
  onUrlChange: (v: string) => void
  onHashtagsChange: (v: string[]) => void
  strings: SocialStrings
}

export function ComposerEditor({
  content,
  url,
  hashtags,
  selectedPlatforms,
  onContentChange,
  onUrlChange,
  onHashtagsChange,
  strings: t,
}: ComposerEditorProps) {
  const minLimit = selectedPlatforms.reduce((min, p) => {
    const limit =
      p === 'youtube'
        ? Infinity
        : p === 'facebook'
          ? PLATFORM_LIMITS.facebook.text
          : p === 'instagram'
            ? PLATFORM_LIMITS.instagram.caption
            : PLATFORM_LIMITS.bluesky.text
    return Math.min(min, limit)
  }, Infinity)

  const charWarning = minLimit !== Infinity && content.length > minLimit

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-cms-text">
          {t.composer.editor.contentLabel}
        </label>
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder={t.composer.editor.contentPlaceholder}
          rows={6}
          className={`mt-1 w-full rounded-md border bg-cms-bg px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim ${charWarning ? 'border-red-500' : 'border-cms-border'}`}
        />
        {minLimit !== Infinity && (
          <p
            className={`mt-1 text-xs ${charWarning ? 'text-red-400' : 'text-cms-text-dim'}`}
          >
            {content.length} / {minLimit}
          </p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-cms-text">
          {t.composer.editor.urlLabel}
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder={t.composer.editor.urlPlaceholder}
          className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-cms-text">
          {t.composer.editor.hashtagsLabel}
        </label>
        <input
          type="text"
          placeholder={t.composer.editor.hashtagsPlaceholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              const val = (e.target as HTMLInputElement).value
                .trim()
                .replace(/^#/, '')
              if (val) {
                onHashtagsChange([...hashtags, `#${val}`])
                ;(e.target as HTMLInputElement).value = ''
              }
            }
          }}
          className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim"
        />
        {hashtags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {hashtags.map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-cms-accent/10 px-2 py-0.5 text-xs text-cms-accent"
              >
                {tag}
                <button
                  type="button"
                  onClick={() =>
                    onHashtagsChange(hashtags.filter((_, j) => j !== i))
                  }
                  className="hover:text-red-400"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

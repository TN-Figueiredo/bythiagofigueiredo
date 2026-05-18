'use client'

import { useState, useCallback } from 'react'
import { CaptionVariableTextarea } from './caption-variable-textarea'

type Platform = string
type Locale = 'pt' | 'en'

interface CaptionTabsProps {
  captions: Record<string, Record<string, string>>
  onChange: (captions: Record<string, Record<string, string>>) => void
  platforms: Platform[]
  autoFilled?: boolean
  contentTitle?: string
  contentUrl?: string
  shortDomain?: string
}

const CHAR_LIMITS: Record<string, number> = {
  facebook: 63_206,
  instagram: 2_200,
  bluesky: 300,
}

const WARN_THRESHOLDS: Record<string, number> = {
  facebook: 60_000,
  instagram: 1_800,
  bluesky: 250,
}

function getCharCountColor(
  platform: string,
  length: number,
): string {
  const limit = CHAR_LIMITS[platform] ?? 63_206
  const warn = WARN_THRESHOLDS[platform] ?? limit * 0.9

  if (length > limit) return 'text-red-400'
  if (length > warn) return 'text-amber-400'
  return 'text-cms-text-muted'
}

export function CaptionTabs({
  captions,
  onChange,
  platforms,
  autoFilled = false,
  contentTitle,
  contentUrl,
  shortDomain,
}: CaptionTabsProps) {
  const [activePlatform, setActivePlatform] = useState<Platform>(
    platforms[0] ?? 'facebook',
  )
  const [activeLang, setActiveLang] = useState<Locale>('pt')
  const [hasEdited, setHasEdited] = useState(false)

  const currentCaption =
    captions[activePlatform]?.[activeLang] ?? ''
  const charLimit = CHAR_LIMITS[activePlatform] ?? 63_206

  const handleChange = useCallback(
    (value: string) => {
      setHasEdited(true)
      const updated = {
        ...captions,
        [activePlatform]: {
          ...(captions[activePlatform] ?? {}),
          [activeLang]: value,
        },
      }
      onChange(updated)
    },
    [captions, activePlatform, activeLang, onChange],
  )

  const showAutoFill = autoFilled && !hasEdited

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface">
      {/* Platform tabs */}
      <div className="flex items-center border-b border-cms-border" role="tablist">
        {platforms.map((p) => {
          const captionLength =
            (captions[p]?.[activeLang] ?? '').length
          const limit = CHAR_LIMITS[p] ?? 63_206

          return (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={activePlatform === p}
              aria-label={p}
              onClick={() => setActivePlatform(p)}
              className={`px-4 py-2 text-sm font-medium capitalize ${
                activePlatform === p
                  ? 'border-b-2 border-cms-accent text-cms-accent'
                  : 'text-cms-text-muted hover:text-cms-text'
              }`}
            >
              {p}
              <span className="ml-1.5 text-xs text-cms-text-muted">
                {captionLength}/{limit}
              </span>
            </button>
          )
        })}

        {/* Language toggle */}
        <div className="ml-auto flex items-center gap-1 pr-3">
          {(['PT', 'EN'] as const).map((lang) => {
            const langKey = lang.toLowerCase() as Locale
            return (
              <button
                key={lang}
                type="button"
                onClick={() => setActiveLang(langKey)}
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  activeLang === langKey
                    ? 'bg-cms-accent/15 text-cms-accent'
                    : 'text-cms-text-muted hover:text-cms-text'
                }`}
              >
                {lang}
              </button>
            )
          })}
        </div>
      </div>

      {/* Caption editor */}
      <div className="p-3">
        {showAutoFill && (
          <span className="mb-2 inline-block rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400">
            Auto-preenchido
          </span>
        )}

        {contentTitle != null ? (
          <CaptionVariableTextarea
            value={currentCaption}
            onChange={handleChange}
            platform={activePlatform}
            charLimit={charLimit}
            contentTitle={contentTitle}
            contentUrl={contentUrl ?? ''}
            shortDomain={shortDomain ?? 'go.btf.com'}
            placeholder={`Escreva uma mensagem para o ${activePlatform}...`}
          />
        ) : (
          <>
            <textarea
              role="textbox"
              value={currentCaption}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={`Escreva uma mensagem para o ${activePlatform}...`}
              className="min-h-[120px] w-full resize-y rounded-md border border-cms-border bg-cms-bg p-3 font-mono text-[13px] leading-relaxed text-cms-text placeholder:text-cms-text-muted"
              maxLength={charLimit}
            />

            <div className="mt-1 flex items-center justify-end">
              <span
                data-testid="char-count"
                className={`text-xs ${getCharCountColor(activePlatform, currentCaption.length)}`}
              >
                {currentCaption.length}/{charLimit}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

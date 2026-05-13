import type { SocialStrings } from '../../_i18n/types'

interface DraftReviewBannerProps {
  source: string
  createdAt: string
  strings: SocialStrings
}

export function DraftReviewBanner({ source, createdAt, strings: t }: DraftReviewBannerProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
      <span className="text-yellow-400 text-lg">&#9888;</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-yellow-300">{t.composer.draftReview.banner}</p>
        <p className="text-xs text-yellow-400/70">
          {t.composer.draftReview.source.replace('{source}', source)} · {new Date(createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  )
}

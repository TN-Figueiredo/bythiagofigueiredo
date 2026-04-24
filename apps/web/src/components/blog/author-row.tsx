import type { AuthorData, EngagementStats } from './types'
import { ShareButtons } from './share-buttons'

type Props = {
  author: AuthorData
  engagement: EngagementStats
  locale: string
  url: string
}

export function AuthorRow({ author, engagement, locale, url }: Props) {
  const formattedViews = engagement.views.toLocaleString(locale === 'pt-BR' ? 'pt-BR' : 'en')

  return (
    <div className="flex items-center gap-4 mb-8 flex-wrap">
      <div
        className="w-10 h-10 rounded-full bg-pb-accent flex items-center justify-center font-bold text-sm shrink-0"
        style={{ color: 'var(--pb-bg)' }}
      >
        {author.initials}
      </div>
      <div>
        <div className="text-sm text-pb-ink">
          por <span className="underline underline-offset-2">{author.name}</span>
        </div>
        <div className="font-jetbrains text-xs text-pb-muted">{author.role}</div>
      </div>
      <div className="flex items-center gap-4 ml-auto text-[13px] text-pb-muted">
        <span>👁 {formattedViews} leituras</span>
        <span>♡ {engagement.likes}</span>
        <button aria-label="Salvar artigo" className="bg-transparent border-none p-0 text-[13px] text-pb-muted cursor-pointer">🔖 SALVAR</button>
      </div>
      <ShareButtons url={url} compact />
    </div>
  )
}

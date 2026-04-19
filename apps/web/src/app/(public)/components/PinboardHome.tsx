import { cookies } from 'next/headers'
import { PinboardHeader } from './PinboardHeader'
import { DualHero } from './DualHero'
import { ChannelStrip } from './ChannelStrip'
import { UnifiedFeed } from './UnifiedFeed'
import { NewsletterInline } from './NewsletterInline'
import { PinboardFooter } from './PinboardFooter'
import { getFeaturedPost, getLatestPosts, getNewslettersForLocale } from '../../../../lib/home/queries'
import { SAMPLE_VIDEOS } from '../../../../lib/home/videos-data'
// Static imports — statically analyzable, avoids dynamic import edge cases in Next.js build
import enStrings from '../../../locales/en.json'
import ptBrStrings from '../../../locales/pt-BR.json'

const TRANSLATIONS: Record<'en' | 'pt-BR', Record<string, string>> = {
  en: enStrings as Record<string, string>,
  'pt-BR': ptBrStrings as Record<string, string>,
}

type Props = { locale: 'en' | 'pt-BR' }

export async function PinboardHome({ locale }: Props) {
  const cookieStore = await cookies()
  const theme = cookieStore.get('btf_theme')?.value === 'light' ? 'light' : 'dark'
  const isDark = theme === 'dark'
  const t = TRANSLATIONS[locale]

  // Fetch 9 posts: after filtering out the featured one we still have up to 8 for the feed
  const [featuredPost, latestPosts, newsletters] = await Promise.all([
    getFeaturedPost(locale),
    getLatestPosts(locale, 9),
    getNewslettersForLocale(locale),
  ])

  const localeVideos = SAMPLE_VIDEOS.filter(v => v.locale === locale)
  const featuredVideo = localeVideos[0] ?? null
  const primaryNewsletter = newsletters[0]

  // Posts for the feed (exclude the featured one to avoid duplication)
  const feedPosts = latestPosts.filter(p => p.id !== featuredPost?.id).slice(0, 6)

  return (
    <div className="min-h-screen" style={{ background: 'var(--pb-bg)', color: 'var(--pb-ink)' }}>
      {/* Skip to content */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-pb-accent text-white px-4 py-2 rounded z-50">
        {locale === 'pt-BR' ? 'Ir para o conteúdo' : 'Skip to content'}
      </a>

      <PinboardHeader locale={locale} currentTheme={theme} t={t} />

      <main id="main-content">
        <div className="pb-section"><DualHero post={featuredPost} video={featuredVideo} locale={locale} t={t} isDark={isDark} /></div>
        <div className="pb-section"><ChannelStrip locale={locale} t={t} /></div>
        <div className="pb-section"><UnifiedFeed posts={feedPosts} videos={localeVideos.slice(1)} locale={locale} t={t} isDark={isDark} /></div>
        {primaryNewsletter && (
          <div className="pb-section"><NewsletterInline locale={locale} primaryNewsletter={primaryNewsletter} t={t} /></div>
        )}
      </main>

      <PinboardFooter locale={locale} t={t} />
    </div>
  )
}

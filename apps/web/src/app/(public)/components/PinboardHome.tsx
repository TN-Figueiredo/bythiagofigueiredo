import { cookies } from 'next/headers'
import { DualHero } from './DualHero'
import { ChannelStrip } from './ChannelStrip'
import { UnifiedFeed } from './UnifiedFeed'
import { NewsletterInline } from './NewsletterInline'
import { getFeaturedPost, getLatestPosts, getNewslettersForLocale } from '../../../../lib/home/queries'
import { SAMPLE_VIDEOS } from '../../../../lib/home/videos-data'
import enStrings from '../../../locales/en.json'
import ptBrStrings from '../../../locales/pt-BR.json'

const TRANSLATIONS: Record<'en' | 'pt-BR', Record<string, string>> = {
  en: enStrings as unknown as Record<string, string>,
  'pt-BR': ptBrStrings as unknown as Record<string, string>,
}

type Props = { locale: 'en' | 'pt-BR' }

export async function PinboardHome({ locale }: Props) {
  const cookieStore = await cookies()
  const isDark = cookieStore.get('btf_theme')?.value !== 'light'
  const t = TRANSLATIONS[locale]

  const [featuredPost, latestPosts, newsletters] = await Promise.all([
    getFeaturedPost(locale),
    getLatestPosts(locale, 9),
    getNewslettersForLocale(locale),
  ])

  const localeVideos = SAMPLE_VIDEOS.filter(v => v.locale === locale)
  const featuredVideo = localeVideos[0] ?? null
  const primaryNewsletter = newsletters[0]
  const feedPosts = latestPosts.filter(p => p.id !== featuredPost?.id).slice(0, 6)

  return (
    <main id="main-content">
      <div className="pb-section"><DualHero post={featuredPost} video={featuredVideo} locale={locale} t={t} isDark={isDark} /></div>
      <div className="pb-section"><ChannelStrip locale={locale} t={t} /></div>
      <div className="pb-section"><UnifiedFeed posts={feedPosts} videos={localeVideos.slice(1)} locale={locale} t={t} isDark={isDark} /></div>
      {primaryNewsletter && (
        <div className="pb-section"><NewsletterInline locale={locale} primaryNewsletter={primaryNewsletter} t={t} /></div>
      )}
    </main>
  )
}

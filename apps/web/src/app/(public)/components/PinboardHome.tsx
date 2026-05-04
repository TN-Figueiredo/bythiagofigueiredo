import { cookies } from 'next/headers'
import { DualHero } from './DualHero'
import { StatsStrip } from './StatsStrip'
import { ChannelStrip } from './ChannelStrip'
import { BlogGrid } from './BlogGrid'
import { VideoGrid } from './VideoGrid'
import { MostReadSidebar } from './MostReadSidebar'
import { TagCategoryGrid } from './TagCategoryGrid'
import { SubscribePair } from './SubscribePair'
import { HouseNewsletterBanner } from './HouseNewsletterBanner'
import { BookmarkPlaceholder } from './BookmarkPlaceholder'
import { MarginaliaPlaceholder } from './MarginaliaPlaceholder'
import {
  getFeaturedPost,
  getLatestPosts,
  getNewslettersForLocale,
  getTopTags,
  getPostsByTag,
  getMostReadPosts,
  getPostCount,
  getSubscriberCount,
} from '../../../../lib/home/queries'
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

  const [featuredPost, latestPosts, newsletters, topTags, mostReadPosts, postCount, subscriberCount] =
    await Promise.all([
      getFeaturedPost(locale),
      getLatestPosts(locale, 9),
      getNewslettersForLocale(locale),
      getTopTags(locale, 4),
      getMostReadPosts(locale, 5),
      getPostCount(locale),
      getSubscriberCount(),
    ])

  const localeVideos = SAMPLE_VIDEOS.filter(v => v.locale === locale)
  const featuredVideo = localeVideos[0] ?? null
  const primaryNewsletter = newsletters[0] ?? null
  const blogPosts = latestPosts.slice(0, 6)

  const tagGroups = await Promise.all(
    topTags.map(async (tag) => ({
      tag,
      posts: await getPostsByTag(locale, tag.id, 2),
    }))
  )
  const nonEmptyTagGroups = tagGroups.filter(g => g.posts.length > 0)

  const videoCount = localeVideos.length

  const showMostReadSection = mostReadPosts.length > 0 || nonEmptyTagGroups.length > 0

  return (
    <main id="main-content">
      {/* Stats Strip — right below header */}
      <StatsStrip
        postCount={postCount}
        videoCount={videoCount}
        subscriberCount={subscriberCount}
        locale={locale}
        t={t}
      />

      {/* §1 — Dual Hero */}
      <div className="pb-section">
        <DualHero post={featuredPost} video={featuredVideo} locale={locale} t={t} />
      </div>

      {/* §2 — Channel Strip: two channels, two languages */}
      <div className="pb-section">
        <ChannelStrip newsletter={primaryNewsletter} locale={locale} t={t} />
      </div>

      {/* §3 — Blog Grid */}
      <div className="pb-section">
        <BlogGrid posts={blogPosts} locale={locale} t={t} isDark={isDark} />
      </div>

      {/* Ad — Bookmark placeholder between blog & video */}
      <BookmarkPlaceholder locale={locale} t={t} />

      {/* §4 — Video Grid */}
      <div className="pb-section">
        <VideoGrid videos={localeVideos.slice(0, 3)} locale={locale} t={t} />
      </div>

      {/* Ad — Bookmark placeholder between video & discover */}
      <BookmarkPlaceholder locale={locale} t={t} />

      {/* §5 — Most Read + Tag Grid (side-by-side) */}
      {showMostReadSection && (
        <div className="pb-section">
          <section
            aria-labelledby="discover-heading"
            className="px-[18px] md:px-7"
            style={{ maxWidth: 1280, margin: '0 auto', paddingTop: 64, paddingBottom: 32 }}
          >
            <h2 id="discover-heading" className="sr-only">
              {t['home.discover.title'] ?? 'Discover'}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr]" style={{ gap: 56 }}>
              <div>
                <MostReadSidebar posts={mostReadPosts} locale={locale} t={t} />
                <MarginaliaPlaceholder locale={locale} t={t} />
              </div>
              <TagCategoryGrid tagGroups={nonEmptyTagGroups} locale={locale} t={t} />
            </div>
          </section>
        </div>
      )}

      {/* HOUSE · NEWSLETTER — banner CTA */}
      <div className="pb-section">
        <HouseNewsletterBanner newsletter={primaryNewsletter} locale={locale} subscriberCount={subscriberCount} t={t} />
      </div>

      {/* §6 — Newsletter + YouTube: "Pick your channel" (last) */}
      <div className="pb-section">
        <SubscribePair newsletter={primaryNewsletter} locale={locale} t={t} />
      </div>
    </main>
  )
}

import Header from './components/Header'
import Hero from './components/Hero'
import SocialLinks from './components/SocialLinks'
import Footer from './components/Footer'
import en from '@/locales/en.json'

export const metadata = {
  title: (en as Record<string, string>)['meta.title'],
}

const links = [
  { platform: 'instagram', url: 'https://www.instagram.com/thiagonfigueiredo', label: 'Instagram' },
  { platform: 'youtube_en', url: 'https://www.youtube.com/@bythiagofigueiredo', label: 'YouTube (EN)' },
  { platform: 'youtube_pt', url: 'https://www.youtube.com/@thiagonfigueiredo', label: 'YouTube (PT)' },
]

export default function Home() {
  const t = en as Record<string, string>
  return (
    <>
      <Header />
      <Hero headline={t['hero.headline']!} subheadline={t['hero.subheadline']!} />
      <section className="text-center p-[var(--spacing-lg)]">
        <h2>{t['social.title']}</h2>
        <SocialLinks links={links} />
      </section>
      <Footer note={t['footer.note']!} />
    </>
  )
}

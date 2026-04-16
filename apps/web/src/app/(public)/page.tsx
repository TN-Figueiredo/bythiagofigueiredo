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

interface HomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function Home({ searchParams }: HomeProps) {
  const t = en as Record<string, string>
  // requireArea redirects here with ?error=insufficient_access when a user
  // lacks access to the admin/cms area they tried to reach. Render a
  // dismissible-feel banner (reload clears the URL param) so the user gets
  // a clear reason instead of a silent bounce.
  const sp = await searchParams
  const showInsufficientAccess = sp.error === 'insufficient_access'
  return (
    <>
      {showInsufficientAccess && (
        <div
          role="alert"
          aria-live="polite"
          data-testid="insufficient-access-banner"
          style={{
            background: '#fef3c7',
            color: '#92400e',
            padding: '12px 16px',
            borderBottom: '1px solid #f59e0b',
            textAlign: 'center',
          }}
        >
          Você não tem acesso a essa área.
        </div>
      )}
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

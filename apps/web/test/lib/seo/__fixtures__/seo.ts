import type { SiteSeoConfig } from '@/lib/seo/config'
import type { PersonProfile, OrgProfile } from '@/lib/seo/identity-profiles'
import type { SeoExtras } from '@/lib/seo/jsonld/extras-schema'

export const mockPersonProfile: PersonProfile = {
  type: 'person',
  name: 'Thiago Figueiredo',
  jobTitle: 'Creator & Builder',
  imageUrl: 'https://example.com/identity/thiago.jpg',
  sameAs: ['https://www.instagram.com/x', 'https://github.com/x'],
}

export const mockOrgProfile: OrgProfile = {
  type: 'organization',
  name: 'TN Figueiredo',
  legalName: 'TN Figueiredo LTDA',
  logoUrl: 'https://example.com/logo.png',
  founderName: 'Thiago Figueiredo',
  sameAs: ['https://github.com/tn-figueiredo'],
}

export const mockConfig: SiteSeoConfig = {
  siteId: 'site-1',
  siteName: 'Example',
  siteUrl: 'https://example.com',
  defaultLocale: 'pt-BR',
  supportedLocales: ['pt-BR', 'en'],
  identityType: 'person',
  primaryColor: '#0F172A',
  logoUrl: null,
  twitterHandle: 'tnFigueiredo',
  defaultOgImageUrl: null,
  contentPaths: { blog: '/blog', campaigns: '/campaigns' },
  personIdentity: mockPersonProfile,
  orgIdentity: null,
}

export const mockPost = {
  id: 'post-1',
  title: 'Hello World',
  slug: 'hello-world',
  translation: { title: 'Hello World', slug: 'hello-world', excerpt: 'excerpt', reading_time_min: 3 },
  updated_at: new Date('2026-04-15T00:00:00Z'),
  published_at: new Date('2026-04-14T00:00:00Z'),
  authorName: 'Thiago Figueiredo',
}

export const mockTxs = [
  { locale: 'pt-BR', slug: 'hello-world', title: 'Olá Mundo', excerpt: 'exc', cover_image_url: null, seo_extras: null, content_toc: [] },
  { locale: 'en', slug: 'hello-world-en', title: 'Hello World', excerpt: 'exc-en', cover_image_url: null, seo_extras: null, content_toc: [] },
]

export const mockExtras: SeoExtras = {
  faq: [{ q: 'Q1?', a: 'A1.' }, { q: 'Q2?', a: 'A2.' }],
  howTo: {
    name: 'Do the thing',
    steps: [
      { name: 'Step 1', text: 'Do step 1.' },
      { name: 'Step 2', text: 'Do step 2.' },
    ],
  },
  video: {
    name: 'Video demo',
    description: 'demo',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    uploadDate: '2026-04-10',
  },
}

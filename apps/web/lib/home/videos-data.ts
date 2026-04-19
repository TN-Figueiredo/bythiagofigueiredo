import type { HomeChannel, HomeVideo } from './types'

export const YOUTUBE_CHANNELS: Record<'en' | 'pt-BR', HomeChannel> = {
  'en': {
    locale: 'en',
    handle: '@byThiagoFigueiredo',
    url: 'https://www.youtube.com/@byThiagoFigueiredo',
    flag: '🌎',
    name: 'by Thiago Figueiredo',
  },
  'pt-BR': {
    locale: 'pt-BR',
    handle: '@tnFigueiredoTV',
    url: 'https://www.youtube.com/@tnFigueiredoTV',
    flag: '🇧🇷',
    name: 'tnFigueiredo TV',
  },
}

// Placeholder data — replace with YouTube Data API v3 in a future sprint
export const SAMPLE_VIDEOS: HomeVideo[] = [
  {
    id: 'v1',
    locale: 'pt-BR',
    title: 'Como eu estruturo projetos Next.js em 2026',
    description: 'Arquitetura, pastas, patterns — tudo que aprendi em 5 anos de produção.',
    thumbnailUrl: null,
    duration: '18:42',
    viewCount: '—',
    publishedAt: '2026-04-10',
    series: 'Dev Diary',
    youtubeUrl: 'https://www.youtube.com/@tnFigueiredoTV',
  },
  {
    id: 'v2',
    locale: 'pt-BR',
    title: 'Viagem de moto pelo RS — 3 dias, 900km',
    description: 'Da Serra Gaúcha ao litoral numa moto de 250cc. Vale a pena?',
    thumbnailUrl: null,
    duration: '24:15',
    viewCount: '—',
    publishedAt: '2026-03-28',
    series: 'Estrada',
    youtubeUrl: 'https://www.youtube.com/@tnFigueiredoTV',
  },
  {
    id: 'v3',
    locale: 'en',
    title: 'Building a personal CMS from scratch',
    description: 'Why I wrote my own CMS instead of using Notion, Sanity, or Ghost.',
    thumbnailUrl: null,
    duration: '22:08',
    viewCount: '—',
    publishedAt: '2026-04-05',
    series: 'Build in Public',
    youtubeUrl: 'https://www.youtube.com/@byThiagoFigueiredo',
  },
  {
    id: 'v4',
    locale: 'en',
    title: 'The 1-year mark: what changed',
    description: "A year of creating in public. What worked, what flopped, what's next.",
    thumbnailUrl: null,
    duration: '15:30',
    viewCount: '—',
    publishedAt: '2026-03-15',
    series: 'Build in Public',
    youtubeUrl: 'https://www.youtube.com/@byThiagoFigueiredo',
  },
]

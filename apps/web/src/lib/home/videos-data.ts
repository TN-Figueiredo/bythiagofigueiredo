import type { HomeChannel } from './types'

export const YOUTUBE_CHANNELS: Record<'en' | 'pt-BR', HomeChannel> = {
  en: {
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
